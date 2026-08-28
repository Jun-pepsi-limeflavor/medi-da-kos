#!/usr/bin/env node
// scripts/eval.mjs
// Medidakos 파서 추출 정확도 평가 스크립트
//
// 책임:
// 1. Firestore 'messages' 컬렉션에서 사람이 확정한 'accepted' 데이터가 존재하는 메시지 조회
// 2. 각 메시지의 'extraction'과 정답 'accepted'를 필드별로 비교
// 3. 지표 계산: 일치 (Match), 불일치 (Mismatch), 미추출 (Not Extracted)
// 4. 세부 필드별 통계 및 전체 일치율(%) 출력
// 5. Firestore 에뮬레이터, 로컬 픽스처 파일, 모의(Mock) 데이터 모드 지원

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ============================================================================
// 평가 대상 핵심 필드 목록
// ============================================================================
export const EVAL_FIELDS = [
  "buyer.name",
  "buyer.email",
  "buyer.brandName",
  "buyer.country",
  "items[].productName",
  "items[].variantName",
  "items[].category",
  "items[].volume",
  "items[].expectedQty",
  "items[].formula.formulaType",
  "items[].formula.keyIngredients",
  "items[].packaging.containerType",
  "certifications.requiredCerts",
  "timeline.sampleTargetDate",
  "timeline.targetLaunchDate",
  "shipping.country",
  "shipping.city",
];

// ============================================================================
// 필드 비교 유틸리티
// ============================================================================

/**
 * 값을 비교하기 좋게 정규화 (문자열 trim, 소문자화, 연속 공백 단일화 등)
 */
export function normalizeValue(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") {
    return val.trim().toLowerCase().replace(/\s+/g, " ");
  }
  if (typeof val === "number") {
    return String(val);
  }
  if (Array.isArray(val)) {
    return val
      .map((v) => normalizeValue(v))
      .filter(Boolean)
      .sort()
      .join(", ");
  }
  if (typeof val === "object") {
    return JSON.stringify(val);
  }
  return String(val);
}

/**
 * 정답(accepted)과 추출값(extracted) 단일 필드 비교
 * @returns {'match' | 'mismatch' | 'not_extracted' | 'skip'}
 * - skip: 정답에 해당 필드가 비어있어 평가 대상이 아님
 * - match: 추출값과 정답이 일치함
 * - not_extracted: 정답에는 있으나 모델이 추출하지 못함 (빈 값)
 * - mismatch: 모델이 다른 값으로 잘못 추출함
 */
export function compareValues(extractedVal, acceptedVal) {
  const normAccepted = normalizeValue(acceptedVal);
  if (!normAccepted) {
    return "skip"; // 정답에 없으면 평가하지 않음
  }

  const normExtracted = normalizeValue(extractedVal);
  if (!normExtracted) {
    return "not_extracted";
  }

  if (normExtracted === normAccepted) {
    return "match";
  }

  return "mismatch";
}

/**
 * 단일 메시지의 extraction과 accepted 비교
 * @param {object} extraction
 * @param {object} accepted
 * @returns {Record<string, Array<'match'|'mismatch'|'not_extracted'>>}
 */
export function compareMessageFields(extraction = {}, accepted = {}) {
  const result = {};

  for (const field of EVAL_FIELDS) {
    result[field] = [];

    if (field.startsWith("items[]")) {
      const itemSubField = field.slice("items[].".length);
      const acceptedItems = Array.isArray(accepted.items) ? accepted.items : [];
      const extractedItems = Array.isArray(extraction.items) ? extraction.items : [];

      acceptedItems.forEach((accItem, idx) => {
        const extItem = extractedItems[idx];
        const accVal = getNestedValue(accItem, itemSubField);
        const extVal = extItem ? getNestedValue(extItem, itemSubField) : undefined;

        const outcome = compareValues(extVal, accVal);
        if (outcome !== "skip") {
          result[field].push(outcome);
        }
      });
    } else {
      const accVal = getNestedValue(accepted, field);
      const extVal = getNestedValue(extraction, field);

      const outcome = compareValues(extVal, accVal);
      if (outcome !== "skip") {
        result[field].push(outcome);
      }
    }
  }

  return result;
}

