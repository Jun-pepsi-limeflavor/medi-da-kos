import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./esm-alias-loader.mjs", import.meta.url);
const { fallbackExtract, runThreadExtraction, buildThreadContextText } = await import("../src/lib/extractor.ts");

describe("Thread Cumulative Extraction & Multi-Item Parsing", () => {
  const msg1_inbound = `Hi Thomas,

Thank you for reaching out. Have a look at our website, Kinoko Labs
<https://www.kinokolabs.co/>. The exact ingredients used in each of our
products are available there.

We would like your team to initially evaluate two products from our range:

   1.

   *Lip Plumping Serum*
   2.

   *Under Eye Serum*

We currently use a 15 ml flat-shoulder glass serum bottle for both
products. However, we would like to explore alternate packaging formats
that could improve the overall consumer experience and application.

For the *Under Eye Serum*, we are interested in exploring a *metal-tip
roll-on applicator*.

For the *Lip Plumping Serum*, we would like to explore a *tube dispenser
with a metal massage/applicator tip*.

We believe these packaging formats could provide a more differentiated and
intuitive consumer experience while also complementing the intended use of
each product.

Could your team please look into suitable packaging options for these two
products and share details regarding feasibility, MOQ, unit cost, available
specifications, and lead times?

Warm regards,
Vishal Pravin Chheda
Kinoko Labs`;

  const msg2_inbound = `Hi Thomas,

Could you please share the shipping cost and approximate time required to receive them in India?

Warm regards,
Vishal Pravin Chheda
Kinoko Labs`;

  test("fallbackExtract: Kinoko 1차 메일에서 다제품(2건) 및 패키징 스펙 분리 파싱", () => {
    const res = fallbackExtract(msg1_inbound, "Re: A note from Korea, for the Kinoko Labs team", "Kinoko Customer Care <care@kinokolabs.co>");

    // 1. 바이어 정보 검증
    assert.equal(res.extraction.buyer?.name, "Vishal Pravin Chheda");
    assert.equal(res.extraction.buyer?.brandName, "Kinoko Labs");
    assert.equal(res.extraction.buyer?.email, "care@kinokolabs.co");

    // 2. 다제품 2건 추출 검증
    assert.equal(res.extraction.items?.length, 2);
    
    const lipSerum = res.extraction.items?.find((i) => i.productName.includes("Lip Plumping"));
    assert.ok(lipSerum, "Lip Plumping Serum should be extracted");
    assert.equal(lipSerum.category, "Serum");
    assert.equal(lipSerum.volume, "15 ml");
    assert.equal(lipSerum.packaging?.containerType, "Tube");

    const eyeSerum = res.extraction.items?.find((i) => i.productName.includes("Under Eye"));
    assert.ok(eyeSerum, "Under Eye Serum should be extracted");
    assert.equal(eyeSerum.category, "Serum");
    assert.equal(eyeSerum.volume, "15 ml");
    assert.equal(eyeSerum.packaging?.containerType, "Roll-on");
  });

  test("runThreadExtraction: 1차(제품 2건)+2차(배송지 India) 메시지 종합 누적 추출", async () => {
    const threadMessages = [
      {
        direction: "out",
        from: "thomas@medidakoslabs.com",
        subject: "A note from Korea, for the Kinoko Labs team",
        bodyText: "Hello Vishal, we can assist with mushroom skincare OEM.",
      },
      {
        direction: "in",
        from: "Kinoko Customer Care <care@kinokolabs.co>",
        subject: "Re: A note from Korea, for the Kinoko Labs team",
        bodyText: msg1_inbound,
      },
      {
        direction: "in",
        from: "Kinoko Customer Care <care@kinokolabs.co>",
        subject: "Re: Packaging Options for Kinoko Labs | Medi Da Kos",
        bodyText: msg2_inbound,
      },
    ];

    const { contextText } = buildThreadContextText(threadMessages);
    assert.ok(contextText.includes("Message #1"));
    assert.ok(contextText.includes("Message #2"));
    assert.ok(contextText.includes("Message #3"));

    const result = await runThreadExtraction(threadMessages);

    // 1. 바이어 및 브랜드
    assert.equal(result.extraction.buyer?.name, "Vishal Pravin Chheda");
    assert.equal(result.extraction.buyer?.brandName, "Kinoko Labs");
    assert.equal(result.extraction.buyer?.email, "care@kinokolabs.co");

    // 2. 1차 메일의 제품 2건 보존
    assert.equal(result.extraction.items?.length, 2);

    // 3. 2차 메일의 배송지 India 통합 반영
    assert.equal(result.extraction.shipping?.country, "인도 (India)");
  });

  test("fallbackExtract & runThreadExtraction: Division Twenty 브랜드명, 미국 Schaumburg 배송지, Copper Tripeptide 포뮬러 파싱", () => {
    const from = "Division Twenty <divisiontwenty@gmail.com>";
    const subject = "Re: A note from Korea, for the Division Twenty team";
    const body1 = `
I've attached our final bottle design. Please give us your absolute best
possible price upfront. We will not continue communications if your price
doesn't beat our current supplier's price.

We're currently selling around 3,000 units a month, with expected growth to
5000-6000 by january 2027.

1. 5,000 and 10,000
2. Copper Tripeptide-1 at 0.5%, Niacinamide at 0.5%, Panthenol at 0.5%, and
Hydroxyacetophenone at 0.5%, but the other ingredients listed must be met
as well for stability. The final formula must be blue in color, fragrance
free, and shelf-life for up to 3 years.
3. See image attached
4. We're working on revising our packaging, but it's very important that
the customer has a good package opening experience. This includes the bag
it's shipped in, the box, and the bottle. We also have a thank you note
inside the box.
5. COA and HPLC testing is enough, no sample needed if the results come
back to match our standards. Stability testing would also be nice, we'd
like to ensure it has a good shelf life.

Thank you!
Daniel
    `.trim();

    const body2 = `
Hey there,

The full addresss is
233 Desmond Dr, Schaumburg IL, 60193 United States.

Thank you!
Daniel
    `.trim();

    const result = fallbackExtract(`${body1}\n\n${body2}`, subject, from);

    // 1. 바이어 프로필
    assert.equal(result.extraction.buyer?.name, "Daniel");
    assert.equal(result.extraction.buyer?.email, "divisiontwenty@gmail.com");
    assert.equal(result.extraction.buyer?.brandName, "Division Twenty");
    assert.equal(result.extraction.buyer?.country, "미국 (USA)");

    // 2. 상세 배송 정보
    assert.equal(result.extraction.shipping?.country, "미국 (USA)");
    assert.equal(result.extraction.shipping?.city, "Schaumburg");
    assert.equal(result.extraction.shipping?.addressLine1, "233 Desmond Dr");
    assert.equal(result.extraction.shipping?.postalCode, "60193");
    assert.equal(result.extraction.shipping?.recipientName, "Daniel");

    // 3. 제품 및 포뮬러
    assert.equal(result.extraction.items?.length, 1);
    assert.equal(result.extraction.items?.[0].productName, "Copper Tripeptide-1 Serum");
    assert.equal(result.extraction.items?.[0].category, "Serum");
    assert.ok(result.extraction.items?.[0].formula?.keyIngredients?.includes("Copper Tripeptide-1"));

    // 4. 인증
    assert.deepEqual(result.extraction.certifications?.requiredCerts, ["COA", "HPLC"]);
  });
});
