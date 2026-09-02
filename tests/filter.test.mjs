import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldParse } from "../functions-ingest/filter.js";

const baseThread = {
  channel: "gmail_thomas",
  sourceAccount: "thomas@medidakoslabs.com",
  providerThreadId: "th_12345",
  linkState: "unlinked",
};

const validInboundMessage = {
  direction: "in",
  from: "buyer@cosmetics-brand.com",
  fromName: "Jane Doe",
  to: ["thomas@medidakoslabs.com"],
  subject: "Inquiry: OEM production for 5,000 units sunscreen",
  bodyText: "Hello Medidakos team, we are looking for a reliable OEM manufacturer to produce 5,000 units of moisturizing sunscreen.",
  sentAt: "2026-08-27T10:00:00.000Z",
};

test("1. 외부 발신자의 정상 인바운드 메일은 통과한다 (external_inbound)", () => {
  const result = shouldParse(baseThread, [validInboundMessage]);
  assert.deepEqual(result, {
    parse: true,
    reason: "external_inbound",
  });
});

test("2. 사내 도메인 발신자의 단순 사내 업무 메일은 차단한다 (internal_communication)", () => {
  const internalDomains = [
    "member@techasset.co.kr",
    "colleague@medidakoslabs.com",
    "admin@medidakos.com",
  ];

  for (const sender of internalDomains) {
    const internalMessage = {
      ...validInboundMessage,
      from: sender,
      subject: "주간 회의 일정 공유의 건",
      bodyText: "안녕하세요. 금주 주간 회의는 목요일 오후 3시 대회의실에서 진행될 예정입니다. 준비 부탁드립니다.",
    };
    const result = shouldParse(baseThread, [internalMessage]);
    assert.deepEqual(result, {
      parse: false,
      reason: "internal_communication",
    });
  }
});

test("3. 사내 계정이지만 바이어 문의를 전달(Fwd:)한 메일은 통과한다 (forwarded_inquiry)", () => {
  const forwardedMessage = {
    ...validInboundMessage,
    from: "colleague@medidakoslabs.com",
    subject: "Fwd: Inquiry: OEM production for 5,000 units sunscreen",
    bodyText: "---------- Forwarded message ---------\nFrom: buyer@cosmetics-brand.com\nSubject: Inquiry\n\nHello Medidakos team, we are looking for OEM production of 5000 units sunscreen.",
  };
  const result = shouldParse(baseThread, [forwardedMessage]);
  assert.deepEqual(result, {
    parse: true,
    reason: "forwarded_inquiry",
  });
});

test("4. 제목에 FW나 전달 표시가 있거나 본문에 전달 메시지 구분선이 있는 경우 통과한다 (forwarded_inquiry)", () => {
  const fwSubject = {
    ...validInboundMessage,
    from: "partner@techasset.co.kr",
    subject: "FW: 바이어 견적 문의 건 공유",
    bodyText: "토마스님, 일본 바이어로부터 스킨케어 3,000세트 OEM 견적 요청이 접수되어 전달드립니다.",
  };
  assert.deepEqual(shouldParse(baseThread, [fwSubject]), {
    parse: true,
    reason: "forwarded_inquiry",
  });

  const koreanFwdBody = {
    ...validInboundMessage,
    from: "colleague@medidakoslabs.com",
    subject: "바이어 문의 건 전달드립니다",
    bodyText: "---------- 전달된 메시지 ---------\n보낸사람: buyer@france-beauty.fr\n프랑스 현지 유통용 앰플 10,000개 생산 가능 여부 문의드립니다.",
  };
  assert.deepEqual(shouldParse(baseThread, [koreanFwdBody]), {
    parse: true,
    reason: "forwarded_inquiry",
  });
});

