/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 제출 1건을 Channel Talk까지 처리한다: 식별 → 프로필 → 상담 → 내부대화 → 열기 → 중복 후보.
 *
 * 규칙 원본: docs/plans/2026-10-01-channeltalk-crm-integration.md 1·2·8장.
 * - store·api·config·clock을 인자로 받는다(테스트에서 가짜로 바꾼다).
 * - 단계마다 channelTalkSync를 갱신하므로 실패·중단 뒤 다음 시도는 남은 단계부터 이어간다.
 * - 이 함수는 원본 제출 문서를 바꾸지 않는다. 실패해도 제출에는 영향이 없다.
 */
const { ChannelTalkApiError } = require("./api");
const { classifySubmission } = require("./email");
const { toMillis } = require("./field-types");
const {
  DUP_TAG, decideIdentity, dupPairKey, evaluateDupPair, isEmailCompatible, mergeTags, resolveChannelUser, userEmail,
} = require("./identity");
const { buildNotes } = require("./notes");
const { buildProfileUpdate } = require("./profile");
const { afterFailure, deferDupCheck, nextStep } = require("./sync-state");

// 한 번의 재시도 실행에서 처리할 최대 건수. 실제 처리 시간·호출량을 보고 조정한다.
const RETRY_BATCH_LIMIT = 50;
// 재시도 함수의 실행 시간 제한(2분) 안에 끝나도록, 이 시간이 지나면 새 건을 잡지 않는다.
const RETRY_TIME_BUDGET_MS = 80 * 1000;
const TERMINAL = new Set(["success", "skipped", "failed"]);
// 단계 함수가 돌려주면 회원가입의 중복 판정을 미루고 이번 실행을 끝낸다.
const DEFER_DUP_CHECK = Symbol("defer_dup_check");
// identityNote 우선순위(앞이 높음). 사유 코드만 남긴다(고객 정보 금지).
const NOTE_PRIORITY = [
  "mapping_user_unified_other_email",
  "mapping_user_missing",
  "mapping_user_unified",
  "browser_email_mismatch",
  "browser_user_unified_other_email",
  "browser_user_unified",
  "browser_user_unresolved",
  "browser_user_missing",
];

function topNote(notes) {
  return NOTE_PRIORITY.find((note) => notes.has(note)) || null;
}

/** 처리 기록을 만들기 전(처리권을 잡기 전)에 난 오류. 이 오류만 트리거 밖으로 나간다. */
class PreClaimError extends Error {
  constructor(cause) {
    super("pre_claim_failed");
    this.name = "PreClaimError";
    this.code = (cause && (cause.code || cause.name)) || "error";
    this.cause = cause;
  }
}

class StepError extends Error {
  constructor(code) {
    super(code);
    this.name = "StepError";
    this.code = code;
  }
}

function labelFromFlags(flags) {
  if (flags && flags.test) return "[TEST]";
  if (flags && flags.internal) return "[내부]";
  return null;
}

function describeError(step, error) {
  if (error instanceof ChannelTalkApiError) {
    return `${step}: ${error.code}${error.status ? ` ${error.status}` : ""}`;
  }
  if (error instanceof StepError) return `${step}: ${error.code}`;
  return `${step}: internal_error`;
}

async function loadContext(source, docId, data, store) {
  if (source === "users") return { uid: docId, email: data.email || "", user: data };
  if (source === "orders") {
    const user = await store.getUserDoc(data.uid);
    return { uid: data.uid || null, email: (user && user.email) || "", user };
  }
  return { uid: (typeof data.uid === "string" && data.uid) || null, email: data.email || "", user: null };
}

async function orderPosition(store, uid, orderId) {
  const orders = (await store.listOrdersForUid(uid))
    .filter((order) => !order.isTest || order.id === orderId)
    .map((order) => ({ ...order, ms: toMillis(order.createdAt) || 0 }))
    .sort((a, b) => a.ms - b.ms || a.id.localeCompare(b.id));
  const index = orders.findIndex((order) => order.id === orderId);
  return { orderCount: orders.length || 1, orderIndex: index >= 0 ? index + 1 : orders.length || 1 };
}

