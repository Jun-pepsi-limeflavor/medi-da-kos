/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { NOTICE_SERVER_LEAD, buildNotes, formatKst } = require("../channeltalk/notes");

const receivedAt = "2026-10-01T07:32:11.000Z"; // 16:32 KST
const profileResult = { applied: ["email", "brandCompanyName"], skipped: { name: "no_field", moq: "not_exact_number", referralSource: "empty" }, truncated: [] };

const contact = {
  companyName: "Acme Beauty",
  email: "buyer@example.com",
  message: "We'd like to develop a vegan sunscreen.\nSecond line.",
  businessType: "Existing Beauty Brand",
  referralSource: "Social Media",
  utmSource: "google",
  utmMedium: "cpc",
  pageUrl: "https://medidakos.com/contact",
  gaClientId: "123.456",
  userAgent: "Mozilla/5.0",
  isTest: false,
  status: "submitted",
  createdAt: receivedAt,
};

const brief = {
  currentStep: 6,
  step1: { selection: "skincare" },
  step2: { selections: [{ group: "Bottle", items: ["Airless pump", "Dropper"] }] },
  step3: { logoFileName: "logo.png", logoDataUrl: "data:image/png;base64,AAAA" },
  step4: { volume: "50", unit: "ml", orderQuantity: "5000", orderQuantityTbd: false, sampleRequestDate: "2026-10-20", targetLaunchDate: "2026-12-01" },
  step5: { fragranceNotes: "citrus", unscented: false, fragranceFree: false, colorHex: "#7dd3fc", viscosity: "Light", textureNotes: "Silky", finishNotes: "Matte" },
  step6: { productName: "TEST Serum", vegan: true, functionalClaims: ["Brightening", "Hydrating"], conceptIngredients: "Niacinamide", restrictedIngredients: "", internationalCertifications: ["Vegan"] },
  shippingAddress: { recipientName: "Jane Doe", addressLine1: "1 Main St", addressLine2: "Apt 2", city: "Austin", stateOrProvince: "TX", postalCode: "78701", country: "United States", phone: "+15550100000" },
};

function lines(note) {
  return note.split("\n");
}

test("한국 시간 표기", () => {
  assert.equal(formatKst(receivedAt), "2026-10-01 16:32");
  assert.equal(formatKst("bad"), "-");
});

test("Contact: 첫 줄·접수 시각·섹션 순서·기록 줄", () => {
  const [note] = buildNotes({ kind: "contact", docId: "c1", data: contact, label: null, identitySource: "browser", receivedAt, profileResult });
  const l = lines(note);
  assert.equal(l[0], "[Contact 문의] Acme Beauty · buyer@example.com");
  assert.equal(l[1], "접수: 2026-10-01 16:32 KST");
  const order = ["■ 문의 내용", "■ 고객 정보", "■ 프로필 반영", "■ 기술 정보"].map((title) => note.indexOf(title));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.ok(order.every((index) => index > 0));
  assert.ok(note.includes("We'd like to develop a vegan sunscreen.\nSecond line."));
  assert.ok(note.includes("회원 여부: 비회원"));
  assert.ok(note.includes("UTM: source=google / medium=cpc / campaign=- / content=- / term=-"));
  assert.ok(note.includes("반영: 이메일, 회사명 / 미반영: 이름(폼에 항목 없음), MOQ(정확한 숫자 아님)"));
  assert.ok(!note.includes("referralSource(")); // 입력 없음은 미반영 목록에 넣지 않는다
  assert.ok(!note.includes("■ 기타 항목"));
  assert.equal(l[l.length - 1], "기록: contact/c1");
  assert.ok(!note.includes("[연동 참고]"));
});

test("[TEST]·[내부] 표시는 첫 줄 앞에 붙는다", () => {
  const [test1] = buildNotes({ kind: "contact", docId: "c1", data: contact, label: "[TEST]", receivedAt, profileResult });
  assert.ok(test1.startsWith("[TEST] [Contact 문의] "));
  const [internal] = buildNotes({ kind: "contact", docId: "c1", data: contact, label: "[내부]", receivedAt, profileResult });
  assert.ok(internal.startsWith("[내부] [Contact 문의] "));
});

test("server_lead일 때만 3번째 줄에 연동 참고 안내", () => {
  const [note] = buildNotes({ kind: "contact", docId: "c1", data: contact, label: null, identitySource: "server_lead", receivedAt, profileResult });
  assert.equal(lines(note)[2], NOTICE_SERVER_LEAD);
  for (const source of ["browser", "email_mapping", "member"]) {
    const [other] = buildNotes({ kind: "contact", docId: "c1", data: contact, identitySource: source, receivedAt, profileResult });
    assert.ok(!other.includes(NOTICE_SERVER_LEAD), source);
  }
});

