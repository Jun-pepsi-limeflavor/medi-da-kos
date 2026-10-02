/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 내부대화(private note) 본문 (순수 함수).
 *
 * 규칙 원본: docs/plans/2026-10-01-channeltalk-crm-integration.md 3장.
 * - 1~2줄은 `[종류] 회사 · 고객`과 접수 시각. 진행중 목록 미리보기에 보인다.
 * - `[연동 참고]` 안내는 3번째 줄부터.
 * - 고객이 제출한 내용은 빠짐없이 남긴다. 템플릿에 없는 필드는 `■ 기타 항목`.
 * - 마지막 줄 `기록: {collection}/{docId}`는 재시도 때 중복 확인 표식이다.
 * - 한 메시지에 담을 수 없으면 섹션 경계에서 나누고 각 부분에 `(n/m)`과 `기록:` 줄을 둔다.
 */
const { CATEGORY_LABELS } = require("./profile");

// Channel 메시지 길이 한도는 아직 확인 전이다(구현 테스트에서 확인). 넉넉히 낮게 둔다.
const DEFAULT_MAX_NOTE_LENGTH = 4000;

// 원본: src/lib/contact-form-options.ts EXPECTED_VOLUMES (korea 랜딩 폼 선택지).
// functions는 앱 소스를 import할 수 없어 복사해 둔다. 폼 선택지를 추가·변경하면 여기도 같이 고쳐야 한다.
// 맞추지 않으면 새 코드값은 라벨 없이 코드 그대로 내부대화에 남는다.
const EXPECTED_VOLUME_LABELS = {
  "under-5k": "About 5,000 units",
  "5k-10k": "5,000 – 10,000 units",
  "10k-plus": "10,000 units and up",
  unsure: "Not sure yet",
};

const NOTICE_SERVER_LEAD = "[연동 참고] 브라우저 고객 식별 없이 접수된 문의입니다.";

const FIELD_LABELS = {
  name: "이름",
  email: "이메일",
  brandCompanyName: "회사명",
  mobileNumber: "휴대폰",
  marketCountry: "marketCountry",
  product: "product",
  moq: "MOQ",
  businessType: "businessType",
  referralSource: "referralSource",
  firstSource: "firstSource",
  firebaseUid: "firebaseUid",
  lastOrderId: "최근 주문 id",
  orderCount: "주문 수",
  lastCheckoutCompletedAt: "최근 주문 시각",
  briefStatus: "briefStatus",
  briefStep: "briefStep",
  briefStepLabel: "briefStepLabel",
};

const AUTO_FIELDS = new Set([
  "firebaseUid", "lastOrderId", "orderCount", "lastCheckoutCompletedAt",
  "briefStatus", "briefStep", "briefStepLabel",
]);

const SKIP_REASONS = {
  no_field: "폼에 항목 없음",
  already_set: "이미 값 있음",
  not_exact_number: "정확한 숫자 아님",
  not_specific: "특정 국가·권역 아님",
  unrecognized: "변환표에 없음",
  same_as_company: "회사명과 같음",
  no_country_code: "국가번호 없음",
  rejected_by_channel: "Channel이 번호 거부",
};

const CONTACT_KEYS = [
  "companyName", "email", "message", "referralSource", "businessType",
  "utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm",
  "pageUrl", "gaClientId", "userAgent", "uid", "channelUserId",
];
const LANDING_KEYS = [
  "landingVariant", "companyName", "contactName", "email", "country", "expectedVolume", "message",
  "catalogItems", "dashboardBrief", "referralSource", "businessType", "positioningArm",
  "utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm",
  "pageUrl", "gaClientId", "userAgent", "channelUserId",
];
const ORDER_KEYS = ["uid", "type", "title", "summary", "referenceId", "briefSnapshot", "updatedAt", "notionSync"];
// 연동이 쓰는 내부 상태값. 고객이 입력한 내용이 아니라 기타 항목에서 뺀다.
const META_KEYS = ["isTest", "status", "createdAt", "serverCreatedAt"];
const BRIEF_META_KEYS = [
  "uid", "currentStep", "requestType", "status", "createdAt", "updatedAt", "serverUpdatedAt",
  "step1", "step2", "step3", "step4", "step5", "step6", "shippingAddress",
];
const STEP_KEYS = {
  step1: ["selection", "category", "rndSurvey"],
  step2: ["selections"],
  step3: ["logoFileName", "logoDataUrl", "previewGroup"],
  step4: ["volume", "unit", "orderQuantity", "orderQuantityTbd", "moq", "sampleRequestDate", "targetLaunchDate", "shippingCountry"],
  step5: ["fragranceNotes", "unscented", "fragranceFree", "colorHex", "viscosity", "textureNotes", "finishNotes"],
  step6: ["productName", "vegan", "functionalClaims", "conceptIngredients", "restrictedIngredients", "internationalCertifications"],
};
const ADDRESS_KEYS = ["recipientName", "addressLine1", "addressLine2", "city", "stateOrProvince", "postalCode", "country", "phone"];