/**
 * @param {object} input
 * @param {"users"|"contact"|"landingRequests"|"orders"} input.source
 * @param {string} input.docId
 * @param {object} [input.data]  트리거가 넘긴 문서. 없으면 store에서 읽는다(재시도)
 * @param {object} input.deps    { store, api, config, now }
 *   config: { enabled, internalDomains, testDomain, botName, noteMaxLength }
 */
async function processSubmission({ source, docId, data: given, deps }) {
  const { store, api, config } = deps;
  const clock = deps.now || Date.now;

  // 처리 기록을 만들거나 처리권을 잡기 전의 오류는 기록이 없어 channelTalkRetry가 모른다.
  // PreClaimError로 감싸 트리거가 Firebase 자동 재실행에 맡기게 한다(handleTriggerEvent).
  let data;
  let ctx;
  let claim;
  try {
    data = given || (await store.getSourceDoc(source, docId));
    if (!data) {
      // 원본이 지워졌으면 다시 시도해도 처리할 수 없다.
      const existing = await store.getSync(source, docId);
      if (existing && !TERMINAL.has(existing.status)) {
        await store.updateSync(source, docId, { status: "failed", nextRetryAt: null, leaseUntil: null, lastError: "source: source_missing" }, clock());
      }
      return { outcome: "source_missing" };
    }
    ctx = await loadContext(source, docId, data, store);
    const classification = classifySubmission({ isTest: data.isTest, email: ctx.email }, config);
    claim = await store.claim({
      source,
      docId,
      email: ctx.email || null,
      uid: ctx.uid,
      classification,
      enabled: config.enabled === true,
      nowMs: clock(),
      submittedAtMs: toMillis(data.createdAt) || toMillis(data.serverCreatedAt),
    });
  } catch (error) {
    throw new PreClaimError(error);
  }
  if (claim.action !== "process") return { outcome: claim.action };

  const sync = { ...claim.doc, steps: { ...claim.doc.steps } };

  async function save(patch) {
    const stored = {};
    for (const [key, value] of Object.entries(patch)) {
      if (key.startsWith("steps.")) sync.steps[key.slice(6)] = value;
      else sync[key] = value;
      stored[key] = value;
    }
    await store.updateSync(source, docId, stored, clock());
  }

  // 식별 뒤 고객이 통합된 것을 발견하면 식별·프로필부터 다시 한다. 한 번의 실행에서 한 번만.
  let reidentifiedThisRun = false;
  async function reidentify() {
    if (reidentifiedThisRun) throw new StepError("user_unified_again");
    reidentifiedThisRun = true;
    await save({
      "steps.identity": "pending",
      "steps.profile": "pending",
      channelUserId: null,
      identitySource: null,
      identityNote: null,
      leadCreateStartedAt: null,
      reidentified: true,
    });
  }

  const steps = {
    async identity() {
      const isMember = source === "users" || source === "orders" || Boolean(ctx.uid);
      if (isMember) {
        if (!ctx.uid) throw new StepError("no_uid");
        // PUT @memberId는 기존 프로필을 보낸 내용으로 통째로 바꾼다(T8). 이미 있는 회원이면 부르지 않고,
        // 없을 때만 firebaseUid로 새로 만든다. firebaseUid는 이어지는 프로필 PATCH가 갱신한다.
        // 같은 회원의 첫 이벤트 두 개가 동시에 "없음"을 보면 둘 다 PUT할 수 있다(설계 문서에 남긴 위험).
        const member = (await api.getUserByMemberId(ctx.uid))
          || (await api.upsertMember(ctx.uid, { profile: { firebaseUid: ctx.uid } }));
        if (!member || !member.id) throw new StepError("no_user_id");
        // 회원끼리의 통합은 관찰된 적이 없다. 임의로 고르지 않고 사람이 확인하게 둔다.
        if (member.type === "unified") throw new StepError("member_unified");
        await store.recordIdentity({ email: ctx.email, channelUserId: member.id, origin: "member", uid: ctx.uid, nowMs: clock() });
        await save({ "steps.identity": "done", identitySource: "member", channelUserId: member.id });
        return;
      }

      const notes = new Set();
      const unified = {};
      const mapping = await store.getMapping(ctx.email);
      const mappingIds = new Set([mapping && mapping.channelUserId, ...((mapping && mapping.otherChannelUserIds) || [])].filter(Boolean));

      // 브라우저 id는 참고값이다. 통합됐으면 최종 고객의 이메일이 맞을 때만 쓰고, 그 밖에는 없는 것으로 보고 진행한다.
      let browserUser = null;
      if (typeof data.channelUserId === "string" && data.channelUserId) {
        const found = await resolveChannelUser(api.getUser, data.channelUserId);
        if (found.kind === "live") {
          browserUser = { id: found.user.id, email: userEmail(found.user) || null };
        } else if (found.kind === "missing") {
          notes.add("browser_user_missing");
        } else if (found.kind === "unified") {
          if (mappingIds.has(found.id)) unified[found.id] = found.canonicalId;
          if (isEmailCompatible(found.canonical, ctx.email)) {
            browserUser = { id: found.canonicalId, email: userEmail(found.canonical) || null };
            notes.add("browser_user_unified");
          } else {
            notes.add("browser_user_unified_other_email");
          }
        } else {
          notes.add("browser_user_unresolved");
        }
      }
      let decision = decideIdentity({ uid: null, email: ctx.email, browserUser, mapping });
      if (!decision.source) throw new StepError(decision.reason || "unidentifiable");
      if (decision.browserMismatch) notes.add("browser_email_mismatch");

      let channelUserId = decision.channelUserId;
      const missingIds = [];
      if (decision.source === "email_mapping") {
        let useServerLead = true;
        let found;
        if (decision.memberId) {
          const member = await api.getUserByMemberId(decision.memberId);
          found = member ? await resolveChannelUser(api.getUser, member.id, { initial: member }) : { kind: "missing", id: mapping.channelUserId };
        } else {
          found = await resolveChannelUser(api.getUser, decision.channelUserId);
        }
        if (found.kind === "live") {
          channelUserId = found.user.id;
          useServerLead = false;
        } else if (found.kind === "missing") {
          // 매핑의 대표 고객이 실제로 없다(삭제 등). 새로 식별한 고객으로 대표를 바꾼다.
          if (mapping.channelUserId) missingIds.push(mapping.channelUserId);
          notes.add("mapping_user_missing");
        } else if (found.kind === "unified") {
          unified[found.id] = found.canonicalId;
          if (isEmailCompatible(found.canonical, ctx.email)) {
            channelUserId = found.canonicalId;
            useServerLead = false;
            notes.add("mapping_user_unified");
          } else {
            // 다른 이메일의 고객에 통합됐다(같은 브라우저를 다른 사람이 씀). 그 고객에 기록하지 않는다.
            notes.add("mapping_user_unified_other_email");
          }
        } else if (found.kind === "unified_missing") {
          unified[found.id] = found.canonicalId;
          if (mappingIds.has(found.canonicalId)) missingIds.push(found.canonicalId);
          notes.add("mapping_user_missing");
        } else {
          throw new StepError("unified_unresolved");
        }
        if (useServerLead) decision = { ...decision, source: "server_lead" };
      }

      if (decision.source === "server_lead") {
        const patch = { "steps.identity": "creating_lead", leadCreateStartedAt: sync.leadCreateStartedAt || clock() };
        if (sync.steps.identity === "creating_lead") patch.possibleOrphanLead = true;
        await save(patch);
        const lead = await api.createLead({ email: ctx.email });
        if (!lead || !lead.id) throw new StepError("no_user_id");
        channelUserId = lead.id;
      }

      const origin = decision.source === "email_mapping" ? (mapping && mapping.channelUserOrigin) || "browser" : decision.source;
      await store.recordIdentity({ email: ctx.email, channelUserId, origin, missingIds, unified, nowMs: clock() });
      await save({ "steps.identity": "done", identitySource: decision.source, channelUserId, identityNote: topNote(notes) });
    },

    async profile() {
      const current = await api.getUser(sync.channelUserId);
      // 식별 뒤에 Channel이 통합했다. PATCH 전에 다시 식별한다.
      if (current && current.type === "unified") return reidentify();
      const position = source === "orders" ? await orderPosition(store, ctx.uid, docId) : {};
      const update = buildProfileUpdate({
        kind: source,
        data,
        uid: ctx.uid,
        orderId: docId,
        orderCount: position.orderCount,
        user: ctx.user,
        existingProfile: current ? current.profile || {} : undefined,
      });
      // 휴대폰 번호는 따로 보낸다. Channel이 번호 자체를 검사해 거부하면(422) 같은 요청의 다른 필드까지 함께 거부된다(T8).
      const { mobileNumber, ...profileOnce } = update.profileOnce;
      const body = {};
      if (Object.keys(profileOnce).length) body.profileOnce = profileOnce;
      if (Object.keys(update.profile).length) body.profile = update.profile;
      if (Object.keys(body).length) await api.patchUser(sync.channelUserId, body);
      let result = update.result;
      if (mobileNumber !== undefined) {
        try {
          await api.patchUser(sync.channelUserId, { profileOnce: { mobileNumber } });
        } catch (error) {
          if (!(error instanceof ChannelTalkApiError && error.status === 422)) throw error;
          // 번호만 포기한다. 원문은 주문 내부대화의 고객 정보와 Firestore users에 남는다.
          result = {
            ...result,
            applied: result.applied.filter((field) => field !== "mobileNumber"),
            skipped: { ...result.skipped, mobileNumber: "rejected_by_channel" },
          };
        }
      }
      if (profileOnce.firstSource) await store.setFirstSource(ctx.email, profileOnce.firstSource, clock());
      await save({ "steps.profile": "done", profileResult: result });
    },

    async chat() {
      if (sync.userChatId) {
        await save({ "steps.chat": "done" });
        return;
      }
      // 재시도라면 이전 시도 뒤에 통합됐을 수 있다. 상담을 만들기 전에 확인한다(처음 처리에서는 호출을 늘리지 않는다).
      if (sync.attempts > 1) {
        const current = await api.getUser(sync.channelUserId);
        if (current && current.type === "unified") return reidentify();
      }
      const patch = { "steps.chat": "creating", chatCreateStartedAt: sync.chatCreateStartedAt || clock() };
      // 이전 생성 요청의 성공 여부를 확인할 방법이 없다(T1: API로 만든 initial 상담은 목록 API에 나오지 않는다).
      // 찾지 않고 새로 만들고, 빈 initial 상담이 남아 있을 가능성만 표시한다(실제 중복이 확인됐다는 뜻은 아니다).
      if (sync.steps.chat === "creating") patch.possibleOrphanChat = true;
      await save(patch);
      const chat = await api.createUserChat(sync.channelUserId);
      if (!chat || !chat.id) throw new StepError("no_chat_id");
      await save({ "steps.chat": "done", userChatId: chat.id });
    },

    async note() {
      const position = source === "orders" ? await orderPosition(store, ctx.uid, docId) : {};
      const notes = buildNotes(
        {
          kind: source,
          docId,
          data,
          label: labelFromFlags(sync.flags),
          identitySource: sync.identitySource,
          receivedAt: toMillis(data.createdAt) || toMillis(data.serverCreatedAt) || clock(),
          profileResult: sync.profileResult,
          orderIndex: position.orderIndex,
          orderId: docId,
          user: ctx.user,
        },
        { maxLength: config.noteMaxLength },
      );
      const footer = `기록: ${source}/${docId}`;
      const existing = await api.listAllMessages(sync.userChatId);
      const ids = [...(sync.noteMessageIds || [])];
      for (const note of notes) {
        const firstLine = note.split("\n")[0];
        const sent = existing.find(
          (message) => typeof message.plainText === "string"
            && message.plainText.includes(footer)
            && message.plainText.split("\n")[0] === firstLine,
        );
        if (sent) {
          if (sent.id && !ids.includes(sent.id)) ids.push(sent.id);
          continue;
        }
        const message = await api.sendPrivateNote(sync.userChatId, note, config.botName);
        if (message && message.id) ids.push(message.id);
        await save({ noteMessageIds: ids });
      }
      await save({ "steps.note": "done", noteMessageIds: ids, noteParts: notes.length });
    },

    async open() {
      const chat = await api.getUserChat(sync.userChatId);
      // 준비중(initial)일 때만 연다. 담당자가 이미 닫거나 보류한 상담은 건드리지 않는다.
      if (chat && chat.state === "initial") await api.openUserChat(sync.userChatId, config.botName);
      await save({ "steps.open": "done" });
    },

    async dupTag() {
      const mapping = ctx.email ? await store.getMapping(ctx.email) : null;
      const known = (mapping && mapping.unifiedChannelUserIds) || {};
      const ids = new Set([mapping && mapping.channelUserId, ...((mapping && mapping.otherChannelUserIds) || [])].filter(Boolean));
      // 이미 통합으로 기록된 id는 후보가 아니다. 통합 기록의 값(최종 고객)도 후보로 쓰지 않는다.
      const candidates = [...ids].filter((id) => id !== sync.channelUserId && !(id in known));
      if (!mapping || !ids.has(sync.channelUserId) || candidates.length === 0) {
        await save({ "steps.dupTag": "skipped" });
        return undefined;
      }
      // 회원가입 직후에는 같은 브라우저 리드가 곧 회원에 통합된다(T4·X12). 바로 판정하지 않고 미룬다.
      if (source === "users" && sync.steps.dupTag === "pending") return DEFER_DUP_CHECK;

      const unified = {};
      const missingIds = [];
      const live = {};
      const pairs = new Map();
      const myOrigin = sync.identitySource === "email_mapping" ? mapping.channelUserOrigin || "browser" : sync.identitySource;

      const me = await resolveChannelUser(api.getUser, sync.channelUserId);
      let mine = null;
      if (me.kind === "live") mine = me.user;
      if (me.kind === "unified" || me.kind === "unified_missing") unified[me.id] = me.canonicalId;
      if (me.kind === "unified" && isEmailCompatible(me.canonical, ctx.email)) {
        mine = me.canonical;
        pairs.set(dupPairKey(me.id, mine.id), { unified: true });
      }

      if (mine) {
        live[mine.id] = myOrigin;
        for (const id of candidates) {
          if (id === mine.id) continue;
          const found = await resolveChannelUser(api.getUser, id);
          if (found.kind === "missing" || found.kind === "unresolved") continue;
          if (found.kind === "unified_missing") {
            unified[id] = found.canonicalId;
            if (ids.has(found.canonicalId)) missingIds.push(found.canonicalId);
            continue;
          }
          let other = found.user;
          if (found.kind === "unified") {
            unified[id] = found.canonicalId;
            if (found.canonicalId === mine.id) {
              // Channel이 이미 같은 고객으로 통합했다. 중복이 아니다.
              pairs.set(dupPairKey(id, mine.id), { unified: true });
              continue;
            }
            if (!isEmailCompatible(found.canonical, ctx.email)) continue;
            other = found.canonical;
            live[other.id] = live[other.id] || mapping.channelUserOrigin || "browser";
          }
          const key = dupPairKey(mine.id, other.id);
          if (!pairs.has(key)) pairs.set(key, { other });
        }
      }

      if (Object.keys(unified).length || missingIds.length) {
        await store.recordUnified({ email: ctx.email, unified, missingIds, live, nowMs: clock() });
      }
      if (!mine) {
        await save({ "steps.dupTag": "skipped" });
        return undefined;
      }

      for (const [key, pair] of pairs) {
        const state = ((mapping.dupPairs || {})[key] || {}).state;
        if (pair.unified) {
          // 이미 붙은 dup-candidate는 지우지 않는다(담당자가 판단).
          if (state !== "unified") await store.setDupPairState(ctx.email, key, "unified", clock());
          continue;
        }
        const { other } = pair;
        const decision = evaluateDupPair((mapping.dupPairs || {})[key], { [mine.id]: mine.tags, [other.id]: other.tags });
        if (decision.action === "mark_dismissed") {
          await store.setDupPairState(ctx.email, key, "dismissed", clock());
        } else if (decision.action === "tag") {
          let limited = false;
          for (const user of [mine, other]) {
            const merged = mergeTags(user.tags, DUP_TAG);
            if (merged.reason === "limit") limited = true;
            if (merged.changed) {
              await api.patchUser(user.id, { tags: merged.tags });
              user.tags = merged.tags;
            }
          }
          await store.setDupPairState(ctx.email, key, limited ? "tag_limit" : "tagged", clock());
        }
      }
      await save({ "steps.dupTag": "done" });
      return undefined;
    },
  };

  let step = nextStep(source, sync.steps);
  try {
    while (step) {
      const result = await steps[step]();
      if (result === DEFER_DUP_CHECK) {
        await save(deferDupCheck(clock()));
        return { outcome: "deferred" };
      }
      step = nextStep(source, sync.steps);
    }
  } catch (error) {
    const keepMarker = error instanceof ChannelTalkApiError && error.ambiguous
      && ((step === "chat" && sync.steps.chat === "creating") || (step === "identity" && sync.steps.identity === "creating_lead"));
    const after = afterFailure({ attempts: sync.attempts, nowMs: clock() });
    const patch = { status: after.status, nextRetryAt: after.nextRetryAt, leaseUntil: null, lastError: describeError(step, error) };
    if (!keepMarker) patch[`steps.${step}`] = "error";
    try {
      await save(patch);
    } catch {
      // 기록에 실패해도 lease 만료 후 안전망 nextRetryAt으로 다시 집힌다.
    }
    return { outcome: after.status, step, error: patch.lastError };
  }

  try {
    await save({ status: "success", leaseUntil: null, nextRetryAt: null, lastError: null, pendingReason: null });
  } catch {
    // 단계는 모두 끝났다. 기록에 실패해도 lease 만료 후 재시도가 남은 단계 없이 success로 마무리한다.
    return { outcome: "success_unrecorded" };
  }
  return { outcome: "success" };
}

