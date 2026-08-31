import "server-only";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import {
  extractionSchema,
  confidenceMapSchema,
  type Extraction,
  type ConfidenceMap,
  type ExtractionItem,
} from "@/lib/schemas/extraction";
import { splitEmailBody } from "@/lib/email-body";
import {
  extractBuyerNameFromBody,
  extractBrandNameFromBody,
  extractCountryFromBody,
} from "@/lib/name-extractor";

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
  const { cleanText } = splitEmailBody(bodyText);
  const text = `${subject}\n${cleanText || bodyText}`;

  // 1. 발신자 이름 및 이메일 추출
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

  // 본문 기반 실명 추출 보정
  const extractedBuyerName = extractBuyerNameFromBody(bodyText, name);
  if (extractedBuyerName) {
    name = extractedBuyerName;
  }

  // 2. 브랜드명 추정 (name-extractor 기반 고도화 파이프라인 연계)
  let brandName = extractBrandNameFromBody(bodyText, email) || undefined;
  if (!brandName) {
    const brandMatch = text.match(/(?:brand|company|from)\s*[:：]\s*([A-Za-z0-9\s&'-]+)(?:\r?\n|$)/i);
    if (brandMatch && brandMatch[1].trim().length < 30) {
      brandName = brandMatch[1].trim();
    }
  }

  // 3. 국가 추정 (name-extractor + 확장 키워드)
  let country: string | undefined = extractCountryFromBody(bodyText) || undefined;
  if (!country) {
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
      india: "인도 (India)",
    };
    for (const [kw, cName] of Object.entries(countryKeywords)) {
      const regex = new RegExp(`\\b${kw}\\b`, "i");
      if (regex.test(text)) {
        country = cName;
        break;
      }
    }
  }

  // 4. 제품(Items) 다중 목록 추출
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
    "Lip Plumping Serum",
    "Lip Plumper",
    "Lip Oil",
    "Essence",
    "Moisturizer",
    "Scrub",
    "Oil",
    "Eye Cream",
    "Under Eye Serum",
    "Eye Serum",
    "Gel",
  ];

  // 공통 용량 및 수량
  const volMatch = text.match(/(\d+\s*(?:ml|g|fl\s*oz|oz)\b)/i);
  const commonVolume = volMatch ? volMatch[1].trim() : undefined;

  const qtyMatch =
    text.match(/(\b[\d,]+\s*(?:pcs|ea|units|pieces|개)\b)/i) ||
    text.match(/(?:qty|quantity|moq|수량)\s*[:：]?\s*([\d,]+(?:\s*pcs)?)/i);
  const commonExpectedQty = qtyMatch ? qtyMatch[1].trim() : undefined;

  const items: ExtractionItem[] = [];
  const seenProducts = new Set<string>();

  // 4-1. 번호/불릿 매겨진 다제품 목록 탐색 (예: "1. Lip Plumping Serum\n2. Under Eye Serum")
  const numberedListRegex = /(?:^|\n)\s*(?:[1-9]\.|\*|-|•)\s*(?:\r?\n\s*)?(?:\*)?([A-Za-z0-9\s&'’/\-]{2,40}?(?:Serum|Cream|Toner|Lotion|Mist|Cleanser|Sunscreen|Mask|Ampoule|Lip\s*(?:Balm|Plumper|Plumping\s*Serum|Oil)|Essence|Moisturizer|Scrub|Oil|Eye\s*(?:Cream|Serum)|Under\s*Eye\s*Serum|Gel))(?:\*)?/gi;
  let match: RegExpExecArray | null;
  while ((match = numberedListRegex.exec(text)) !== null) {
    const rawProd = match[1].trim().replace(/^[*_\s]+|[*_\s]+$/g, "");
    if (rawProd.length >= 3 && !seenProducts.has(rawProd.toLowerCase())) {
      seenProducts.add(rawProd.toLowerCase());

      // 카테고리 매칭
      let cat: string | undefined;
      for (const c of cosmeticCategories) {
        if (new RegExp(`\\b${c}\\b`, "i").test(rawProd)) {
          cat = c;
          break;
        }
      }

      // 제품별 용기/패키징 매칭
      let containerType: string | undefined;
      let notes: string | undefined;

      // "For the Under Eye Serum, we are interested in exploring a metal-tip\nroll-on applicator"
      const escapedProd = rawProd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const specRegex = new RegExp(
        `(?:for(?:\\s+the)?\\s+\\*?${escapedProd}\\*?[,\\s]+(?:we\\s+are\\s+interested\\s+in\\s+exploring\\s+|we\\s+would\\s+like\\s+to\\s+explore\\s+)?)([^]+?)(?=\\.\\s|\\r?\\n\\r?\\n|$)`,
        "i",
      );
      const specMatch = text.match(specRegex);
      if (specMatch && specMatch[1]) {
        notes = specMatch[1].replace(/\s+/g, " ").trim().replace(/^[*_\s]+|[*_\s]+$/g, "");
        if (/roll-on/i.test(notes)) containerType = "Roll-on";
        else if (/tube/i.test(notes)) containerType = "Tube";
        else if (/bottle/i.test(notes)) containerType = "Bottle";
        else if (/jar/i.test(notes)) containerType = "Jar";
        else if (/dropper/i.test(notes)) containerType = "Dropper";
        else if (/pump/i.test(notes)) containerType = "Pump";
      }

      items.push({
        productName: rawProd,
        category: cat || "Serum",
        volume: commonVolume,
        expectedQty: commonExpectedQty,
        packaging: containerType || notes ? { containerType, notes } : undefined,
      });
    }
  }

  // 4-2. 번호 목록이 없을 때 단일 카테고리 매칭
  if (items.length === 0) {
    let foundCategory: string | undefined;
    for (const cat of cosmeticCategories) {
      if (new RegExp(`\\b${cat}\\b`, "i").test(text)) {
        foundCategory = cat;
        break;
      }
    }

    if (foundCategory || commonVolume || commonExpectedQty) {
      items.push({
        productName: foundCategory
          ? `${brandName ? brandName + " " : ""}${foundCategory}`
          : subject || "Inquiry Item",
        category: foundCategory || undefined,
        volume: commonVolume,
        expectedQty: commonExpectedQty,
      });
    }
  }

  // 5. 인증
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

  // 6. 일정
  const dateMatch = text.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/);

  const rawExtraction: Extraction = {
    buyer: {
      name: name || undefined,
      email: email || undefined,
      brandName: brandName || undefined,
      country: country || undefined,
    },
    items,
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
    ...(brandName ? { "buyer.brandName": 0.85 } : {}),
    ...(country ? { "buyer.country": 0.85 } : {}),
    ...(foundCerts.length > 0 ? { "certifications.requiredCerts": 0.8 } : {}),
    ...(dateMatch ? { "timeline.sampleTargetDate": 0.7 } : {}),
  };

  items.forEach((_, idx) => {
    confidence[`items[${idx}].productName`] = 0.9;
    confidence[`items[${idx}].category`] = 0.85;
    if (commonVolume) confidence[`items[${idx}].volume`] = 0.85;
    if (commonExpectedQty) confidence[`items[${idx}].expectedQty`] = 0.75;
  });

  return {
    extraction: extractionSchema.parse(rawExtraction),
    confidence: confidenceMapSchema.parse(confidence),
  };
}

/**
 * 스레드 내 복수의 메시지를 시간순으로 취합하여 정제된 종합 컨텍스트 텍스트를 생성한다.
 * 중복 인용구, disclaimer, 지나치게 긴 시그니처 등을 정리하여 토큰 효율을 극대화한다.
 */
export function buildThreadContextText(
  messages: Array<{
    from?: string;
    subject?: string;
    bodyText?: string;
    direction?: string;
    receivedAt?: string | Date | null;
    sentAt?: string | Date | null;
  }>,
): { contextText: string; latestSubject: string; latestBuyerFrom: string } {
  let latestSubject = "";
  let latestBuyerFrom = "";

  const formattedBlocks: string[] = [];

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.subject && !latestSubject) {
      latestSubject = m.subject;
    }
    const isOutbound = m.direction === "out";
    if (!isOutbound && m.from && !latestBuyerFrom) {
      latestBuyerFrom = m.from;
    }

    const { cleanText } = splitEmailBody(m.bodyText || "");
    const body = (cleanText || m.bodyText || "").trim();
    if (!body) continue;

    const senderRole = isOutbound ? "Medidakos (Outbound)" : `Buyer (${m.from || "Inbound"})`;
    const header = `--- Message #${i + 1} [${senderRole}] ---`;
    const subjectLine = m.subject ? `Subject: ${m.subject}` : "";
    
    formattedBlocks.push([header, subjectLine, body].filter(Boolean).join("\n"));
  }

  const contextText = formattedBlocks.join("\n\n");
  return { contextText, latestSubject, latestBuyerFrom };
}