function isBlank(value) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "")
    || (Array.isArray(value) && value.length === 0);
}

function show(value) {
  if (isBlank(value)) return "-";
  if (typeof value === "boolean") return value ? "예" : "아니오";
  if (Array.isArray(value)) return value.map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item))).join(", ");
  if (typeof value === "object") {
    if (typeof value.toDate === "function") return value.toDate().toISOString();
    return JSON.stringify(value);
  }
  return String(value).trim();
}

function formatKst(value) {
  const ms = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(ms)) return "-";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(ms)).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function leftovers(data, known) {
  const skip = new Set([...known, ...META_KEYS]);
  return Object.keys(data || {})
    .filter((key) => !skip.has(key))
    .sort()
    .map((key) => `${key}: ${show(data[key])}`);
}

function extraFields(obj, known) {
  const skip = new Set(known);
  return Object.keys(obj || {})
    .filter((key) => !skip.has(key))
    .sort()
    .map((key) => `${key}=${show(obj[key])}`);
}

function technicalSection(data) {
  const lines = [
    `UTM: source=${show(data.utmSource)} / medium=${show(data.utmMedium)} / campaign=${show(data.utmCampaign)} / content=${show(data.utmContent)} / term=${show(data.utmTerm)}`,
    `페이지: ${show(data.pageUrl)}`,
    `GA: ${show(data.gaClientId)}`,
    `브라우저: ${show(data.userAgent)}`,
  ];
  if (!isBlank(data.channelUserId)) lines.push(`Channel 브라우저 id: ${show(data.channelUserId)}`);
  return { title: "■ 기술 정보", lines };
}

function profileSection(result) {
  const applied = (result && result.applied) || [];
  const skipped = (result && result.skipped) || {};
  const once = applied.filter((field) => !AUTO_FIELDS.has(field)).map((field) => FIELD_LABELS[field] || field);
  const auto = applied.filter((field) => AUTO_FIELDS.has(field)).map((field) => FIELD_LABELS[field] || field);
  const missed = Object.entries(skipped)
    .filter(([, reason]) => reason !== "empty")
    .map(([field, reason]) => `${FIELD_LABELS[field] || field}(${SKIP_REASONS[reason] || reason})`);
  let line = `반영: ${once.length ? once.join(", ") : "-"} / 미반영: ${missed.length ? missed.join(", ") : "-"}`;
  if (auto.length) line += ` / 자동 갱신: ${auto.join(", ")}`;
  return { title: "■ 프로필 반영", lines: [line] };
}

function categoryLabel(step1) {
  const value = (step1 && (step1.selection || step1.category)) || "";
  if (!value) return "-";
  return CATEGORY_LABELS[value] ? `${CATEGORY_LABELS[value]} (${value})` : value;
}

