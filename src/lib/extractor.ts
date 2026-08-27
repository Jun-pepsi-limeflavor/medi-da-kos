import "server-only";
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import {
  extractionSchema,
  confidenceMapSchema,
  type Extraction,
  type ConfidenceMap,
} from "@/lib/schemas/extraction";

/**
 * 정규식/휴리스틱 기반 로컬 파서
 * 모델 호출이 불가능하거나 테스트/로컬 환경일 때 안전하게 추출 데이터를 제공한다.
 * 주의: 원가/마진 관련 데이터는 절대 추출하거나 포함하지 않는다.
 */
export function fallbackExtract(
  bodyText: string,
  subject = "",
  from = "",
): {
  extraction: Extraction;
  confidence: ConfidenceMap;
} {
  const text = `${subject}\n${bodyText}`;

  // 발신자 이름 및 이메일 추출
  let email = "";
  let name = "";
  const emailMatch =
    from.match(/<([^>]+)>/) ||
    from.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    email = emailMatch[1];
    name = from.replace(/<[^>]+>/, "").replace(/["']/g, "").trim();
  } else {
    name = from.trim();
  }

  // 브랜드명 추정 (회사/브랜드 키워드, We are ~ 구문, 또는 도메인 기반)
  let brandName: string | undefined;
  const brandMatch =
    text.match(/(?:brand|company|from)\s*[:：]\s*([A-Za-z0-9\s&'-]+)(?:\r?\n|$)/i) ||
    text.match(/(?:we are|this is\s+[A-Za-z\s]+\s+from)\s+([A-Za-z0-9\s&'-]+?)(?:\s+(?:in|based|\.)|\r?\n|$)/i);
  if (brandMatch && brandMatch[1].trim().length < 30) {
    brandName = brandMatch[1].trim();
  } else if (
    email &&
    !email.includes("gmail") &&
    !email.includes("outlook") &&
    !email.includes("hotmail") &&
    !email.includes("yahoo")
  ) {
    const domain = email.split("@")[1]?.split(".")[0];
    if (domain) {
      brandName = domain.charAt(0).toUpperCase() + domain.slice(1);
    }
  }

  // 국가 추정
  let country: string | undefined;
  const countryKeywords: Record<string, string> = {
    usa: "미국 (USA)",
    "united states": "미국 (USA)",
    us: "미국 (USA)",
    korea: "한국",
    japan: "일본",
    vietnam: "베트남",
    uk: "영국 (UK)",
    "united kingdom": "영국 (UK)",
    france: "프랑스",
    germany: "독일",
    australia: "호주",
    canada: "캐나다",
    singapore: "싱가포르",
  };
  for (const [kw, cName] of Object.entries(countryKeywords)) {
    const regex = new RegExp(`\\b${kw}\\b`, "i");
    if (regex.test(text)) {
      country = cName;
      break;
    }
  }

  // 제품 카테고리 / 제품명 추출
  const cosmeticCategories = [
    "Serum",
    "Cream",
    "Toner",
    "Lotion",
    "Mist",
    "Cleanser",
    "Sunscreen",
    "Mask",
    "Ampoule",
    "Lip Balm",
    "Essence",
    "Moisturizer",
    "Scrub",
    "Oil",
    "Eye Cream",
  ];
  let foundCategory: string | undefined;
  for (const cat of cosmeticCategories) {
    if (new RegExp(`\\b${cat}\\b`, "i").test(text)) {
      foundCategory = cat;
      break;
    }
  }

  // 용량 (Volume)
  const volMatch = text.match(/(\d+\s*(?:ml|g|fl\s*oz|oz)\b)/i);
  const volume = volMatch ? volMatch[1].trim() : undefined;

  // 수량 (Expected Qty)
  const qtyMatch =
    text.match(/(\b[\d,]+\s*(?:pcs|ea|units|pieces|개)\b)/i) ||
    text.match(/(?:qty|quantity|moq|수량)\s*[:：]?\s*([\d,]+(?:\s*pcs)?)/i);
  const expectedQty = qtyMatch ? qtyMatch[1].trim() : undefined;

  // 인증
  const certKeywords = [
    "CPNP",
    "FDA",
    "ISO22716",
    "ISO 22716",
    "Vegan",
    "Halal",
    "EWG",
    "MoCRA",
  ];
  const foundCerts = certKeywords.filter((c) =>
    new RegExp(`\\b${c}\\b`, "i").test(text),
  );

  // 일정
  const dateMatch = text.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/);

  const rawExtraction: Extraction = {
    buyer: {
      name: name || undefined,
      email: email || undefined,
      brandName: brandName || undefined,
      country: country || undefined,
    },
    items:
      foundCategory || volume || expectedQty
        ? [
            {
              productName: foundCategory
                ? `${brandName ? brandName + " " : ""}${foundCategory}`
                : subject || "Inquiry Item",
              category: foundCategory || undefined,
              volume: volume || undefined,
              expectedQty: expectedQty || undefined,
            },
          ]
        : [],
    certifications:
      foundCerts.length > 0
        ? {
            requiredCerts: foundCerts,
          }
        : undefined,
    timeline: dateMatch
      ? {
          sampleTargetDate: dateMatch[1],
        }
      : undefined,
    shipping: country
      ? {
          country,
        }
      : undefined,
  };

  const confidence: ConfidenceMap = {
    ...(name ? { "buyer.name": 0.85 } : {}),
    ...(email ? { "buyer.email": 0.95 } : {}),
    ...(brandName ? { "buyer.brandName": 0.75 } : {}),
    ...(country ? { "buyer.country": 0.8 } : {}),
    ...(foundCategory
      ? { "items[0].productName": 0.85, "items[0].category": 0.8 }
      : {}),
    ...(volume ? { "items[0].volume": 0.85 } : {}),
    ...(expectedQty ? { "items[0].expectedQty": 0.75 } : {}),
    ...(foundCerts.length > 0 ? { "certifications.requiredCerts": 0.8 } : {}),
    ...(dateMatch ? { "timeline.sampleTargetDate": 0.7 } : {}),
  };

  return {
    extraction: extractionSchema.parse(rawExtraction),
    confidence: confidenceMapSchema.parse(confidence),
  };
}

/**
 * extractFromMessageText(또는 로컬/모의 파서)를 실행하여 추출 결과를 반환한다.
 */
export async function runMessageExtraction(
  bodyText: string,
  subject = "",
  from = "",
): Promise<{
  extraction: Extraction;
  confidence: ConfidenceMap;
}> {
  try {
    const require = createRequire(import.meta.url);
    const extractModulePath = path.resolve(
      process.cwd(),
      "functions-ingest/extract.js",
    );
    if (fs.existsSync(extractModulePath)) {
      const { extractFromMessageText } = require(extractModulePath);
      if (typeof extractFromMessageText === "function") {
        const res = await extractFromMessageText(bodyText, subject, from);
        if (res && typeof res === "object") {
          const parsed = extractionSchema.safeParse(res.extraction);
          const confParsed = confidenceMapSchema.safeParse(res.confidence);
          if (parsed.success && Object.keys(parsed.data).length > 0) {
            return {
              extraction: parsed.data,
              confidence: confParsed.success ? confParsed.data : {},
            };
          }
        }
      }
    }
  } catch (err) {
    console.warn(
      "[runMessageExtraction] extractFromMessageText threw or failed, using fallback:",
      err,
    );
  }

  // Fallback heuristic extraction
  return fallbackExtract(bodyText, subject, from);
}
