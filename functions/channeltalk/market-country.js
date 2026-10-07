/**
 * marketCountry 변환표 (순수 함수).
 *
 * 규칙 원본: docs/plans/2026-10-01-channeltalk-crm-integration.md 4장 `marketCountry`.
 * - 국가 입력은 국가로, 권역 입력은 권역으로. 다른 권역이나 묶음으로 옮기지 않는다.
 * - 값은 Channel List 선택지 이름이다. 없는 이름을 보내면 선택지가 새로 생기므로
 *   같은 나라가 여러 이름으로 생기지 않게 결과를 여기서 하나로 고정한다.
 * - 기존 `독일 (DACH: 독일·오스트리아·스위스 타겟)` 선택지는 쓰지 않는다.
 * 배포 전 검토 대상이다.
 */

// Desk에 이미 있는 선택지 (2026-10-01 기준, 테스트국가 제외)
const EXISTING = {
  미국: ["united states", "united states of america", "usa", "us"],
  캐나다: ["canada"],
  인도: ["india"],
  프랑스: ["france"],
  필리핀: ["philippines"],
  스위스: ["switzerland", "swiss confederation"],
  노르웨이: ["norway"],
  UAE: ["united arab emirates", "uae", "emirates"],
  북미: ["north america"],
  유럽: ["europe", "eu", "european union"],
  중동: ["middle east"],
  중남미: ["latin america", "latam", "central and south america"],
};

// 처음 들어오면 새 선택지가 생기는 국가. 실무에서 쓰는 짧은 한국어 국가명 하나로 고정한다.
const NEW_COUNTRIES = {
  한국: ["korea", "south korea", "republic of korea"],
  호주: ["australia"],
  영국: ["united kingdom", "uk", "great britain"],
  일본: ["japan"],
  중국: ["china", "people's republic of china"],
  대만: ["taiwan"],
  홍콩: ["hong kong"],
  베트남: ["vietnam", "viet nam"],
  태국: ["thailand"],
  싱가포르: ["singapore"],
  말레이시아: ["malaysia"],
  인도네시아: ["indonesia"],
  독일: ["germany"],
  오스트리아: ["austria"],
  네덜란드: ["netherlands"],
  벨기에: ["belgium"],
  이탈리아: ["italy"],
  스페인: ["spain"],
  포르투갈: ["portugal"],
  아일랜드: ["ireland"],
  그리스: ["greece"],
  스웨덴: ["sweden"],
  덴마크: ["denmark"],
  핀란드: ["finland"],
  폴란드: ["poland"],
  체코: ["czechia", "czech republic"],
  헝가리: ["hungary"],
  루마니아: ["romania"],
  러시아: ["russia"],
  우크라이나: ["ukraine"],
  튀르키예: ["turkey", "türkiye", "turkiye"],
  사우디아라비아: ["saudi arabia", "ksa"],
  카타르: ["qatar"],
  쿠웨이트: ["kuwait"],
  바레인: ["bahrain"],
  오만: ["oman"],
  요르단: ["jordan"],
  레바논: ["lebanon"],
  이스라엘: ["israel"],
  이집트: ["egypt"],
  모로코: ["morocco"],
  나이지리아: ["nigeria"],
  케냐: ["kenya"],
  남아공: ["south africa"],
  파키스탄: ["pakistan"],
  방글라데시: ["bangladesh"],
  스리랑카: ["sri lanka"],
  네팔: ["nepal"],
  몽골: ["mongolia"],
  카자흐스탄: ["kazakhstan"],
  우즈베키스탄: ["uzbekistan"],
  캄보디아: ["cambodia"],
  미얀마: ["myanmar"],
  라오스: ["laos"],
  뉴질랜드: ["new zealand"],
  브라질: ["brazil"],
  멕시코: ["mexico"],
  아르헨티나: ["argentina"],
  칠레: ["chile"],
  콜롬비아: ["colombia"],
  페루: ["peru"],
};

// 처음 들어오면 새 선택지가 생기는 명확한 권역
const NEW_REGIONS = {
  DACH: ["dach"],
  아시아: ["asia"],
  동남아시아: ["southeast asia", "south east asia", "sea"],
  남미: ["south america"],
  동아시아: ["east asia"],
  아프리카: ["africa"],
  오세아니아: ["oceania"],
};

// 특정 국가·권역으로 확정할 수 없는 값. 원문만 내부대화에 남긴다.
const NOT_SPECIFIC = new Set(["global", "worldwide", "international", "online", "world", "all"]);

const LOOKUP = new Map();
for (const table of [EXISTING, NEW_COUNTRIES, NEW_REGIONS]) {
  for (const [option, aliases] of Object.entries(table)) {
    for (const alias of aliases) LOOKUP.set(alias, option);
  }
}

function normalizeKey(value) {
  return value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the /, "");
}

function lookup(value) {
  const key = normalizeKey(value);
  if (!key) return { option: null, reason: "empty" };
  if (NOT_SPECIFIC.has(key)) return { option: null, reason: "not_specific" };
  const option = LOOKUP.get(key);
  return option ? { option, reason: null } : { option: null, reason: "unrecognized" };
}

/**
 * @returns {{ values: string[]|null, reason: string|null }}
 *   values가 null이면 프로필에 넣지 않는다. reason은 empty / not_specific / unrecognized.
 */
function mapMarketCountry(raw) {
  if (typeof raw !== "string" || !raw.trim()) return { values: null, reason: "empty" };

  // "Central and South America"처럼 구분자가 이름에 들어간 경우를 먼저 본다.
  const whole = lookup(raw);
  if (whole.option) return { values: [whole.option], reason: null };

  const parts = raw.split(/\s*(?:[,/&;]|\band\b)\s*/i).filter((part) => part.trim());
  if (parts.length < 2) return { values: null, reason: whole.reason };

  const values = [];
  for (const part of parts) {
    const result = lookup(part);
    if (!result.option) return { values: null, reason: result.reason };
    if (!values.includes(result.option)) values.push(result.option);
  }
  return { values, reason: null };
}

module.exports = {
  EXISTING_OPTIONS: Object.keys(EXISTING),
  mapMarketCountry,
};
