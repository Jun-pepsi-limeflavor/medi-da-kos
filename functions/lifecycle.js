/**
 * 이탈 복구·육성 트랙 — 세그먼트 판정 로직 (순수 함수만).
 *
 * Firestore·Functions에 의존하지 않는다. index.js가 데이터를 읽어 넘기고,
 * 여기서는 분류만 한다 — 실데이터 픽스처로 검증할 수 있게 하려는 분리다.
 *
 * 판정 규칙의 원본은 위키 「UTM 명명 규칙 — 아웃바운드·콘텐츠 채널」이고,
 * 같은 로직의 파이썬 판이 `context/콜드메일/utm_links.py`에 있다(마케팅 쪽에서
 * 링크를 손으로 뽑을 때 씀). 둘이 갈리면 안 되므로 규칙을 바꿀 때 양쪽을 본다.
 */

// 위저드 단계 번호 → 세그먼트 이름. 번호가 아니라 뜻으로 부르는 이유:
// 위저드 순서가 바뀌면 숫자가 조용히 다른 질문을 가리키고 지난 데이터와
// 비교가 깨진다.
const BRIEF_STEP_SEGMENTS = {
  1: "brief-category",
  2: "brief-packaging",
  3: "brief-branding",
  4: "brief-quantity",
  5: "brief-formula",
  6: "brief-compliance",
};

const SEGMENT_LABELS = {
  signup: "가입만 함 (브리프 미착수)",
  "brief-category": "1 카테고리에서 막힘",
  "brief-packaging": "2 패키징에서 막힘",
  "brief-branding": "3 로고에서 막힘",
  "brief-quantity": "4 수량·일정에서 막힘",
  "brief-formula": "5 질감·향에서 막힘",
  "brief-compliance": "6 규제·인증에서 막힘",
  "brief-complete": "6단계까지 다 썼는데 미제출",
};

// 표시 순서. 뒤 단계일수록 진지한 사람이라 위로 올린다.
const SEGMENT_ORDER = [
  "brief-complete",
  "brief-compliance",
  "brief-formula",
  "brief-quantity",
  "brief-branding",
  "brief-packaging",
  "brief-category",
  "signup",
];

// 내부 계정. 도메인만으로는 안 걸린다 — 팀원 둘이 개인 gmail로 가입해 있다
// (2026-08-06 실측). 도메인 필터만 믿으면 우리끼리 육성 메일을 받는다.
const INTERNAL_DOMAINS = ["@techasset.co.kr"];
const INTERNAL_EMAILS = [
  "a26070434@gmail.com", // 이기욱
  "zudiex.kr@gmail.com", // 김형선
  "spamofvc@gmail.com", // 스팸 테스트 계정
];

function isInternal(email) {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (INTERNAL_EMAILS.includes(normalized)) return true;
  return INTERNAL_DOMAINS.some((domain) => normalized.endsWith(domain));
}

/**
 * 값이 실제로 채워졌는가. 로고 base64(`logoDataUrl`)는 판정에서 뺀다 —
 * 용량만 크고, 어차피 같은 단계의 `logoFileName`이 존재 여부를 알려준다.
 */
function isFilled(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some(isFilled);
  if (typeof value === "object") {
    return Object.entries(value).some(
      ([key, inner]) => key !== "logoDataUrl" && isFilled(inner)
    );
  }
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return value;
  return true;
}

/**
 * 브리프가 실제로 막힌 단계. 연속으로 채워진 마지막 단계 + 1.
 *
 * `currentStep`을 쓰지 않는다. 위저드의 다음 버튼이 값 검증 없이 올려서,
 * 아무것도 안 쓴 사람이 3단계로 기록돼 있다(2026-08-06 Beautyfinds 실측).
 * 1~6이 전부 채워졌으면 null — 그건 이탈이 아니라 미제출이다.
 */
function stalledStep(brief) {
  for (let step = 1; step <= 6; step += 1) {
    if (!isFilled(brief[`step${step}`])) return step;
  }
  return null;
}

function daysBetween(fromIso, nowMs) {
  if (!fromIso) return null;
  const then = Date.parse(fromIso);
  if (Number.isNaN(then)) return null;
  // 음수로 내려가지 않게 자른다. 서버 시각과 클라이언트가 쓴 createdAt이
  // 몇 초 어긋나면 방금 가입한 사람이 "-1일"로 표시된다.
  return Math.max(0, Math.floor((nowMs - then) / 86400000));
}

/**
 * 육성 대상 명단을 만든다.
 *
 * @param {Array} users        `users` 문서 배열 (각각 `id` 포함)
 * @param {Map}   briefsByUid  uid → `cmBriefs` 문서
 * @param {Set}   customerUids 주문·샘플요청 이력이 있는 uid (= 이미 고객)
 * @param {Map}   contactsByUid uid → 지금까지 보낸 육성 메일 기록 배열
 * @param {number} nowMs
 */
function buildLifecycleList({
  users,
  briefsByUid,
  customerUids,
  contactsByUid = new Map(),
  nowMs = Date.now(),
}) {
  const rows = [];
  const skipped = { internal: 0, customer: 0, submitted: 0 };

  for (const user of users) {
    const email = (user.email || "").trim().toLowerCase();

    if (isInternal(email)) {
      skipped.internal += 1;
      continue;
    }
    // 이미 주문·샘플요청을 낸 사람은 고객이지 이탈자가 아니다. 브리프 단계만
    // 보면 Rosangela처럼 샘플까지 받은 사람에게 "브리프 마저 쓰세요"가 나간다.
    if (customerUids.has(user.id)) {
      skipped.customer += 1;
      continue;
    }

    const brief = briefsByUid.get(user.id);

    if (brief && brief.status === "submitted") {
      skipped.submitted += 1;
      continue;
    }

    let segment;
    let step = null;
    if (!brief) {
      segment = "signup";
    } else {
      step = stalledStep(brief);
      segment = step === null ? "brief-complete" : BRIEF_STEP_SEGMENTS[step];
    }

    const lastActivity = (brief && brief.updatedAt) || user.createdAt || null;
    const contacts = contactsByUid.get(user.id) || [];
    const lastContact = contacts.length
      ? contacts.map((c) => c.sentAt).sort().slice(-1)[0]
      : null;

    rows.push({
      uid: user.id,
      email: user.email || "",
      displayName: user.displayName || "",
      segment,
      segmentLabel: SEGMENT_LABELS[segment] || segment,
      stalledStep: step,
      signedUpAt: user.createdAt || null,
      lastActivity,
      idleDays: daysBetween(lastActivity, nowMs),
      touchesSent: contacts.length,
      lastContact,
      // 다음에 보낼 회차. 3통까지 돌고 끝낸다.
      nextTouch: contacts.length >= 3 ? null : contacts.length + 1,
    });
  }

  rows.sort((a, b) => {
    const bySegment =
      SEGMENT_ORDER.indexOf(a.segment) - SEGMENT_ORDER.indexOf(b.segment);
    if (bySegment !== 0) return bySegment;
    return (b.idleDays || 0) - (a.idleDays || 0);
  });

  return { rows, skipped };
}

module.exports = {
  BRIEF_STEP_SEGMENTS,
  SEGMENT_LABELS,
  SEGMENT_ORDER,
  isInternal,
  isFilled,
  stalledStep,
  buildLifecycleList,
};
