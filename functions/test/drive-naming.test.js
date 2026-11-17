/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { briefFileName, briefFolderPath, cleanName } = require("../drive/naming");

test("폴더: 연/월/문의 폴더, KST 날짜·회사명 원문·contactId 앞 8자", () => {
  const p = briefFolderPath({
    contactId: "kR3x9QaBzzzz",
    companyName: "메디코스 메틱",
    createdAt: new Date("2026-11-17T03:00:00Z"),
    isTest: false,
  });
  assert.deepEqual(p, { segments: ["2026", "2026-11"], folderName: "2026-11-17_메디코스 메틱_kR3x9QaB" });
});

test("폴더: UTC 월말 밤은 KST 다음 달·다음 해로 간다", () => {
  const p = briefFolderPath({ contactId: "id", companyName: "A", createdAt: new Date("2026-12-31T16:30:00Z"), isTest: false });
  assert.deepEqual(p.segments, ["2027", "2027-01"]);
  assert.match(p.folderName, /^2027-01-01_A_id$/);
});

test("폴더: isTest 문의는 _test 아래, 회사명이 비면 unknown", () => {
  const p = briefFolderPath({ contactId: "abc", companyName: "  ", createdAt: new Date("2026-11-17T03:00:00Z"), isTest: true });
  assert.deepEqual(p.segments, ["_test", "2026", "2026-11"]);
  assert.equal(p.folderName, "2026-11-17_unknown_abc");
});

test("이름 정리: 경로·제어 문자는 _, 공백은 하나로, 길이 제한", () => {
  assert.equal(cleanName('A/B\\C:D*E?F"G<H>I|J\u0001K', 100), "A_B_C_D_E_F_G_H_I_J_K");
  assert.equal(cleanName("  Acme   Beauty \n Co ", 100), "Acme Beauty Co");
  assert.equal(cleanName("x".repeat(80), 60).length, 60);
});

test("파일: 01_ 번호 접두어와 원본 이름", () => {
  assert.equal(briefFileName(0, "brief.pdf"), "01_brief.pdf");
  assert.equal(briefFileName(2, "제안서/최종.pptx"), "03_제안서_최종.pptx");
  assert.equal(briefFileName(1, ""), "02_file");
});
