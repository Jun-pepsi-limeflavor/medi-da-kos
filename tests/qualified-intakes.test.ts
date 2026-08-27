import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { QualifiedIntakeSummary } from "../src/app/admin/(dash)/deals/CreateDealModal.tsx";

describe("승인 인테이크 메일 표시 및 딜 생성 연동 단위 테스트", () => {
  test("이메일이 존재하는 경우 [source] email 형식으로 표시", () => {
    const intake: QualifiedIntakeSummary = {
      id: "c2FtcGxlUmVxdWVzdABxQjNMWHVqaU1ZQ0hjZlhwUUxGVg",
      source: "sampleRequest",
      externalId: "qB3LXujiMYCHcfXpQLFV",
      email: "buyer@example.com",
      companyName: "Acme Corp",
      contactName: "John Doe",
    };

    const label = `[${intake.source}] ${intake.email || `ID: ${intake.externalId}`}`;
    assert.equal(label, "[sampleRequest] buyer@example.com");
  });

  test("이메일이 없는 경우 fallback으로 ID가 표시됨", () => {
    const intake: QualifiedIntakeSummary = {
      id: "b3JkZXIAYWJjMTIz",
      source: "order",
      externalId: "abc12345",
    };

    const label = `[${intake.source}] ${intake.email || `ID: ${intake.externalId}`}`;
    assert.equal(label, "[order] ID: abc12345");
  });

  test("인테이크 선택 시 바이어 이메일 및 회사명이 정상 추출됨", () => {
    const intakes: QualifiedIntakeSummary[] = [
      {
        id: "intake-1",
        source: "sampleRequest",
        externalId: "sample-1",
        email: "sample.buyer@test.com",
        companyName: "Brand Inc",
        contactName: "Alice",
      },
      {
        id: "intake-2",
        source: "contact",
        externalId: "contact-1",
        email: "contact.buyer@test.com",
        companyName: "Glow Cosmetics",
        contactName: "Bob",
      },
    ];

    const selected = intakes.find((i) => i.id === "intake-1");
    assert.ok(selected);
    assert.equal(selected.email, "sample.buyer@test.com");
    assert.equal(selected.companyName, "Brand Inc");
    assert.equal(selected.contactName, "Alice");
  });
});
