/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * V2 이관 dry-run 입력 수집 (읽기 전용).
 *
 * - Firestore는 호출하는 쪽이 넘긴 listDocs(이름, {prefix})로만 읽는다. 쓰기 함수를 받지 않는다.
 * - Channel은 GET 두 가지(getUser, getUserByMemberId)만 쓰는 reader로 읽는다.
 *   reader는 GET이 아닌 요청을 거부하는 fetch 위에서 만든다(readOnlyFetch).
 * - 판정은 migration-plan.js가 한다. 이 파일은 스냅샷을 모아 넘긴다.
 * - 비공개 제외 목록은 실행 시 읽어 normalizeExclusion으로 바꾼다. 저장소에 복사하지 않는다.
 */
const path = require("node:path");
const { ChannelTalkApiError } = require("./api");
const { normalizeEmail } = require("./email");
const { MAX_UNIFIED_HOPS, userEmail } = require("./identity");
const { planMigration } = require("./migration-plan");

const SOURCES = ["users", "contact", "landingRequests", "orders"];
const TEST_MEMBER_PREFIX = "zz-test-member-";
const INGEST_CHANNEL_PREFIX = "channeltalk:main:";
const THREAD_PREFIX = "channeltalk:";
const MAX_RETRY_AFTER_MS = 60 * 1000;

