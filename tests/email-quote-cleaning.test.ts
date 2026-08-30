import test from "node:test";
import assert from "node:assert/strict";
import { splitEmailQuotes, isAttributionLine } from "../src/lib/email-body.ts";

test("Email Quote Cleaning - 7 Key Test Cases", async (t) => {
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
});