function briefLines(brief) {
  const b = brief || {};
  const s1 = b.step1 || {};
  const s2 = b.step2 || {};
  const s3 = b.step3 || {};
  const s4 = b.step4 || {};
  const s5 = b.step5 || {};
  const s6 = b.step6 || {};
  const lines = [`1 카테고리: ${categoryLabel(s1)}`];
  if (s1.rndSurvey && typeof s1.rndSurvey === "object") {
    lines.push(`   설문: ${Object.keys(s1.rndSurvey).sort().map((key) => `${key}: ${show(s1.rndSurvey[key])}`).join(" · ") || "-"}`);
  }
  const selections = Array.isArray(s2.selections) ? s2.selections : [];
  if (selections.length) {
    selections.forEach((selection, index) => {
      const items = Array.isArray(selection && selection.items) ? selection.items : [];
      lines.push(`${index === 0 ? "2 패키징: " : "   "}${show(selection && selection.group)} — ${show(items)}`);
    });
  } else {
    lines.push("2 패키징: -");
  }
  lines.push(`3 로고: 파일 ${show(s3.logoFileName)} · 미리보기 그룹 ${show(s3.previewGroup)}`);
  const quantity = s4.orderQuantityTbd === true ? "미정(TBD)" : show(s4.orderQuantity);
  lines.push(`4 용량: ${show(s4.volume)} ${isBlank(s4.unit) ? "" : show(s4.unit)}`.trimEnd() + ` · 주문 수량: ${quantity}`);
  lines.push(`   샘플 요청일: ${show(s4.sampleRequestDate)} · 출시 목표일: ${show(s4.targetLaunchDate)}`);
  if (!isBlank(s4.moq) || !isBlank(s4.shippingCountry)) {
    lines.push(`   MOQ(구버전): ${show(s4.moq)} · 배송 국가(구버전): ${show(s4.shippingCountry)}`);
  }
  lines.push(`5 포뮬러: 향=${show(s5.fragranceNotes)} · 무향=${show(s5.unscented)} · 향료 무첨가=${show(s5.fragranceFree)}`);
  lines.push(`   색=${show(s5.colorHex)} · 점도=${show(s5.viscosity)} · 질감=${show(s5.textureNotes)} · 마무리=${show(s5.finishNotes)}`);
  lines.push(`6 컴플라이언스: 제품명=${show(s6.productName)} · 비건=${show(s6.vegan)}`);
  lines.push(`   기능: ${show(s6.functionalClaims)}`);
  lines.push(`   콘셉트 성분: ${show(s6.conceptIngredients)} · 제한 성분: ${show(s6.restrictedIngredients)}`);
  lines.push(`   인증: ${show(s6.internationalCertifications)}`);

  for (const [step, known] of Object.entries(STEP_KEYS)) {
    const extra = extraFields(b[step], known);
    if (extra.length) lines.push(`   ${step} 기타: ${extra.join(" · ")}`);
  }
  const top = extraFields(b, BRIEF_META_KEYS);
  if (top.length) lines.push(`   브리프 기타: ${top.join(" · ")}`);
  return lines;
}

function addressLine(address) {
  const a = address || {};
  if (ADDRESS_KEYS.every((key) => isBlank(a[key]))) return "-";
  const street = [a.addressLine1, a.addressLine2].filter((part) => !isBlank(part)).map(show).join(", ") || "-";
  const region = [show(a.city), [a.stateOrProvince, a.postalCode].filter((part) => !isBlank(part)).map(show).join(" ")]
    .filter((part) => part && part !== "-").join(", ") || "-";
  const extra = extraFields(a, ADDRESS_KEYS);
  const line = `${show(a.recipientName)} · ${street} · ${region} · ${show(a.country)} · ${show(a.phone)}`;
  return extra.length ? `${line} · ${extra.join(" · ")}` : line;
}

function expectedVolumeKorea(value) {
  if (isBlank(value)) return "-";
  const code = String(value).trim();
  return EXPECTED_VOLUME_LABELS[code] ? `${EXPECTED_VOLUME_LABELS[code]} (${code})` : code;
}

function koreaCountry(value) {
  if (isBlank(value) || String(value).trim().toLowerCase() === "global") return "- (이 폼에는 국가 항목이 없음)";
  return show(value);
}

function contactNote(data) {
  return {
    line1: `[Contact 문의] ${show(data.companyName)} · ${show(data.email)}`,
    sections: [
      { title: "■ 문의 내용", lines: [show(data.message)] },
      {
        title: "■ 고객 정보",
        lines: [
          `회사/브랜드: ${show(data.companyName)}`,
          `이메일: ${show(data.email)}`,
          `회원 여부: ${isBlank(data.uid) ? "비회원" : `회원 (${show(data.uid)})`}`,
          `비즈니스 유형: ${show(data.businessType)}`,
          `유입 경로(고객 선택): ${show(data.referralSource)}`,
        ],
      },
    ],
    leftover: leftovers(data, CONTACT_KEYS),
    technical: technicalSection(data),
  };
}