test("Landing korea: 국가 항목 없음, 담당자가 회사명과 같으면 -, 예상 물량 라벨과 코드", () => {
  const [note] = buildNotes({
    kind: "landingRequests",
    docId: "l1",
    data: { landingVariant: "korea", companyName: "Acme Beauty", contactName: "Acme Beauty", email: "buyer@example.com", country: "Global", expectedVolume: "5k-10k", businessType: "Agency", referralSource: "Events", positioningArm: "arm-a", message: "" },
    receivedAt,
    profileResult,
  });
  assert.equal(lines(note)[0], "[Landing 문의 · korea] Acme Beauty · buyer@example.com");
  assert.ok(note.includes("담당자: -"));
  assert.ok(note.includes("국가: - (이 폼에는 국가 항목이 없음)"));
  assert.ok(note.includes("예상 물량: 5,000 – 10,000 units (5k-10k)"));
  assert.ok(note.includes("포지셔닝: arm-a"));
  assert.ok(note.includes("■ 메시지\n-"));
  assert.ok(note.endsWith("기록: landingRequests/l1"));
});

test("Landing catalog: 국가·수량 원문과 선택 제품 목록", () => {
  const [note] = buildNotes({
    kind: "landingRequests",
    docId: "l2",
    data: { landingVariant: "catalog", companyName: "Acme", contactName: "Jane Doe", email: "buyer@example.com", country: "United States", expectedVolume: "3,000~5,000", catalogItems: [{ id: "s1", name: "Pink Serum", category: "serum" }, { id: "t1", name: "Rose Toner", category: "toner" }] },
    receivedAt,
    profileResult,
  });
  assert.equal(lines(note)[0], "[Landing 문의 · catalog] Acme · Jane Doe");
  assert.ok(note.includes("국가(원문): United States"));
  assert.ok(note.includes("예상 수량(원문): 3,000~5,000"));
  assert.ok(note.includes("■ 선택 제품 (2)\n1. Pink Serum (serum) [s1]\n2. Rose Toner (toner) [t1]"));
});

test("Landing dashboard: 브리프 섹션과 마지막 단계", () => {
  const [note] = buildNotes({
    kind: "landingRequests",
    docId: "l3",
    data: { landingVariant: "dashboard", companyName: "Acme", contactName: "Jane", email: "buyer@example.com", country: "USA", expectedVolume: "5000", dashboardBrief: { ...brief, currentStep: 4 } },
    receivedAt,
    profileResult,
  });
  assert.ok(note.includes("■ 브리프 (비로그인 작성, 마지막 단계: 4)"));
  assert.ok(note.includes("1 카테고리: Skin Care (skincare)"));
  assert.ok(!note.includes("data:image")); // 로고 데이터는 남기지 않는다
});

test("Order: 첫 줄·참조·고객 정보·브리프 전체·배송지·시스템 요약", () => {
  const [note] = buildNotes({
    kind: "orders",
    docId: "order-1",
    orderId: "order-1",
    data: { uid: "uid-1", type: "custom", status: "submitted", title: "Custom ODM — Skin Care", summary: "Order quantity: 5,000", referenceId: "custom-uid-1-1", briefSnapshot: brief, createdAt: receivedAt },
    user: { displayName: "Jane Doe", email: "jane@example.com", phone: "5550100000", companyName: "Acme Beauty", country: "United States" },
    identitySource: "member",
    receivedAt,
    profileResult: { applied: ["product", "moq", "orderCount", "briefStatus"], skipped: { marketCountry: "already_set" }, truncated: [] },
    orderIndex: 1,
  });
  const l = lines(note);
  assert.equal(l[0], "[Brief 제출 · 주문 order-1] Custom ODM — Skin Care · Jane Doe (Acme Beauty)");
  assert.equal(l[1], "접수: 2026-10-01 16:32 KST · 참조: custom-uid-1-1");
  assert.ok(!note.includes("[연동 참고]"));
  for (const expected of [
    "이름: Jane Doe · 이메일: jane@example.com · 전화: 5550100000",
    "회사: Acme Beauty · 가입 국가(원문): United States",
    "2 패키징: Bottle — Airless pump, Dropper",
    "3 로고: 파일 logo.png · 미리보기 그룹 -",
    "4 용량: 50 ml · 주문 수량: 5000",
    "5 포뮬러: 향=citrus · 무향=아니오 · 향료 무첨가=아니오",
    "6 컴플라이언스: 제품명=TEST Serum · 비건=예",
    "   기능: Brightening, Hydrating",
    "   콘셉트 성분: Niacinamide · 제한 성분: -",
    "■ 배송지 (샘플 수령지)\nJane Doe · 1 Main St, Apt 2 · Austin, TX 78701 · United States · +15550100000",
    "■ 시스템 요약\nOrder quantity: 5,000",
    "반영: product, MOQ / 미반영: marketCountry(이미 값 있음) / 자동 갱신: 주문 수, briefStatus",
  ]) {
    assert.ok(note.includes(expected), expected);
  }
  assert.ok(!note.includes("■ 기술 정보"));
  assert.ok(!note.includes("data:image"));
  assert.ok(note.endsWith("기록: orders/order-1"));
});

