import test from "node:test";
import assert from "node:assert/strict";
import { splitEmailQuotes, isAttributionLine, extractMediaFromText } from "../src/lib/email-body.ts";

test("Email Quote Cleaning - 12 Comprehensive Test Cases", async (t) => {
  await t.test("Case 1: Stray single '>' artifact in between sentences (Desmond Dr case)", () => {
    const raw = "Hey there,\r\n\r\n>\r\nSorry for that!\r\n\r\nThe full addresss is\r\n\r\n233 Desmond Dr, Schaumburg IL, 60193 United States.\r\n";
    const result = splitEmailQuotes(raw);

    assert.ok(result.clean.includes("Hey there,"));
    assert.ok(result.clean.includes("Sorry for that!"));
    assert.ok(result.clean.includes("The full addresss is"));
    assert.ok(result.clean.includes("233 Desmond Dr, Schaumburg IL, 60193 United States."));
    // The stray lone '>' should be cleaned out
    assert.strictEqual(result.clean.includes("\n>\n"), false);
    // Quoted tail should be null because there is no attribution header
    assert.strictEqual(result.quoted, null);
  });

  await t.test("Case 2: Inline Q&A interspersed quotes without hiding responses", () => {
    const raw = `Hi Hally,

> What is the target MOQ?
We can do 1,000 units.

> Can we add custom packaging?
Yes, custom boxes are available.

Best regards,
Daniel`;

    const result = splitEmailQuotes(raw);

    assert.ok(result.clean.includes("What is the target MOQ?"));
    assert.ok(result.clean.includes("We can do 1,000 units."));
    assert.ok(result.clean.includes("Yes, custom boxes are available."));
    assert.ok(result.clean.includes("Best regards,\nDaniel"));
    assert.strictEqual(result.quoted, null);
  });

  await t.test("Case 3: Two-line Gmail tail attribution with Unicode narrow spaces", () => {
    const raw = `Thanks Hally, we will review the samples tomorrow!

On Wed, Aug 26, 2026 at 5:33\u202FAM Division Twenty <divisiontwenty@gmail.com>
wrote:
> Here are the tracking details.
> EB096410000KR`;

    const result = splitEmailQuotes(raw);

    assert.strictEqual(result.clean, "Thanks Hally, we will review the samples tomorrow!");
    assert.ok(result.quoted !== null);
    assert.ok(result.quoted?.includes("On Wed, Aug 26, 2026 at 5:33"));
    assert.ok(result.quoted?.includes("EB096410000KR"));
  });

  await t.test("Case 4: Single-line Korean Gmail attribution", () => {
    const raw = `샘플 잘 받았습니다. 공장 측에 피드백 전달 부탁드립니다.

2026년 8월 26일 (수) 오전 11:12, Hally Kim <hally@medidakoslabs.com>님이 작성:
> 안녕하세요 대표님,
> 발송된 샘플 송장번호입니다.`;

    const result = splitEmailQuotes(raw);

    assert.strictEqual(result.clean, "샘플 잘 받았습니다. 공장 측에 피드백 전달 부탁드립니다.");
    assert.ok(result.quoted !== null);
    assert.ok(result.quoted?.includes("2026년 8월 26일"));
    assert.ok(result.quoted?.includes("발송된 샘플 송장번호입니다."));
  });

  await t.test("Case 5: Forwarded message header separator", () => {
    const raw = `Please check the forwarded email from the supplier.

---------- Forwarded message ---------
From: Factory Lead <factory@k-beauty.com>
Date: Tue, Aug 25, 2026 at 3:00 PM
Subject: Production Schedule Update
To: Hally Kim <hally@medidakoslabs.com>

We have finished sample batch #2.`;

    const result = splitEmailQuotes(raw);

    assert.strictEqual(result.clean, "Please check the forwarded email from the supplier.");
    assert.ok(result.quoted !== null);
    assert.ok(result.quoted?.includes("Forwarded message"));
    assert.ok(result.quoted?.includes("We have finished sample batch #2."));
  });

  await t.test("Case 6: Business sentences with 'On ...' or '>' comparisons", () => {
    const raw = `Hi Team,

On Wednesday we need the revised quotation.
On Friday our CEO will review all supplier proposals.
Pricing target is > $2.50 vs our current supplier.

Let's meet tomorrow.`;

    const result = splitEmailQuotes(raw);

    assert.strictEqual(result.clean, raw);
    assert.strictEqual(result.quoted, null);
  });

  await t.test("Case 7: Empty or whitespace-only email", () => {
    const raw = "\r\n\t   \n";
    const result = splitEmailQuotes(raw);

    assert.strictEqual(result.clean, "");
    assert.strictEqual(result.quoted, null);
    assert.strictEqual(result.quoteLineCount, 0);
  });

  await t.test("Case 8: Outlook multi-line header block (From: ... Sent: ... To: ... Subject: ...)", () => {
    const raw = `Thank you for the update. We approve the mass production.

From: Hally Kim <hally@medidakoslabs.com>
Sent: Monday, August 24, 2026 10:15 AM
To: buyer@outlook.com
Subject: [Medi Da Kos] Formulation Proposal

Hi Daniel, here is the proposal for your review.`;

    const result = splitEmailQuotes(raw);

    assert.strictEqual(result.clean, "Thank you for the update. We approve the mass production.");
    assert.ok(result.quoted !== null);
    assert.ok(result.quoted?.includes("From: Hally Kim <hally@medidakoslabs.com>"));
    assert.ok(result.quoted?.includes("Sent: Monday, August 24, 2026"));
    assert.ok(result.quoted?.includes("Hi Daniel, here is the proposal"));
  });

  await t.test("Case 9: Korean webmail divider (----- 원본 메일 -----)", () => {
    const raw = `단가 검토 부탁드립니다.

----- 원본 메일 -----
보낸사람: "Hally Kim" <hally@medidakoslabs.com>
받는사람: "공장 담당자" <factory@k-beauty.com>
날짜: 2026-08-25 14:00:00
제목: 샘플 2차 견적 요청의 건

안녕하세요 대표님,
샘플 2차 견적 요청드립니다.`;

    const result = splitEmailQuotes(raw);

    assert.strictEqual(result.clean, "단가 검토 부탁드립니다.");
    assert.ok(result.quoted !== null);
    assert.ok(result.quoted?.includes("----- 원본 메일 -----"));
    assert.ok(result.quoted?.includes("보낸사람: \"Hally Kim\""));
    assert.ok(result.quoted?.includes("샘플 2차 견적 요청드립니다."));
  });

  await t.test("Case 10: Multi-depth nested quotes (>> and >) with active user resolution", () => {
    const raw = `Hey all,

>> Could we do 50ml instead of 30ml?
> The factory said 50ml molds are available.
Let's go with 50ml amber glass then.

What about the pump options?`;

    const result = splitEmailQuotes(raw);

    assert.ok(result.clean.includes("Hey all,"));
    assert.ok(result.clean.includes(">> Could we do 50ml instead of 30ml?"));
    assert.ok(result.clean.includes("> The factory said 50ml molds are available."));
    assert.ok(result.clean.includes("Let's go with 50ml amber glass then."));
    assert.ok(result.clean.includes("What about the pump options?"));
    assert.strictEqual(result.quoted, null);
  });

  await t.test("Case 11: Google Drive image attachment links with signature", () => {
    const raw = `Hi Hally,

Here is the packaging artwork file:
packaging_v3.png
<https://drive.google.com/file/d/1uln3XM5mTgjy2y1CmcooHu5SMXilAUhY/view?usp=drive_web>

--
Daniel Zoltkowski
Founder & CEO, Division Twenty`;

    const result = splitEmailQuotes(raw);
    const mediaRes = extractMediaFromText(result.clean);

    assert.ok(mediaRes.cleanText.includes("Hi Hally,"));
    assert.ok(mediaRes.cleanText.includes("Here is the packaging artwork file:"));
    assert.ok(mediaRes.cleanText.includes("Daniel Zoltkowski"));
    assert.strictEqual(mediaRes.media.length, 1);
    assert.strictEqual(mediaRes.media[0].name, "packaging_v3.png");
    assert.strictEqual(mediaRes.media[0].id, "1uln3XM5mTgjy2y1CmcooHu5SMXilAUhY");
    assert.strictEqual(result.quoted, null);
  });

  await t.test("Case 12: RFQ technical specifications with arrows (->) and comparison operators (>, <, %)", () => {
    const raw = `Specs for our production batch:
- Bottle type -> 30ml Dropper
- Viscosity: > 5000 cps
- Target pH: 5.5 < pH < 6.5
- Storage temp: > 15°C
- Active compound: Copper Peptide >= 2.0%

Can the laboratory meet these specs?`;

    const result = splitEmailQuotes(raw);

    assert.strictEqual(result.clean, raw);
    assert.strictEqual(result.quoted, null);
  });
});
