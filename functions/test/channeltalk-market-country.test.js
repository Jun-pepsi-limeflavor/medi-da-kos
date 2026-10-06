/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { EXISTING_OPTIONS, mapMarketCountry } = require("../channeltalk/market-country");

function values(raw) {
  return mapMarketCountry(raw).values;
}

test("기존 선택지 대응", () => {
  const cases = {
    "United States": "미국",
    "United States of America": "미국",
    USA: "미국",
    "U.S.A.": "미국",
    US: "미국",
    "U.S.": "미국",
    Canada: "캐나다",
    India: "인도",
    France: "프랑스",
    Philippines: "필리핀",
    "The Philippines": "필리핀",
    Switzerland: "스위스",
    Norway: "노르웨이",
    "United Arab Emirates": "UAE",
    UAE: "UAE",
    "U.A.E.": "UAE",
    Emirates: "UAE",
    "North America": "북미",
    Europe: "유럽",
    EU: "유럽",
    "European Union": "유럽",
    "Middle East": "중동",
    "Latin America": "중남미",
    LATAM: "중남미",
    "Central and South America": "중남미",
  };
  for (const [raw, option] of Object.entries(cases)) {
    assert.deepEqual(values(raw), [option], raw);
  }
});

test("기존 선택지 이름이 Desk 목록과 같다", () => {
  assert.deepEqual(EXISTING_OPTIONS.sort(), ["UAE", "노르웨이", "미국", "북미", "스위스", "유럽", "인도", "중남미", "중동", "캐나다", "프랑스", "필리핀"].sort());
});

test("국가는 국가로: 독일·오스트리아는 새 국가, DACH는 새 권역 DACH", () => {
  assert.deepEqual(values("Germany"), ["독일"]);
  assert.deepEqual(values("Austria"), ["오스트리아"]);
  assert.deepEqual(values("Switzerland"), ["스위스"]);
  assert.deepEqual(values("DACH"), ["DACH"]);
  assert.ok(!JSON.stringify(mapMarketCountry("DACH")).includes("독일 (DACH"));
});

test("새 국가는 짧은 한국어 이름 하나로 고정된다", () => {
  assert.deepEqual(values("South Korea"), ["한국"]);
  assert.deepEqual(values("Korea"), ["한국"]);
  assert.deepEqual(values("Republic of Korea"), ["한국"]);
  assert.deepEqual(values("Australia"), ["호주"]);
  assert.deepEqual(values("United Kingdom"), ["영국"]);
  assert.deepEqual(values("UK"), ["영국"]);
  assert.deepEqual(values("Turkey"), ["튀르키예"]);
  assert.deepEqual(values("Türkiye"), ["튀르키예"]);
  assert.deepEqual(values("South Africa"), ["남아공"]);
  assert.deepEqual(values("Saudi Arabia"), ["사우디아라비아"]);
  assert.deepEqual(values("KSA"), ["사우디아라비아"]);
  assert.deepEqual(values("ksa"), ["사우디아라비아"]);
  assert.deepEqual(values("Hong Kong"), ["홍콩"]);
});

test("명확한 새 권역", () => {
  assert.deepEqual(values("Asia"), ["아시아"]);
  assert.deepEqual(values("Southeast Asia"), ["동남아시아"]);
  assert.deepEqual(values("SEA"), ["동남아시아"]);
  assert.deepEqual(values("South America"), ["남미"]);
  assert.deepEqual(values("East Asia"), ["동아시아"]);
  assert.deepEqual(values("Africa"), ["아프리카"]);
  assert.deepEqual(values("Oceania"), ["오세아니아"]);
});

test("특정할 수 없는 값은 넣지 않는다", () => {
  for (const raw of ["Global", "Worldwide", "International", "Online", "World", "All"]) {
    assert.deepEqual(mapMarketCountry(raw), { values: null, reason: "not_specific" }, raw);
  }
});

test("범위가 애매한 권역, 도시·주, 두 글자 코드, 오타는 넣지 않는다", () => {
  for (const raw of ["America", "APAC", "Asia Pacific", "MENA", "GCC", "Nordics", "Scandinavia", "Dubai", "London", "California", "CA", "DE", "England", "Holland", "Untied States"]) {
    assert.deepEqual(mapMarketCountry(raw), { values: null, reason: "unrecognized" }, raw);
  }
});

test("빈 값", () => {
  assert.deepEqual(mapMarketCountry(""), { values: null, reason: "empty" });
  assert.deepEqual(mapMarketCountry("   "), { values: null, reason: "empty" });
  assert.deepEqual(mapMarketCountry(null), { values: null, reason: "empty" });
});

test("여러 값은 모두 명확할 때만 복수로 저장하고 중복은 하나로", () => {
  assert.deepEqual(values("USA, Canada"), ["미국", "캐나다"]);
  assert.deepEqual(values("Germany / Austria / Switzerland"), ["독일", "오스트리아", "스위스"]);
  assert.deepEqual(values("Europe and Middle East"), ["유럽", "중동"]);
  assert.deepEqual(values("USA & U.S."), ["미국"]);
  assert.deepEqual(values("Japan; Korea"), ["일본", "한국"]);
});

test("여러 값 중 하나라도 불명확하면 전체를 비운다", () => {
  assert.deepEqual(mapMarketCountry("USA, Global"), { values: null, reason: "not_specific" });
  assert.deepEqual(mapMarketCountry("USA, Dubai"), { values: null, reason: "unrecognized" });
});

test("대소문자와 공백을 무시한다", () => {
  assert.deepEqual(values("  united   STATES "), ["미국"]);
  assert.deepEqual(values("dach"), ["DACH"]);
});
