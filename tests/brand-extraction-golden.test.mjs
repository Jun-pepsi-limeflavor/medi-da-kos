import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  extractBrandCandidates,
  extractBrandNameFromBody,
} from "../src/lib/name-extractor.ts";

describe("Brand Extraction Golden Dataset & Candidate Pipeline", () => {
  test("Case: Kinoko Labs - 콜드메일 답장 스레드 종합 추출", () => {
    const inboundBody = `Hi Thomas,

Thank you for reaching out. Have a look at our website, Kinoko Labs
<https://www.kinokolabs.co/>. The exact ingredients used in each of our
products are available there.

We would like your team to initially evaluate two products from our range:
   1. *Lip Plumping Serum*
   2. *Under Eye Serum*

Could your team please look into suitable packaging options for these two products?

Warm regards,
Vishal Pravin Chheda
Kinoko Labs`;

    const outboundMsg = {
      subject: "Re: A note from Korea, for the Kinoko Labs team",
      bodyText: `Kinoko Labs runs mushroom actives — reishi, tremella...
How we run a project, brief to US delivery: https://www.medidakos.com/korea?utm_source=cold-outreach&utm_term=kinoko-labs`,
      direction: "out",
    };

    const candidates = extractBrandCandidates({
      bodyText: inboundBody,
      fromName: "Kinoko Customer Care",
      email: "care@kinokolabs.co",
      messages: [outboundMsg],
    });

    // 1. 후보군에 Kinoko Labs가 최상위로 포함되어야 함
    assert.ok(candidates.length >= 1, "Candidate list should not be empty");
    assert.equal(candidates[0].value, "Kinoko Labs");
    assert.equal(candidates[0].source, "outbound_history");

    // 2. 단독 본문 추출 시 'our' 같은 불용어가 절대 반환되지 않아야 함
    const singleExtracted = extractBrandNameFromBody(inboundBody, "care@kinokolabs.co");
    assert.equal(singleExtracted, "Kinoko Labs");
    assert.notEqual(singleExtracted.toLowerCase(), "our");
  });

  test("Case: 'from our range' / 'with our team' 등 소문자 구문 오탐 차단", () => {
    const body = `We are looking for OEM manufacturer to produce serums from our range and with our existing packaging specs.`;
    const res = extractBrandNameFromBody(body, "buyer@customdomain.com");
    assert.notEqual(res.toLowerCase(), "our");
    assert.notEqual(res.toLowerCase(), "our range");
    assert.equal(res, "Customdomain"); // 도메인 fallback으로 안전 처리
  });

  test("Case: 발신자 표시명(fromName) 정제 - 'BHR Skincare Customer Support' -> 'BHR Skincare'", () => {
    const candidates = extractBrandCandidates({
      bodyText: "Please send catalog.",
      fromName: "BHR Skincare Customer Support",
      email: "support@bhrskincare.com",
    });

    const fromNameCandidate = candidates.find((c) => c.source === "from_name");
    assert.ok(fromNameCandidate);
    assert.equal(fromNameCandidate.value, "BHR Skincare");
  });

  test("Case: UTM 파라미터 기반 브랜드 추출 - utm_term=luxe-orient-beauty", () => {
    const candidates = extractBrandCandidates({
      bodyText: "Thank you. Reference: https://medidakos.com/korea?utm_term=luxe-orient-beauty",
      fromName: "Tariq",
      email: "tariq@gmail.com",
    });

    const utmCandidate = candidates.find((c) => c.source === "outbound_history");
    assert.ok(utmCandidate);
    assert.equal(utmCandidate.value, "Luxe Orient Beauty");
  });
});