test("5. 봇/시스템 계정 발신자는 차단한다 (bot_sender)", () => {
  const botSenders = [
    "noreply@github.com",
    "no-reply@accounts.google.com",
    "donotreply@notification.slack.com",
    "do-not-reply@service.com",
    "mailer-daemon@relay.example.com",
    "postmaster@domain.com",
    "notifications@jira.atlassian.net",
  ];

  for (const bot of botSenders) {
    const botMsg = {
      ...validInboundMessage,
      from: bot,
      subject: "Security Notification & Updates",
      bodyText: "This is an automated notification regarding your recent security activities. Please do not reply.",
    };
    const result = shouldParse(baseThread, [botMsg]);
    assert.deepEqual(result, {
      parse: false,
      reason: "bot_sender",
    });
  }
});

test("6. 배달 실패(Undelivered Mail, Delivery Status Notification 등) 메일은 차단한다 (delivery_failure)", () => {
  const failSubjects = [
    "Undelivered Mail Returned to Sender",
    "Delivery Status Notification (Failure)",
    "Mail delivery failed: returning message to sender",
    "Failure Notice",
    "Returned mail: see transcript for details",
  ];

  for (const subject of failSubjects) {
    const failureMsg = {
      ...validInboundMessage,
      from: "mailer-daemon@googlemail.com",
      subject,
      bodyText: "This is the mail system at host mail.example.com. I'm sorry to have to inform you that your message could not be delivered.",
    };
    const result = shouldParse(baseThread, [failureMsg]);
    assert.deepEqual(result, {
      parse: false,
      reason: "delivery_failure",
    });
  }
});

test("7. 뉴스레터 또는 List-Unsubscribe 헤더/본문이 있는 메일은 차단한다 (newsletter)", () => {
  // 헤더에 List-Unsubscribe가 있는 경우
  const headerNewsletter = {
    ...validInboundMessage,
    headers: [{ name: "List-Unsubscribe", value: "<mailto:unsubscribe@newsletter.com>" }],
    subject: "Weekly Industry Trend Report & News",
    bodyText: "Check out the latest cosmetic market trends and supply chain insights for this month.",
  };
  assert.deepEqual(shouldParse(baseThread, [headerNewsletter]), {
    parse: false,
    reason: "newsletter",
  });

  // 본문에 unsubscribe 키워드가 있는 경우
  const bodyNewsletter = {
    ...validInboundMessage,
    subject: "Monthly Beauty News",
    bodyText: "Here is your monthly digest of cosmetic ingredients. Click here to unsubscribe from these promotional emails.",
  };
  assert.deepEqual(shouldParse(baseThread, [bodyNewsletter]), {
    parse: false,
    reason: "newsletter",
  });

  // 한국어 수신거부 안내가 포함된 경우
  const koreanNewsletter = {
    ...validInboundMessage,
    subject: "화장품 원료 박람회 초청장",
    bodyText: "2026 K-Beauty 컨퍼런스에 초대합니다. 본 메일은 회원님의 동의를 받아 발송되었습니다. 무료 수신거부 080-123-4567",
  };
  assert.deepEqual(shouldParse(baseThread, [koreanNewsletter]), {
    parse: false,
    reason: "newsletter",
  });
});

test("8. 본문이 30자 미만인 단문 메시지는 차단한다 (body_too_short)", () => {
  const shortMsg = {
    ...validInboundMessage,
    bodyText: "Hi, please call me back.", // 25 chars
  };
  const result = shouldParse(baseThread, [shortMsg]);
  assert.deepEqual(result, {
    parse: false,
    reason: "body_too_short",
  });

  // 공백 제외 30자 미만인 경우도 차단
  const paddedShortMsg = {
    ...validInboundMessage,
    bodyText: "   Hello   ",
  };
  assert.deepEqual(shouldParse(baseThread, [paddedShortMsg]), {
    parse: false,
    reason: "body_too_short",
  });
});

test("9. 메시지가 없거나 빈 스레드는 차단한다 (empty_thread)", () => {
  assert.deepEqual(shouldParse(baseThread, []), {
    parse: false,
    reason: "empty_thread",
  });

  assert.deepEqual(shouldParse(baseThread, null), {
    parse: false,
    reason: "empty_thread",
  });
});