function getNestedValue(obj, dotPath) {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = dotPath.split(".");
  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined || typeof curr !== "object") {
      return undefined;
    }
    curr = curr[part];
  }
  return curr;
}

/**
 * 복수 메시지에 대한 평가 통계 종합
 * @param {Array<{ id: string, extraction?: object, accepted?: object }>} messages
 */
export function evaluateMessages(messages) {
  const eligibleMessages = messages.filter(
    (m) => m && m.accepted && typeof m.accepted === "object" && Object.keys(m.accepted).length > 0
  );

  const fieldStats = {};
  for (const field of EVAL_FIELDS) {
    fieldStats[field] = {
      match: 0,
      mismatch: 0,
      notExtracted: 0,
      total: 0,
      matchRate: 0,
    };
  }

  for (const msg of eligibleMessages) {
    const comparison = compareMessageFields(msg.extraction || {}, msg.accepted || {});
    for (const [field, outcomes] of Object.entries(comparison)) {
      if (!fieldStats[field]) continue;
      for (const outcome of outcomes) {
        fieldStats[field].total++;
        if (outcome === "match") fieldStats[field].match++;
        else if (outcome === "mismatch") fieldStats[field].mismatch++;
        else if (outcome === "not_extracted") fieldStats[field].notExtracted++;
      }
    }
  }

  let totalMatch = 0;
  let totalMismatch = 0;
  let totalNotExtracted = 0;
  let totalEvaluations = 0;

  for (const field of EVAL_FIELDS) {
    const stat = fieldStats[field];
    if (stat.total > 0) {
      stat.matchRate = Math.round((stat.match / stat.total) * 1000) / 10;
    } else {
      stat.matchRate = 100.0;
    }
    totalMatch += stat.match;
    totalMismatch += stat.mismatch;
    totalNotExtracted += stat.notExtracted;
    totalEvaluations += stat.total;
  }

  const overallMatchRate =
    totalEvaluations > 0
      ? Math.round((totalMatch / totalEvaluations) * 1000) / 10
      : 100.0;

  return {
    evaluatedCount: eligibleMessages.length,
    totalMessagesCount: messages.length,
    fieldStats,
    overall: {
      totalMatch,
      totalMismatch,
      totalNotExtracted,
      totalEvaluations,
      overallMatchRate,
    },
  };
}

/**
 * 평가 결과를 터미널 친화적 텍스트 리포트로 서식화
 */
export function formatEvaluationReport(evalData) {
  const { evaluatedCount, fieldStats, overall } = evalData;

  const lines = [];
  lines.push("=".repeat(80));
  lines.push("                   Medidakos 파서 추출 정확도 평가 보고서");
  lines.push("=".repeat(80));
  lines.push(`평가 대상: ${evaluatedCount}건 (accepted 존재하는 메시지)`);
  lines.push("");

  const header = `${"필드".padEnd(35)} ${"일치".padStart(8)} ${"불일치".padStart(8)} ${"미추출".padStart(8)} ${"일치율".padStart(10)}`;
  lines.push(header);
  lines.push("-".repeat(80));

  for (const field of EVAL_FIELDS) {
    const stat = fieldStats[field];
    if (!stat || stat.total === 0) continue;
    const matchStr = String(stat.match).padStart(8);
    const mismatchStr = String(stat.mismatch).padStart(8);
    const notExtStr = String(stat.notExtracted).padStart(8);
    const rateStr = `${stat.matchRate.toFixed(1)}%`.padStart(10);
    lines.push(`${field.padEnd(35)} ${matchStr} ${mismatchStr} ${notExtStr} ${rateStr}`);
  }

  lines.push("-".repeat(80));
  lines.push(`전체 평가 필드 검증 건수: ${overall.totalEvaluations}건`);
  lines.push(`- 일치 (Match):         ${overall.totalMatch}건`);
  lines.push(`- 불일치 (Mismatch):     ${overall.totalMismatch}건 (오추출 - 프롬프트/파서 결함)`);
  lines.push(`- 미추출 (Not Extracted): ${overall.totalNotExtracted}건 (누락 - 커버리지 부족)`);
  lines.push("");
  lines.push(`▶ 전체 필드 일치율: ${overall.overallMatchRate.toFixed(1)}%`);
  lines.push("=".repeat(80));

  return lines.join("\n");
}