/** 10분 주기 재시도. 스위치가 꺼져 있으면 아무것도 읽거나 바꾸지 않는다. */
async function runRetryBatch({ deps, limit = RETRY_BATCH_LIMIT, timeBudgetMs = RETRY_TIME_BUDGET_MS }) {
  if (deps.config.enabled !== true) return { disabled: true, processed: [] };
  const clock = deps.now || Date.now;
  const startedAt = clock();
  const due = await deps.store.listRetryDue(startedAt, limit);
  const processed = [];
  for (const doc of due) {
    if (clock() - startedAt > timeBudgetMs) break;
    try {
      const result = await processSubmission({ source: doc.source, docId: doc.docId, deps });
      processed.push({ source: doc.source, docId: doc.docId, outcome: result.outcome });
    } catch (error) {
      // 처리권을 잡기 전 오류. 기록이 그대로 남아 있으므로 다음 실행이 다시 집는다.
      processed.push({ source: doc.source, docId: doc.docId, outcome: "pre_claim_error", error: error.code || error.name });
    }
  }
  return { disabled: false, processed, remaining: due.length - processed.length };
}

/**
 * 문서 생성 트리거 한 건 처리.
 * - 처리권을 잡기 전 오류(PreClaimError)만 다시 던진다 → Firebase 자동 재실행(retry: true)이 다시 부른다.
 *   다시 불려도 처리권 잡기 트랜잭션이 중복을 막는다.
 * - 처리권을 잡은 뒤의 오류는 processSubmission이 channelTalkSync에 기록하고 결과로 돌려준다
 *   → 던지지 않으므로 Firebase가 다시 부르지 않고, 재시도는 channelTalkRetry가 맡는다.
 */
async function handleTriggerEvent({ source, docId, data, deps, log = console }) {
  try {
    const result = await processSubmission({ source, docId, data, deps });
    log.log(`channelTalk ${source}/${docId}: ${result.outcome}${result.step ? ` (${result.step})` : ""}`);
    return result;
  } catch (error) {
    if (error instanceof PreClaimError) {
      log.error(`channelTalk ${source}/${docId}: pre_claim_failed ${error.code} — Firebase 재실행에 맡김`);
      throw error;
    }
    // 처리권을 잡은 뒤인데 여기까지 왔다면 기록 갱신까지 실패한 경우다. lease·안전망 nextRetryAt이 재시도로 넘긴다.
    log.error(`channelTalk ${source}/${docId}: unhandled ${error && (error.code || error.name)}`);
    return { outcome: "unhandled" };
  }
}

module.exports = {
  PreClaimError,
  RETRY_BATCH_LIMIT,
  RETRY_TIME_BUDGET_MS,
  handleTriggerEvent,
  processSubmission,
  runRetryBatch,
};