function landingNote(data) {
  const variant = show(data.landingVariant);
  const contact = isBlank(data.contactName)
    || String(data.contactName).trim().toLowerCase() === String(data.companyName || "").trim().toLowerCase()
    ? "-"
    : show(data.contactName);
  const who = contact !== "-" ? contact : show(data.email);
  const sections = [{ title: "■ 메시지", lines: [show(data.message)] }];
  const info = [`회사/브랜드: ${show(data.companyName)}`, `담당자: ${contact}`, `이메일: ${show(data.email)}`];

  if (variant === "korea") {
    info.push(
      `국가: ${koreaCountry(data.country)}`,
      `비즈니스 유형: ${show(data.businessType)}`,
      `유입 경로(고객 선택): ${show(data.referralSource)}`,
      `예상 물량: ${expectedVolumeKorea(data.expectedVolume)}`,
      `포지셔닝: ${show(data.positioningArm)}`,
    );
    sections.push({ title: "■ 고객 정보", lines: info });
  } else {
    info.push(`국가(원문): ${show(data.country)}`, `예상 수량(원문): ${show(data.expectedVolume)}`);
    if (variant !== "catalog" && variant !== "dashboard") {
      info.push(`비즈니스 유형: ${show(data.businessType)}`, `유입 경로(고객 선택): ${show(data.referralSource)}`);
    }
    sections.push({ title: "■ 고객 정보", lines: info });
    if (variant === "catalog") {
      const items = Array.isArray(data.catalogItems) ? data.catalogItems : [];
      sections.push({
        title: `■ 선택 제품 (${items.length})`,
        lines: items.length
          ? items.map((item, index) => `${index + 1}. ${show(item && item.name)} (${show(item && item.category)})${item && item.id ? ` [${item.id}]` : ""}`)
          : ["-"],
      });
    }
    if (variant === "dashboard") {
      const brief = data.dashboardBrief || {};
      sections.push({
        title: `■ 브리프 (비로그인 작성, 마지막 단계: ${show(brief.currentStep)})`,
        lines: [...briefLines(brief), `배송지: ${addressLine(brief.shippingAddress)}`],
      });
    }
  }
  return {
    line1: `[Landing 문의 · ${variant}] ${show(data.companyName)} · ${who}`,
    sections,
    leftover: leftovers(data, LANDING_KEYS),
    technical: technicalSection(data),
  };
}

function orderNote(data, { orderId, user }) {
  const u = user || {};
  const brief = data.briefSnapshot || {};
  const name = show(u.displayName);
  const company = isBlank(u.companyName) ? "" : ` (${show(u.companyName)})`;
  return {
    line1: `[Brief 제출 · 주문 ${show(orderId)}] ${show(data.title)} · ${name}${company}`,
    line2Suffix: ` · 참조: ${show(data.referenceId)}`,
    sections: [
      {
        title: "■ 고객 정보 (회원)",
        lines: [
          `이름: ${name} · 이메일: ${show(u.email)} · 전화: ${show(u.phone)}`,
          `회사: ${show(u.companyName)} · 가입 국가(원문): ${show(u.country)}`,
        ],
      },
      { title: "■ 브리프", lines: briefLines(brief) },
      { title: "■ 배송지 (샘플 수령지)", lines: [addressLine(brief.shippingAddress)] },
      { title: "■ 시스템 요약", lines: [show(data.summary)] },
    ],
    leftover: leftovers(data, ORDER_KEYS),
    technical: null,
  };
}

function sectionText(section) {
  return [section.title, ...section.lines].join("\n");
}