test("Order: 두 번째 주문부터 3번째 줄에 안내", () => {
  const [note] = buildNotes({
    kind: "orders", docId: "o2", orderId: "o2", data: { title: "T", briefSnapshot: brief }, user: {}, receivedAt, profileResult, orderIndex: 2,
  });
  assert.equal(lines(note)[2], "[연동 참고] 이 고객의 2번째 주문입니다. 프로필 값은 자동으로 바뀌지 않으니 필요하면 확인 후 수정하세요.");
});

test("Order: 수량 미정 표시", () => {
  const [note] = buildNotes({
    kind: "orders", docId: "o3", orderId: "o3", data: { briefSnapshot: { ...brief, step4: { ...brief.step4, orderQuantityTbd: true } } }, user: {}, receivedAt, profileResult,
  });
  assert.ok(note.includes("주문 수량: 미정(TBD)"));
});

test("템플릿에 없는 필드는 기타 항목에 남기고 연동 내부 상태값은 뺀다", () => {
  const [note] = buildNotes({ kind: "contact", docId: "c1", data: { ...contact, phoneExtra: "+1 555", nested: { a: 1 } }, receivedAt, profileResult });
  assert.ok(note.includes("■ 기타 항목\nnested: {\"a\":1}\nphoneExtra: +1 555"));
  assert.ok(!note.includes("isTest:"));
  assert.ok(!note.includes("serverCreatedAt:"));
});

test("브리프에 모르는 단계 필드가 있으면 그 단계 기타로 남긴다", () => {
  const [note] = buildNotes({
    kind: "orders", docId: "o4", orderId: "o4", data: { briefSnapshot: { ...brief, step5: { ...brief.step5, sparkle: "gold" }, extraTop: "x" } }, user: {}, receivedAt, profileResult,
  });
  assert.ok(note.includes("step5 기타: sparkle=gold"));
  assert.ok(note.includes("브리프 기타: extraTop=x"));
});

test("한도를 넘으면 섹션 경계에서 나누고 (n/m)과 부분별 기록 줄을 단다. 내용은 빠지지 않는다", () => {
  const long = { ...contact, message: Array.from({ length: 40 }, (_, i) => `line ${i} ${"m".repeat(40)}`).join("\n") };
  const notes = buildNotes({ kind: "contact", docId: "c9", data: long, label: "[TEST]", identitySource: "server_lead", receivedAt, profileResult }, { maxLength: 800 });
  assert.ok(notes.length >= 2);
  notes.forEach((note, index) => {
    assert.ok(note.length <= 800, `part ${index + 1} length ${note.length}`);
    const l = lines(note);
    assert.equal(l[0], `[TEST] [Contact 문의] Acme Beauty · buyer@example.com (${index + 1}/${notes.length})`);
    assert.equal(l[1], "접수: 2026-10-01 16:32 KST");
    assert.equal(l[l.length - 1], "기록: contact/c9");
  });
  assert.equal(lines(notes[0])[2], NOTICE_SERVER_LEAD);
  const joined = notes.join("\n");
  for (let i = 0; i < 40; i += 1) assert.ok(joined.includes(`line ${i} `), `line ${i}`);
  assert.ok(joined.includes("■ 기술 정보"));
});

test("한 줄이 한도보다 길어도 잘라서 모두 남긴다", () => {
  const huge = "Ж".repeat(3000);
  const notes = buildNotes({ kind: "contact", docId: "c10", data: { ...contact, message: huge }, receivedAt, profileResult }, { maxLength: 800 });
  assert.ok(notes.every((note) => note.length <= 800));
  const count = notes.join("").split("").filter((ch) => ch === "Ж").length;
  assert.equal(count, 3000);
});

test("한도 안이면 메시지는 하나다", () => {
  assert.equal(buildNotes({ kind: "contact", docId: "c1", data: contact, receivedAt, profileResult }).length, 1);
});