test("10. 이미 딜에 연결된 스레드는 차단한다 (already_linked)", () => {
  const linkedThread = {
    ...baseThread,
    linkState: "linked",
    dealId: "deal_abc123",
  };
  const result = shouldParse(linkedThread, [validInboundMessage]);
  assert.deepEqual(result, {
    parse: false,
    reason: "already_linked",
  });
});

test("11. linkState가 linked라도 dealId가 없으면 파싱 검토를 계속 진행한다", () => {
  const unattachedThread = {
    ...baseThread,
    linkState: "linked",
    dealId: null,
  };
  const result = shouldParse(unattachedThread, [validInboundMessage]);
  assert.deepEqual(result, {
    parse: true,
    reason: "external_inbound",
  });
});

test("12. 사내 계정이 먼저 보냈지만 외부 수신자가 회신한 스레드는 통과한다 (external_inbound)", () => {
  const threadHistory = [
    {
      direction: "out",
      from: "thomas@medidakoslabs.com",
      to: ["buyer@global-client.com"],
      subject: "Medidakos OEM Catalog",
      bodyText: "Dear Client, please find attached our catalog for OEM skincare lines.",
      sentAt: "2026-08-26T09:00:00.000Z",
    },
    {
      direction: "in",
      from: "buyer@global-client.com",
      to: ["thomas@medidakoslabs.com"],
      subject: "Re: Medidakos OEM Catalog",
      bodyText: "Thank you for the catalog. We would like to request an estimate for 10,000 bottles of facial cleanser.",
      sentAt: "2026-08-27T10:00:00.000Z",
    },
  ];
  const result = shouldParse(baseThread, threadHistory);
  assert.deepEqual(result, {
    parse: true,
    reason: "external_inbound",
  });
});

test("13. 전달된 메일이라도 본문이 30자 미만이면 차단한다 (body_too_short)", () => {
  const shortForwarded = {
    ...validInboundMessage,
    from: "colleague@medidakoslabs.com",
    subject: "Fwd: Inquiry",
    bodyText: "FYI", // 3 chars
  };
  const result = shouldParse(baseThread, [shortForwarded]);
  assert.deepEqual(result, {
    parse: false,
    reason: "body_too_short",
  });
});

test("14. thread 객체 내부에 messages가 포함된 경우 및 단일 객체 인자도 지원한다", () => {
  const threadWithMessages = {
    ...baseThread,
    messages: [validInboundMessage],
  };
  assert.deepEqual(shouldParse(threadWithMessages), {
    parse: true,
    reason: "external_inbound",
  });

  // 단일 메시지만 넘긴 경우
  assert.deepEqual(shouldParse(validInboundMessage), {
    parse: true,
    reason: "external_inbound",
  });
});

test("15. 발신자가 외부 이메일(@gmail.com)이지만 본문에 사내 도메인 서명이 포함된 경우 차단한다 (internal_communication)", () => {
  const staffForwardingMsg = {
    ...validInboundMessage,
    from: "jhulbo0413@gmail.com",
    fromName: "송준하",
    subject: "Re: 옥시젠] 컨셉원료 자사 보유 내용 전달 드립니다.",
    bodyText: `안녕하세요 옥시젠디벨로먼트 이승현 부장님 ,
유선상으로 4 in 1 픽서 스프레이 개발 문의 드렸던 노차코스메틱 송준하입니다.
개발 의뢰서를 첨부드리니 관련 자료 확인해보시고 추가 필요자료는 아래 담당자 연락처로 회신 부탁드리겠습니다.
친절하게 안내해주셔서 정말 감사합니다.
송준하 드림
<담당자>김형선 매니저 : kimhs@techasset.co.kr유선 번호 : 010-5519-8462`,
  };

  const result = shouldParse(baseThread, [staffForwardingMsg]);
  assert.deepEqual(result, {
    parse: false,
    reason: "internal_communication",
  });
});