// ============================================================================
// 모의(Mock) 평가 데이터 (사내 3대 케이스 기반)
// ============================================================================
export const MOCK_EVAL_MESSAGES = [
  {
    id: "msg-div20",
    accepted: {
      buyer: {
        name: "Alex Turner",
        email: "alex@divisiontwenty.com",
        brandName: "Division Twenty",
        country: "USA",
      },
      items: [
        {
          productName: "GHK-Cu Peptide Serum",
          category: "Serum",
          volume: "30ml",
          expectedQty: "5,000 units",
          formula: {},
        },
      ],
      shipping: { country: "USA", city: "Los Angeles" },
    },
    extraction: {
      buyer: {
        name: "Alex Turner",
        email: "alex@divisiontwenty.com",
        brandName: "Division Twenty",
        country: "USA",
      },
      items: [
        {
          productName: "GHK-Cu Peptide Serum",
          category: "Serum",
          volume: "30ml",
          expectedQty: "5,000 units",
          formula: {},
        },
      ],
      shipping: { country: "USA", city: "Los Angeles" },
    },
  },
  {
    id: "msg-charity",
    accepted: {
      buyer: {
        name: "Candy Kobia",
        email: "candy@example.com",
        brandName: "Charity Fragrance Co.",
        country: "UK",
      },
      items: [
        {
          productName: "Oud & Bergamot EDP",
          variantName: "Men",
          category: "Perfume",
          volume: "50ml",
          expectedQty: "3,000 pcs",
          formula: { keyIngredients: "Oud Accord, Bergamot, Cedarwood" },
        },
        {
          productName: "Rose & Vanilla EDP",
          variantName: "Women",
          category: "Perfume",
          volume: "50ml",
          expectedQty: "2,000 pcs",
          formula: { keyIngredients: "Damask Rose, Bourbon Vanilla, White Musk" },
        },
      ],
      timeline: { targetLaunchDate: "November 2026" },
      shipping: { country: "UK", city: "London" },
    },
    extraction: {
      buyer: {
        name: "Candy Kobia",
        email: "candy@example.com",
        brandName: "Charity Fragrance Co.",
        country: "UK",
      },
      items: [
        {
          productName: "Oud & Bergamot EDP",
          variantName: "Men",
          category: "Perfume",
          volume: "50ml",
          expectedQty: "3,000 pcs",
          formula: { keyIngredients: "Oud Accord, Bergamot, Cedarwood" },
        },
        {
          productName: "Rose & Vanilla EDP",
          variantName: "Women",
          category: "Perfume",
          volume: "50ml",
          expectedQty: "2,000 pcs",
          formula: { keyIngredients: "Damask Rose, Bourbon Vanilla, White Musk" },
        },
      ],
      timeline: { targetLaunchDate: "November 2026" },
      shipping: { country: "UK", city: "London" },
    },
  },
  {
    id: "msg-nowel",
    accepted: {
      buyer: {
        name: "Nowel",
        email: "nowel@luminaskincare.com",
        brandName: "Lumina Skincare",
      },
      items: [
        {
          productName: "Daily Sun Essence",
          variantName: "Option A (50ml)",
          category: "Sunscreen",
          volume: "50ml",
          expectedQty: "5,000 pcs",
          formula: { keyIngredients: "Centella Asiatica" },
        },
        {
          productName: "Daily Sun Essence",
          variantName: "Option B (100ml)",
          category: "Sunscreen",
          volume: "100ml",
          expectedQty: "3,000 pcs",
          formula: { keyIngredients: "Centella Asiatica" },
        },
      ],
      timeline: { targetLaunchDate: "2026-10-01" },
      shipping: { country: "Singapore" },
    },
    extraction: {
      buyer: {
        name: "Nowel",
        email: "nowel@luminaskincare.com",
        brandName: "Lumina Skincare",
      },
      items: [
        {
          productName: "Daily Sun Essence",
          variantName: "Option A (50ml)",
          category: "Sunscreen",
          volume: "50ml",
          expectedQty: "5,000 pcs",
          formula: { keyIngredients: "Centella Asiatica" },
        },
        {
          productName: "Daily Sun Essence",
          variantName: "Option B (100ml)",
          category: "Sunscreen",
          volume: "100ml",
          // 모델이 수량을 오추출한 경우 시뮬레이션
          expectedQty: "3,500 pcs",
          formula: { keyIngredients: "Centella Asiatica" },
        },
      ],
      timeline: { targetLaunchDate: "2026-10-01" },
      shipping: { country: "Singapore" },
    },
  },
];

