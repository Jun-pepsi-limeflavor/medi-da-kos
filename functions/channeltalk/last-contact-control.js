/**
 * lastContactAt 쓰기 중단 플래그(Firestore). 함수가 재시작돼도 유지된다.
 *
 * 문서: channelTalkControl/lastContact (고객 데이터 컬렉션과 분리, 클라이언트 접근 금지 rules)
 *   { halted: bool, reason: string|null, fields: string[], channelUserId: string|null,
 *     haltedAt: Timestamp|null, haltCount: number, resumedAt: Timestamp|null, resumedBy: string|null, updatedAt }
 * - 문서가 없으면 중단 아님(처음 상태). 읽기에 실패하면 호출 쪽이 쓰기를 막는다(fail-closed).
 * - 중단은 처리기가 이상을 감지했을 때만 기록한다. 해제는 관리자가 확인 뒤 resume으로만 한다.
 */
const COLLECTION = "channelTalkControl";
const DOC_ID = "lastContact";

function createLastContactControl(db, { Timestamp, FieldValue }) {
  if (!db || !Timestamp || !FieldValue) throw new TypeError("db, Timestamp and FieldValue are required");
  const ref = db.collection(COLLECTION).doc(DOC_ID);

  return {
    /** 중단 상태면 true. 읽기 오류는 그대로 던진다(호출 쪽이 fail-closed로 처리). */
    async isHalted() {
      const snap = await ref.get();
      if (!snap.exists) return false;
      const halted = snap.get("halted");
      // 값이 boolean이 아니면 손상된 상태로 보고 중단으로 취급한다.
      return halted !== false;
    },

    /** 이상 감지 시 중단을 기록한다. 이미 중단이면 최초 사유는 유지하고 횟수만 늘린다. */
    async halt({ reason, fields = [], channelUserId = null, nowMs }) {
      const now = Timestamp.fromMillis(nowMs);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const already = snap.exists && snap.get("halted") === true;
        tx.set(ref, {
          halted: true,
          ...(already ? {} : { reason: String(reason || "unknown"), fields: fields.map(String).slice(0, 50), channelUserId, haltedAt: now }),
          haltCount: FieldValue.increment(1),
          resumedAt: null,
          resumedBy: null,
          updatedAt: now,
        }, { merge: true });
      });
    },

    /** 관리자 수동 해제. 확인한 사람을 남긴다. */
    async resume({ resumedBy, nowMs }) {
      if (typeof resumedBy !== "string" || !resumedBy.trim()) throw new TypeError("resumedBy is required");
      const now = Timestamp.fromMillis(nowMs);
      await ref.set({ halted: false, resumedAt: now, resumedBy: resumedBy.trim(), updatedAt: now }, { merge: true });
    },

    /** 상태 요약(고객 id 제외). */
    async status() {
      const snap = await ref.get();
      if (!snap.exists) return { exists: false, halted: false };
      const d = snap.data();
      return {
        exists: true,
        halted: d.halted !== false,
        reason: d.reason || null,
        fields: d.fields || [],
        haltCount: d.haltCount || 0,
        haltedAt: d.haltedAt ? d.haltedAt.toMillis() : null,
        resumedAt: d.resumedAt ? d.resumedAt.toMillis() : null,
        resumedBy: d.resumedBy || null,
      };
    },
  };
}

module.exports = {
  COLLECTION,
  DOC_ID,
  createLastContactControl,
};
