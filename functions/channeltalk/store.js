/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * channelTalkSync·channelTalkIdentities와 원본 문서 접근 (Admin SDK).
 *
 * processor는 시각을 밀리초로 다룬다. 저장할 때 Timestamp로 바꾸고 읽을 때 다시 밀리초로 돌린다.
 * Timestamp·FieldValue는 호출하는 쪽의 firebase-admin에서 받는다(패키지 사본이 섞이지 않게).
 */
const { emailKey, normalizeEmail } = require("./email");
const { applyIdentityRecord, applyUnifiedRecord } = require("./identity");
const { decideClaim, isRetryDue, syncDocId } = require("./sync-state");
const { toMillis } = require("./field-types");

const SYNC = "channelTalkSync";
const IDENTITIES = "channelTalkIdentities";
const TIME_FIELDS = ["createdAt", "updatedAt", "nextRetryAt", "leaseUntil", "chatCreateStartedAt", "leadCreateStartedAt"];
const SOURCES = new Set(["users", "contact", "landingRequests", "orders"]);

function createStore(db, { Timestamp, FieldValue }) {
  if (!db || !Timestamp || !FieldValue) throw new TypeError("db, Timestamp and FieldValue are required");

  function toStored(fields) {
    const out = {};
    for (const [key, value] of Object.entries(fields)) {
      if (TIME_FIELDS.includes(key) && typeof value === "number") out[key] = Timestamp.fromMillis(value);
      else out[key] = value;
    }
    return out;
  }

  function toPlain(data) {
    if (!data) return null;
    const out = { ...data };
    for (const key of TIME_FIELDS) {
      if (out[key] !== undefined && out[key] !== null) out[key] = toMillis(out[key]);
    }
    return out;
  }

  function syncRef(source, docId) {
    return db.collection(SYNC).doc(syncDocId(source, docId));
  }

  function identityRef(email) {
    const key = emailKey(email);
    return key ? db.collection(IDENTITIES).doc(key) : null;
  }

  return {
    /** 처리권 잡기. decideClaim 결과를 트랜잭션 안에서 쓴다. */
    async claim(input) {
      const ref = syncRef(input.source, input.docId);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const existing = snap.exists ? toPlain(snap.data()) : null;
        const decision = decideClaim({ ...input, existing });
        if (decision.create) {
          tx.create(ref, toStored(decision.create));
          return { action: decision.action, doc: decision.create };
        }
        if (decision.patch) {
          tx.update(ref, toStored(decision.patch));
          return { action: decision.action, doc: { ...existing, ...decision.patch } };
        }
        return { action: decision.action, doc: existing };
      });
    },

    async getSync(source, docId) {
      const snap = await syncRef(source, docId).get();
      return snap.exists ? toPlain(snap.data()) : null;
    },

    /** patch 키에 "steps.chat"처럼 점 경로를 쓸 수 있다. */
    async updateSync(source, docId, patch, nowMs) {
      await syncRef(source, docId).update(toStored({ ...patch, updatedAt: nowMs }));
    },

    async getSourceDoc(source, docId) {
      if (!SOURCES.has(source)) throw new Error(`지원하지 않는 원천: ${source}`);
      const snap = await db.collection(source).doc(docId).get();
      return snap.exists ? snap.data() : null;
    },

    async getUserDoc(uid) {
      if (!uid) return null;
      const snap = await db.collection("users").doc(uid).get();
      return snap.exists ? snap.data() : null;
    },

    /** 이 회원의 주문 목록(id, isTest, createdAt). 주문 수와 몇 번째 주문인지 계산에 쓴다. */
    async listOrdersForUid(uid) {
      if (!uid) return [];
      const snap = await db.collection("orders").where("uid", "==", uid).get();
      return snap.docs.map((doc) => ({ id: doc.id, isTest: doc.get("isTest") === true, createdAt: doc.get("createdAt") || null }));
    },

    async getMapping(email) {
      const ref = identityRef(email);
      if (!ref) return null;
      const snap = await ref.get();
      return snap.exists ? toPlain(snap.data()) : null;
    },

    /**
     * 식별 결과를 매핑에 남긴다. 규칙은 identity.applyIdentityRecord.
     * - 대표가 없으면 이번 고객을 대표로, 다르면 otherChannelUserIds에 더한다.
     * - missingIds: 실제 404로 확인된 id. 대표가 그중 하나면 이번 고객으로 교체하고 missingChannelUserIds로 옮긴다.
     * - unified: { 옛 id: 최종 고객 id }. 대표가 통합된 id여도 이번 고객으로 교체한다.
     * - 우리 uid로 식별한 회원일 때만 uid·memberId를 쓴다.
     */
    async recordIdentity({ email, channelUserId, origin, uid = null, missingIds = [], unified = {}, nowMs }) {
      const ref = identityRef(email);
      if (!ref || !channelUserId) return null;
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const now = Timestamp.fromMillis(nowMs);
        if (!snap.exists) {
          const doc = {
            email: normalizeEmail(email),
            ...applyIdentityRecord(null, { channelUserId, origin, uid, missingIds, unified }),
            dupPairs: {},
            firstSource: null,
            createdAt: now,
            updatedAt: now,
          };
          tx.create(ref, doc);
          return toPlain(doc);
        }
        const data = snap.data();
        const patch = { ...applyIdentityRecord(data, { channelUserId, origin, uid, missingIds, unified }), updatedAt: now };
        tx.update(ref, patch);
        return toPlain({ ...data, ...patch });
      });
    },

    /**
     * 중복 판정에서 확인한 통합·사라짐을 매핑에 남긴다. 규칙은 identity.applyUnifiedRecord.
     * live: 살아 있고 이 이메일과 맞는 고객 { id: origin }. 대표가 그 고객으로 통합됐으면 대표를 바로 바꾼다.
     */
    async recordUnified({ email, unified = {}, missingIds = [], live = {}, nowMs }) {
      const ref = identityRef(email);
      if (!ref) return null;
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return null;
        const data = snap.data();
        const patch = { ...applyUnifiedRecord(data, { unified, missingIds, live }), updatedAt: Timestamp.fromMillis(nowMs) };
        tx.update(ref, patch);
        return toPlain({ ...data, ...patch });
      });
    },

    async setFirstSource(email, firstSource, nowMs) {
      const ref = identityRef(email);
      if (!ref || !firstSource) return;
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists && !snap.get("firstSource")) {
          tx.update(ref, { firstSource, updatedAt: Timestamp.fromMillis(nowMs) });
        }
      });
    },

    async setDupPairState(email, pairKey, state, nowMs) {
      const ref = identityRef(email);
      if (!ref) return;
      await ref.update({
        [`dupPairs.${pairKey}`]: { state, at: Timestamp.fromMillis(nowMs) },
        updatedAt: Timestamp.fromMillis(nowMs),
      });
    },

    /** 재시도 대상. nextRetryAt이 오래된 순으로 최대 limit건. failed·success·skipped는 nextRetryAt이 비어 있어 걸리지 않는다. */
    async listRetryDue(nowMs, limit) {
      const snap = await db
        .collection(SYNC)
        .where("nextRetryAt", "<=", Timestamp.fromMillis(nowMs))
        .orderBy("nextRetryAt", "asc")
        .limit(limit * 2)
        .get();
      return snap.docs
        .map((doc) => toPlain(doc.data()))
        .filter((doc) => isRetryDue(doc, nowMs))
        .slice(0, limit);
    },
  };
}

module.exports = {
  IDENTITIES,
  SYNC,
  createStore,
};