/** 비공개 v2-test-exclusion-ids.json → planMigration exclusion. 형식을 모르는 보호 항목은 세기만 한다. */
function normalizeExclusion(raw) {
  const data = raw || {};
  const exclude = data.exclude || {};
  const firestore = exclude.firestore || {};
  const channel = exclude.channelTalk || {};
  const list = (value) => (Array.isArray(value) ? value.filter((v) => typeof v === "string" && v) : []);

  const firestoreIds = [
    ...list(firestore.contact).map((id) => `contact_${id}`),
    ...list(firestore.landingRequests).map((id) => `landingRequests_${id}`),
    ...list(firestore.channelTalkSync),
  ];

  const protectedIds = [];
  let unrecognizedProtected = 0;
  const groups = data.protected || {};
  for (const key of Object.keys(groups)) {
    if (key === "bots") continue;
    for (const entry of list(groups[key])) {
      const slash = entry.indexOf("/");
      const collection = slash > 0 ? entry.slice(0, slash) : null;
      const id = slash > 0 ? entry.slice(slash + 1) : entry;
      if (!collection && /^[A-Za-z]+_[^\s/]+$/.test(entry)) protectedIds.push(entry);
      else if (SOURCES.includes(collection) && !/[\s/]/.test(id)) protectedIds.push(`${collection}_${id}`);
      else if (collection === "channelTalkSync" && !/[\s/]/.test(id)) protectedIds.push(id);
      else unrecognizedProtected += 1;
    }
  }

  const userStatus = channel.userStatus || {};
  return {
    version: data.version ?? null,
    exclusion: {
      protectedIds: [...new Set(protectedIds)].sort(),
      firestoreIds: [...new Set(firestoreIds)].sort(),
      emails: list(exclude.emails),
      channelUserIds: list(channel.userIds),
      unverifiedDeletedUserIds: Object.keys(userStatus).filter((id) => userStatus[id] && userStatus[id].status === "deleted_id_unverified"),
    },
    mappingKeys: new Set(list(firestore.channelTalkIdentities)),
    testThreadIds: new Set(list(firestore.threads)),
    deletedTestUserIds: new Set(Object.keys(userStatus).filter((id) => userStatus[id] && userStatus[id].status === "deleted")),
    testMemberIds: new Set(list(channel.memberIds)),
    unrecognizedProtected,
    reviewEntries: Array.isArray(data.review) ? data.review.length : 0,
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const input = String(text || "").replace(/^﻿/, "");
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Desk 고객 내보내기 CSV → { 정규화 이메일: [Channel 고객 id] }. 열 이름은 내보내기 파일을 보고 지정한다. */
function parseDeskExport(text, { idColumn, emailColumn }) {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new Error("Desk 내보내기 파일이 비어 있습니다");
  const idIndex = header.indexOf(idColumn);
  const emailIndex = header.indexOf(emailColumn);
  if (idIndex < 0 || emailIndex < 0) {
    throw new Error(`Desk 내보내기 열을 찾지 못했습니다. 열 이름: ${header.join(", ")}`);
  }
  const index = {};
  let skipped = 0;
  for (const row of rows) {
    const id = (row[idIndex] || "").trim();
    const email = normalizeEmail(row[emailIndex]);
    if (!id || !email) { skipped += 1; continue; }
    index[email] = [...new Set([...(index[email] || []), id])].sort();
  }
  return { index, rows: rows.length, skipped };
}

/** GET이 아닌 요청은 보내기 전에 막는다. */
function readOnlyFetch(fetchImpl) {
  return (url, options = {}) => {
    const method = String(options.method || "GET").toUpperCase();
    if (method !== "GET") return Promise.reject(new Error(`읽기 전용 실행에서 ${method} 요청을 막았습니다`));
    return fetchImpl(url, options);
  };
}

/**
 * GET 두 가지만 노출한다. 요청 사이 간격을 두고, 애매한 실패(429·5xx·시간 초과)는 다시 시도한다.
 * 확실한 거부(404 외 4xx)나 재시도 소진, 요청 상한 초과는 실행 전체를 멈춘다.
 */
function createReadOnlyReader(api, {
  intervalMs = 250,
  maxRequests = 3000,
  maxRetries = 4,
  backoffMs = 2000,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const stats = { requests: 0, retries: 0, notFound: 0 };
  let last = null;

  async function call(fn) {
    for (let attempt = 0; ; attempt += 1) {
      if (stats.requests >= maxRequests) throw new Error(`Channel 요청 상한(${maxRequests})에 도달해 멈췄습니다`);
      if (last !== null && intervalMs > 0) await sleep(intervalMs);
      stats.requests += 1;
      last = Date.now();
      try {
        const result = await fn();
        if (result === null) stats.notFound += 1;
        return result;
      } catch (error) {
        const retryable = error instanceof ChannelTalkApiError && error.ambiguous;
        if (!retryable || attempt >= maxRetries) throw error;
        stats.retries += 1;
        const wait = error.retryAfterSeconds
          ? Math.min(error.retryAfterSeconds * 1000, MAX_RETRY_AFTER_MS)
          : backoffMs * 2 ** attempt;
        await sleep(wait);
      }
    }
  }

  return {
    stats,
    getUser: (id) => call(() => api.getUser(id)),
    getUserByMemberId: (uid) => call(() => api.getUserByMemberId(uid)),
  };
}

/** 결과 경로가 저장소 안이면 거부한다. */
function assertOutsideRepo(outDir, repoRoot) {
  const relative = path.relative(path.resolve(repoRoot), path.resolve(outDir));
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    throw new Error("결과 경로가 Git 저장소 안에 있습니다. 저장소 밖 비공개 경로를 지정하세요");
  }
}

/** 오류 문구에서 Channel 경로의 id를 지운다(콘솔·파일에 고객 id를 남기지 않기 위해). */
function redactError(error) {
  return String((error && error.message) || error).replace(/(\/open\/users\/)[^\s]+/g, "$1…");
}

function sortedObject(map) {
  return Object.fromEntries(Object.keys(map).sort().map((key) => [key, map[key]]));
}

function readSnapshotOr(listDocs, snapshot) {
  const cached = (snapshot && snapshot.firestore) || {};
  return async (name, options) => {
    if (cached[name]) return cached[name];
    if (!listDocs) throw new Error(`스냅샷에 ${name} 기록이 없어 Firestore를 다시 읽어야 합니다`);
    return listDocs(name, options);
  };
}

/** Firestore 원천을 읽는다. 스냅샷이 있으면 그 값을 쓰고 다시 읽지 않는다. */
async function readFirestore(read, { includeIngestIds, includeThreadIds }) {
  const docs = {};
  for (const name of [...SOURCES, "channelTalkSync", "channelTalkIdentities", "buyers"]) docs[name] = await read(name);
  if (includeIngestIds) docs.conversationIdentities = await read("conversationIdentities", { prefix: INGEST_CHANNEL_PREFIX });
  if (includeThreadIds) docs.threads = await read("threads", { prefix: THREAD_PREFIX });
  return docs;
}

function buildBase(docs, ex, config) {
  const records = [];
  const counts = {};
  for (const source of SOURCES) {
    counts[source] = docs[source].length;
    for (const doc of docs[source]) records.push({ source, docId: doc.id, data: doc.data });
  }
  const syncDocs = Object.fromEntries(docs.channelTalkSync.map((d) => [d.id, d.data]));
  const mappings = {};
  let excludedMappings = 0;
  for (const doc of docs.channelTalkIdentities) {
    if (ex.mappingKeys.has(doc.id)) { excludedMappings += 1; continue; }
    const email = normalizeEmail(doc.data && doc.data.email);
    if (email) mappings[email] = doc.data;
  }
  const buyers = docs.buyers.map((d) => ({ id: d.id, emails: (d.data && d.data.emails) || [] }));
  Object.assign(counts, {
    channelTalkSync: docs.channelTalkSync.length,
    channelTalkIdentities: docs.channelTalkIdentities.length,
    buyers: docs.buyers.length,
  });
  if (docs.conversationIdentities) counts.conversationIdentities = docs.conversationIdentities.length;
  if (docs.threads) counts.threads = docs.threads.length;
  return { base: { records, buyers, mappings, syncDocs, exclusion: ex.exclusion, config }, counts, excludedMappings };
}

/**
 * 조회할 uid와 Channel id를 정한다. 제외 판정을 먼저 적용하고, 테스트 memberId와
 * Desk에서 지운 것으로 확인된 테스트 id는 조회하지 않는다(404로 간주).
 */
async function planLookups(docs, ex, base, deskIndex) {
  const pre = await planMigration(base);
  const uids = [...new Set(pre.customers.map((c) => c.uid).filter(Boolean))]
    .filter((uid) => !uid.startsWith(TEST_MEMBER_PREFIX) && !ex.testMemberIds.has(uid))
    .sort();
  const emails = new Set(pre.customers.map((c) => c.email).filter(Boolean));
  const includedIds = new Set(pre.records.filter((r) => r.decision !== "skip").map((r) => r.id));
  const sources = { mapping: 0, desk: 0, record: 0, ingest: 0, thread: 0 };
  const knownIds = new Set();
  const add = (id, source) => {
    if (typeof id !== "string" || !id || knownIds.has(id)) return;
    knownIds.add(id);
    sources[source] += 1;
  };

  for (const email of [...emails].sort()) {
    const mapping = base.mappings[email];
    if (mapping) {
      add(mapping.channelUserId, "mapping");
      for (const id of mapping.otherChannelUserIds || []) add(id, "mapping");
    }
    for (const id of (deskIndex && deskIndex[email]) || []) add(id, "desk");
  }
  for (const record of base.records) {
    const id = `${record.source}_${record.docId}`;
    if (!includedIds.has(id)) continue;
    add(record.data && record.data.channelUserId, "record");
    add(base.syncDocs[id] && base.syncDocs[id].channelUserId, "record");
  }
  for (const doc of docs.conversationIdentities || []) {
    if (doc.id.startsWith(INGEST_CHANNEL_PREFIX)) add(doc.id.slice(INGEST_CHANNEL_PREFIX.length), "ingest");
  }
  // 수집기 스레드: 이메일로 식별된 상담만, 우리 고객 이메일과 같을 때만 조회한다.
  const threads = { testSkipped: 0, matched: 0, otherEmail: 0, noEmail: 0 };
  for (const doc of docs.threads || []) {
    const data = doc.data || {};
    if (ex.testThreadIds.has(doc.id)) { threads.testSkipped += 1; continue; }
    const identity = typeof data.identityId === "string" ? data.identityId : "";
    const email = identity.startsWith("email:") ? normalizeEmail(identity.slice("email:".length)) : "";
    if (!email || typeof data.channelTalkUserId !== "string") threads.noEmail += 1;
    else if (!emails.has(email)) threads.otherEmail += 1;
    else { threads.matched += 1; add(data.channelTalkUserId, "thread"); }
  }

  const knownDeleted = [...knownIds].filter((id) => ex.deletedTestUserIds.has(id)).sort();
  const ids = [...knownIds].filter((id) => !ex.deletedTestUserIds.has(id)).sort();
  return { uids, ids, knownDeleted, emails, sources, threads };
}

/**
 * @param {object} input
 * @param {(name: string, options?: {prefix?: string}) => Promise<{id: string, data: object}[]>} [input.listDocs]
 * @param {{getUser: Function, getUserByMemberId: Function, stats?: object}} [input.reader]  estimateOnly면 필요 없다
 * @param {object} input.exclusionRaw  비공개 제외 목록 JSON
 * @param {Object<string, string[]>|null} [input.deskIndex]  parseDeskExport().index
 * @param {boolean} [input.includeIngestIds]  수집기 conversationIdentities의 Channel id를 모두 조회
 * @param {boolean} [input.includeThreadIds]  수집기 threads 중 우리 고객 이메일과 같은 상담의 Channel id만 조회
 * @param {object} [input.snapshot]  이전 실행의 snapshot. 있는 Firestore·Channel 값은 다시 읽지 않는다
 * @param {boolean} [input.estimateOnly]  Channel을 호출하지 않고 예상 요청 수만 돌려준다
 * @param {number} [input.maxRequests]  예상 요청 수가 이보다 크면 Channel 호출 전에 멈춘다
 * @param {{testDomain: string}} input.config
 */
async function collectAndPlan({
  listDocs,
  reader,
  exclusionRaw,
  deskIndex = null,
  includeIngestIds = false,
  includeThreadIds = false,
  snapshot = null,
  estimateOnly = false,
  maxRequests = Infinity,
  config,
}) {
  const ex = normalizeExclusion(exclusionRaw);
  const docs = await readFirestore(readSnapshotOr(listDocs, snapshot), { includeIngestIds, includeThreadIds });
  const { base, counts, excludedMappings } = buildBase(docs, ex, config);
  const lookups = await planLookups(docs, ex, base, deskIndex);

  const cachedUsers = (snapshot && snapshot.channel && snapshot.channel.users) || {};
  const cachedMembers = (snapshot && snapshot.channel && snapshot.channel.membersByUid) || {};
  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const memberCalls = lookups.uids.filter((uid) => !has(cachedMembers, uid));
  const userCalls = lookups.ids.filter((id) => !has(cachedUsers, id));
  const estimate = {
    memberRequests: memberCalls.length,
    userRequests: userCalls.length,
    expected: memberCalls.length + userCalls.length,
    // 통합 고객은 최대 MAX_UNIFIED_HOPS단계까지 더 조회한다.
    upperBound: memberCalls.length + userCalls.length * (1 + MAX_UNIFIED_HOPS),
    reusedFromSnapshot: { members: lookups.uids.length - memberCalls.length, users: lookups.ids.length - userCalls.length },
    skippedKnownDeletedTestIds: lookups.knownDeleted.length,
    idSources: lookups.sources,
    threads: lookups.threads,
  };
  const meta = {
    exclusionVersion: ex.version,
    channelIndexSource: deskIndex ? "desk_export+known_ids" : includeThreadIds || includeIngestIds ? "known_ids+ingest" : "known_ids_only",
    // Desk 내보내기 없이는 Channel에만 있는 고객을 다 알 수 없다. create_candidate는 잠정 후보다.
    channelIndexComplete: Boolean(deskIndex),
    counts,
    excludedMappings,
    unrecognizedProtected: ex.unrecognizedProtected,
    manualReviewEntries: ex.reviewEntries,
    estimate,
  };
  if (estimateOnly) return { meta };
  if (estimate.expected > maxRequests) {
    throw new Error(`예상 Channel 요청 ${estimate.expected}건이 상한 ${maxRequests}건을 넘어 조회 전에 멈췄습니다`);
  }

  const users = {};
  const membersByUid = {};
  for (const id of lookups.knownDeleted) users[id] = null;
  for (const uid of lookups.uids) {
    const member = has(cachedMembers, uid) ? cachedMembers[uid] : await reader.getUserByMemberId(uid);
    membersByUid[uid] = member;
    if (member && member.id) users[member.id] = member;
  }
  for (const start of lookups.ids) {
    let id = start;
    for (let hop = 0; hop <= MAX_UNIFIED_HOPS && id && !(id in users); hop += 1) {
      const user = has(cachedUsers, id) ? cachedUsers[id] : await reader.getUser(id);
      users[id] = user;
      id = user && user.type === "unified" ? user.unifiedId : null;
    }
  }

  const idsByEmail = {};
  for (const email of lookups.emails) {
    if (deskIndex && deskIndex[email]) idsByEmail[email] = [...deskIndex[email]];
  }
  for (const [id, user] of Object.entries(users)) {
    if (!user || user.type === "unified") continue;
    const email = userEmail(user);
    if (!lookups.emails.has(email)) continue;
    idsByEmail[email] = [...new Set([...(idsByEmail[email] || []), id])].sort();
  }

  const channel = { users: sortedObject(users), membersByUid: sortedObject(membersByUid) };
  const plan = await planMigration({ ...base, channel: { ...channel, idsByEmail: sortedObject(idsByEmail) } });
  meta.channelRequests = reader.stats || null;
  meta.reusedSnapshot = Boolean(snapshot);
  return { plan, meta, snapshot: { firestore: docs, channel } };
}

module.exports = {
  assertOutsideRepo,
  collectAndPlan,
  createReadOnlyReader,
  normalizeExclusion,
  parseDeskExport,
  readOnlyFetch,
  redactError,
};