/** 한 섹션이 한도를 넘으면 줄 단위로, 한 줄이 넘으면 글자 단위로 나눈다. 내용은 버리지 않는다. */
function fitSection(section, budget) {
  if (sectionText(section).length <= budget) return [section];
  const pieces = [];
  let current = { title: section.title, lines: [] };
  const lines = section.lines.flatMap((line) => {
    if (line.length <= budget - section.title.length - 20) return [line];
    const size = Math.max(1, budget - section.title.length - 20);
    const chunks = [];
    for (let i = 0; i < line.length; i += size) chunks.push(line.slice(i, i + size));
    return chunks;
  });
  for (const line of lines) {
    const next = { title: current.title, lines: [...current.lines, line] };
    if (current.lines.length && sectionText(next).length > budget) {
      pieces.push(current);
      current = { title: `${section.title} (계속)`, lines: [line] };
    } else {
      current = next;
    }
  }
  if (current.lines.length) pieces.push(current);
  return pieces;
}

/**
 * @param {object} input
 * @param {"contact"|"landingRequests"|"orders"} input.kind
 * @param {string} input.docId
 * @param {object} input.data
 * @param {string|null} input.label            "[TEST]" | "[내부]" | null
 * @param {string|null} input.identitySource   server_lead일 때만 안내 줄
 * @param {number|string} input.receivedAt
 * @param {object} input.profileResult         buildProfileUpdate().result
 * @param {number} [input.orderIndex]          이 고객의 몇 번째 주문인지
 * @param {string} [input.orderId]
 * @param {object} [input.user]                orders일 때 users 문서
 * @param {{maxLength?: number}} [options]
 * @returns {string[]} 내부대화 메시지 목록(보통 1개)
 */
function buildNotes(input, options = {}) {
  const maxLength = options.maxLength || DEFAULT_MAX_NOTE_LENGTH;
  const data = input.data || {};
  let note;
  if (input.kind === "contact") note = contactNote(data);
  else if (input.kind === "landingRequests") note = landingNote(data);
  else if (input.kind === "orders") note = orderNote(data, input);
  else throw new Error(`지원하지 않는 제출 종류: ${input.kind}`);

  const line1 = input.label ? `${input.label} ${note.line1}` : note.line1;
  const line2 = `접수: ${formatKst(input.receivedAt)} KST${note.line2Suffix || ""}`;
  const notices = [];
  if (input.identitySource === "server_lead") notices.push(NOTICE_SERVER_LEAD);
  if (input.kind === "orders" && Number.isSafeInteger(input.orderIndex) && input.orderIndex >= 2) {
    notices.push(`[연동 참고] 이 고객의 ${input.orderIndex}번째 주문입니다. 프로필 값은 자동으로 바뀌지 않으니 필요하면 확인 후 수정하세요.`);
  }
  const collection = input.kind;
  const footer = `기록: ${collection}/${input.docId}`;

  const sections = [...note.sections, profileSection(input.profileResult)];
  if (note.technical) sections.push(note.technical);
  if (note.leftover.length) sections.push({ title: "■ 기타 항목", lines: note.leftover });

  const render = (head, body) => [...head, "", ...body.map(sectionText).flatMap((text) => [text, ""]), footer].join("\n");
  const single = render([line1, line2, ...notices], sections);
  if (single.length <= maxLength) return [single];

  // 나눠야 한다. 머리말("(99/99)" 자리 포함)과 꼬리말을 뺀 만큼을 섹션 예산으로 쓴다.
  const headLength = [`${line1} (99/99)`, line2, ...notices].join("\n").length + footer.length + 4;
  const budget = Math.max(200, maxLength - headLength);
  const pieces = sections.flatMap((section) => fitSection(section, budget));
  const groups = [];
  let current = [];
  for (const piece of pieces) {
    const length = [...current, piece].map(sectionText).join("\n\n").length;
    if (current.length && length > budget) {
      groups.push(current);
      current = [piece];
    } else {
      current.push(piece);
    }
  }
  if (current.length) groups.push(current);

  const total = groups.length;
  return groups.map((group, index) => {
    const head = [`${line1} (${index + 1}/${total})`, line2];
    if (index === 0) head.push(...notices);
    return render(head, group);
  });
}

module.exports = {
  DEFAULT_MAX_NOTE_LENGTH,
  NOTICE_SERVER_LEAD,
  buildNotes,
  formatKst,
};