// ============================================================================
// Firestore 연동 및 CLI 실행
// ============================================================================

async function fetchAcceptedMessagesFromFirestore(options = {}) {
  const projectId = options.project || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "demo-medidakos";

  // 에뮬레이터 호스트 환경 변수 설정
  if (options.emulator) {
    const emulatorHost = typeof options.emulator === "string" ? options.emulator : "127.0.0.1:8080";
    process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
  }

  // 앱 초기화
  let app;
  if (getApps().length === 0) {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      app = initializeApp({ projectId });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
      const cred = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, "base64").toString("utf8"));
      app = initializeApp({ credential: cert(cred), projectId });
    } else {
      app = initializeApp({ projectId });
    }
  } else {
    app = getApps()[0];
  }

  const db = getFirestore(app);

  try {
    const snapshot = await db.collection("messages").get();
    const messages = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data && data.accepted && typeof data.accepted === "object" && Object.keys(data.accepted).length > 0) {
        messages.push({
          id: doc.id,
          ...data,
        });
      }
    }

    return messages;
  } catch (err) {
    throw new Error(`Firestore 조회 실패: ${err.message}`);
  }
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const options = {
    emulator: false,
    mock: false,
    json: false,
    fixture: null,
    project: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--emulator") {
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        options.emulator = next;
        i++;
      } else {
        options.emulator = "127.0.0.1:8080";
      }
    } else if (arg === "--mock") {
      options.mock = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--fixture" || arg === "-f") {
      options.fixture = args[++i];
    } else if (arg === "--project" || arg === "-p") {
      options.project = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
사용법: node scripts/eval.mjs [옵션]

옵션:
  --emulator [host:port]  Firestore 에뮬레이터 연결 (기본값: 127.0.0.1:8080)
  --fixture <file.json>   로컬 JSON 파일에서 메시지 로드하여 평가
  --mock                  사내 3대 케이스 모의 데이터로 평가 실행
  --json                  결과를 JSON 형식으로 출력
  --project <id>          GCP / Firebase 프로젝트 ID 지정
  --help, -h              도움말 표시
      `);
      process.exit(0);
    }
  }

  return options;
}

async function main() {
  const options = parseCliArgs();

  let messages = [];

  if (options.mock) {
    messages = MOCK_EVAL_MESSAGES;
  } else if (options.fixture) {
    const fixturePath = path.resolve(process.cwd(), options.fixture);
    const content = fs.readFileSync(fixturePath, "utf8");
    messages = JSON.parse(content);
  } else {
    try {
      messages = await fetchAcceptedMessagesFromFirestore(options);
    } catch (err) {
      console.warn(`[eval] ${err.message}`);
      console.warn("[eval] Firestore에 연결할 수 없거나 데이터가 없어 내장 목(Mock) 데이터로 평가를 시뮬레이션합니다.");
      console.warn("[eval] 에뮬레이터 연결 시: node scripts/eval.mjs --emulator 127.0.0.1:8080");
      messages = MOCK_EVAL_MESSAGES;
    }
  }

  const evalResult = evaluateMessages(messages);

  if (options.json) {
    console.log(JSON.stringify(evalResult, null, 2));
  } else {
    console.log(formatEvaluationReport(evalResult));
  }
}

// 직접 CLI 실행 시에만 main() 호출
const isDirectRun =
  process.argv[1] &&
  (pathToFileURL(process.argv[1]).href === import.meta.url ||
    process.argv[1].endsWith("eval.mjs"));

if (isDirectRun) {
  main().catch((err) => {
    console.error("[eval] 치명적 오류:", err);
    process.exit(1);
  });
}