/**
 * 스레드 전체 메시지를 컨텍스트로 결합하여 AI 제안 정보를 종합 추출한다.
 */
export async function runThreadExtraction(
  messages: Array<{
    from?: string;
    subject?: string;
    bodyText?: string;
    direction?: string;
    receivedAt?: string | Date | null;
    sentAt?: string | Date | null;
  }>,
): Promise<{
  extraction: Extraction;
  confidence: ConfidenceMap;
}> {
  const { contextText, latestSubject, latestBuyerFrom } = buildThreadContextText(messages);
  if (!contextText.trim()) {
    return {
      extraction: {},
      confidence: {},
    };
  }

  return runMessageExtraction(contextText, latestSubject, latestBuyerFrom);
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
  const { cleanText } = splitEmailBody(bodyText);
  const textToExtract = cleanText || bodyText;

  try {
    const extractModulePath = path.resolve(
      process.cwd(),
      "functions-ingest/extract.js",
    );
    if (fs.existsSync(extractModulePath)) {
      const dynamicImport = new Function("u", "return import(u)");
      const mod = await dynamicImport(pathToFileURL(extractModulePath).href);
      const extractFromMessageText =
        mod?.extractFromMessageText || mod?.default?.extractFromMessageText;
      if (typeof extractFromMessageText === "function") {
        const res = await extractFromMessageText(textToExtract, subject, from);
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
