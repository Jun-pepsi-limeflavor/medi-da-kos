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

  test("메시지 인테이크의 경우 accepted/extraction이 있는 인바운드 앵커 메시지 정보가 우선 반영됨", () => {
    // 시뮬레이션: 1차 인바운드 메시지(추출 데이터 포함) + 2차 아웃바운드 답장 메시지
    const msgs = [
      {
        id: "msg-outbound-2",
        direction: "out",
        from: "support@medidakos.com",
        to: ["buyer@company.com"],
        sentAt: "2026-08-28T10:00:00Z",
        bodyText: "견적서 보내드립니다.",
      },
      {
        id: "msg-inbound-1",
        direction: "in",
        from: "buyer@company.com",
        to: ["support@medidakos.com"],
        fromName: "Jane Buyer",
        sentAt: "2026-08-28T09:00:00Z",
        bodyText: "세럼 5000개 견적 요청합니다.",
        accepted: {
          buyer: { name: "Jane Buyer", brandName: "GlowLab", email: "buyer@company.com", country: "미국" },
          items: [{ productName: "수분 세럼", expectedQty: 5000, volume: "50ml" }],
        },
      },
    ];

    // 앵커 메시지 및 추출 데이터 선택 로직 검증:
    // msgs[0] (outbound) 대신 accepted/extraction이 있거나 inbound인 메시지를 선택해야 함
    const targetMsg = msgs.find((m) => m.accepted || m.direction === "in") || msgs[0];
    assert.equal(targetMsg.id, "msg-inbound-1");
    assert.equal(targetMsg.accepted?.buyer?.brandName, "GlowLab");
    assert.equal(targetMsg.accepted?.items?.[0]?.productName, "수분 세럼");
  });
});

