import test from "node:test";
import assert from "node:assert/strict";
import { splitEmailBody, getCleanSnippet } from "../src/lib/email-body.ts";

test("이메일 인용구 분리 테스트 - Jade Davis 실제 회신 패턴", () => {
  const rawEmail = `Can I please book a time at 10:00am 27th?

Please let me know if you require any information prior to our meeting.

Regards,
Jade Davis



On Mon, 24 Aug 2026 at 5:58\u202fpm, Hally Kim <hally@medidakoslabs.com> wrote:

> Dear Jade,
>
> Hi, my name is Hally, and I’m a PM at Medi Da Kos. It’s a pleasure to
> connect with you.
> We would be happy to arrange a meeting with you.
>
> Would you be available for a video meeting on either *August 27 or August
> 28*?
>
> Our business hours are *10:00 AM`;

  const { cleanText, quotedText } = splitEmailBody(rawEmail);

  assert.equal(
    cleanText,
    `Can I please book a time at 10:00am 27th?\n\nPlease let me know if you require any information prior to our meeting.\n\nRegards,\nJade Davis`
  );
  assert.ok(quotedText !== null);
  assert.ok(quotedText.startsWith("On Mon, 24 Aug 2026"));
  assert.ok(quotedText.includes("> Dear Jade,"));
});

test("이메일 인용구 분리 테스트 - 한국어 Gmail 회신 패턴", () => {
  const rawEmail = `일정 확인 감사합니다. 27일 오전 10시에 뵙겠습니다.

2026년 8월 24일 (월) 오후 5:58, Hally Kim <hally@medidakoslabs.com>님이 작성:

> 안녕하세요, 미팅 일정 관련 안내드립니다.`;

  const { cleanText, quotedText } = splitEmailBody(rawEmail);

  assert.equal(cleanText, "일정 확인 감사합니다. 27일 오전 10시에 뵙겠습니다.");
  assert.ok(quotedText !== null);
  assert.ok(quotedText.startsWith("2026년 8월 24일"));
});

test("이메일 인용구 분리 테스트 - Outlook Original Message 구분자", () => {
  const rawEmail = `Here is the revised quotation for 5,000 units.

-----Original Message-----
From: buyer@example.com
Sent: Monday, August 24, 2026 2:30 PM
To: thomas@medidakoslabs.com
Subject: Quote Request

Could you provide pricing for 5,000 pcs?`;

  const { cleanText, quotedText } = splitEmailBody(rawEmail);

  assert.equal(cleanText, "Here is the revised quotation for 5,000 units.");
  assert.ok(quotedText !== null);
  assert.ok(quotedText.startsWith("-----Original Message-----"));
});

test("이메일 인용구 분리 테스트 - 헤더 없는 단순 > 인용구 라인", () => {
  const rawEmail = `Yes, that works for us.

> Are you available tomorrow?
> Please confirm.`;

  const { cleanText, quotedText } = splitEmailBody(rawEmail);

  assert.equal(cleanText, "Yes, that works for us.");
  assert.ok(quotedText !== null);
  assert.equal(quotedText, "> Are you available tomorrow?\n> Please confirm.");
});

test("이메일 인용구 분리 테스트 - 인용구 없는 단독 메시지", () => {
  const rawEmail = `Hello, I would like to inquire about OEM cosmetic manufacturing for our new skincare brand.`;

  const { cleanText, quotedText } = splitEmailBody(rawEmail);

  assert.equal(cleanText, rawEmail);
  assert.equal(quotedText, null);
});

test("getCleanSnippet 요약문 생성 테스트", () => {
  const rawEmail = `Can I please book a time at 10:00am 27th?\n\nOn Mon, 24 Aug 2026, Hally wrote:\n> Hello`;
  const snippet = getCleanSnippet(rawEmail, 50);

  assert.equal(snippet, "Can I please book a time at 10:00am 27th?");
});
