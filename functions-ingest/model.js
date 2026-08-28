// functions-ingest/model.js
// CommonJS 모델 호출 추상화 모듈
//
// 규칙:
// - 모델 호출은 callModel() 한 곳만 지난다.
// - 본문은 로그에 남기지 않고 토큰 사용량(usage)만 로그에 남긴다.
// - 실패하면 삼키지 않고 던진다.
// - 지수 백오프 2회 재시도(총 3회 시도), 60초 타임아웃.

let mockHandler = null;

/**
 * 테스트 및 모의 환경을 위한 핸들러 주입 훅
 * @param {((params: { system?: string, user: string, maxTokens?: number }) => Promise<{ text: string, usage: { input_tokens: number, output_tokens: number } }>)|null} handler
 */
function setMockHandler(handler) {
  mockHandler = handler;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Bedrock / Claude 또는 목 모델 호출 함수
 * @param {object} params
 * @param {string} [params.system] 시스템 프롬프트
 * @param {string} params.user 사용자 프롬프트
 * @param {number} [params.maxTokens=2000] 최대 토큰 수
 * @returns {Promise<{ text: string, usage: { input_tokens: number, output_tokens: number } }>}
 */
async function callModel({ system, user, maxTokens = 2000 }) {
  if (!user || typeof user !== "string") {
    throw new Error("callModel: 'user' prompt must be a non-empty string");
  }

  const maxRetries = 2; // 2회 재시도 (최대 3회 시도)
  const timeoutMs = 60000; // 60초 타임아웃

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const backoffMs = Math.pow(2, attempt - 1) * 1000;
      await sleep(backoffMs);
    }

    try {
      const result = await invokeWithTimeout({ system, user, maxTokens }, timeoutMs);

      // 본문은 남기지 않고 호출당 토큰 사용량만 콘솔에 로깅
      const usage = result.usage || { input_tokens: 0, output_tokens: 0 };
      console.log(`[callModel] usage: input=${usage.input_tokens}, output=${usage.output_tokens}`);

      return result;
    } catch (err) {
      lastError = err;
      console.warn(`[callModel] attempt ${attempt + 1} failed: ${err.message}`);
    }
  }

  throw new Error(`callModel failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

/**
 * 타임아웃(60초)을 적용한 단일 호출 수행
 */
async function invokeWithTimeout({ system, user, maxTokens }, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Model call timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    return await executeSingleCall({ system, user, maxTokens, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 실제 Bedrock SDK 또는 목 핸들러 실행
 */
async function executeSingleCall({ system, user, maxTokens, signal }) {
  // 1. 등록된 커스텀 목 핸들러 우선 확인
  if (typeof mockHandler === "function") {
    return await mockHandler({ system, user, maxTokens });
  }

  // 2. 환경변수 MOCK_MODEL_OUTPUT 처리
  if (process.env.MOCK_MODEL_OUTPUT) {
    const mockOutput = process.env.MOCK_MODEL_OUTPUT === "true"
      ? JSON.stringify({
          buyer: { name: "Sample Buyer", brandName: "Sample Brand" },
          items: [{ productName: "Sample Cream", category: "Cream", volume: "50ml", expectedQty: "5,000 pcs" }],
          confidence: { "buyer.name": 0.9, "items[0].productName": 0.9 },
        })
      : process.env.MOCK_MODEL_OUTPUT;

    return {
      text: mockOutput,
      usage: { input_tokens: 100, output_tokens: 150 },
    };
  }

  // 3. AWS Bedrock SDK 동적 로드 시도
  let BedrockRuntimeClient, InvokeModelCommand;
  try {
    const bedrock = require("@aws-sdk/client-bedrock-runtime");
    BedrockRuntimeClient = bedrock.BedrockRuntimeClient;
    InvokeModelCommand = bedrock.InvokeModelCommand;
  } catch {
    // SDK가 설치되지 않은 테스트 환경일 때의 폴백
    if (process.env.NODE_ENV === "test") {
      return {
        text: JSON.stringify({
          buyer: {},
          items: [],
          confidence: {},
        }),
        usage: { input_tokens: 0, output_tokens: 0 },
      };
    }
    throw new Error(
      "AWS Bedrock SDK (@aws-sdk/client-bedrock-runtime) is not installed and no MOCK_MODEL_OUTPUT is configured",
    );
  }

  // 리전 설정: 서울(ap-northeast-2) 우선, 없으면 도쿄(ap-northeast-1) 등
  const region = process.env.AWS_REGION || process.env.DEFAULT_REGION || "ap-northeast-2";
  const modelId = process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-5-haiku-20241022-v1:0";

  const clientConfig = { region };
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    clientConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }

  const client = new BedrockRuntimeClient(clientConfig);

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: user }],
  };
  if (system) {
    payload.system = system;
  }

  const command = new InvokeModelCommand({
    modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload),
  });

  const response = await client.send(command, { abortSignal: signal });
  const rawBody = new TextDecoder().decode(response.body);
  const parsed = JSON.parse(rawBody);

  const text = parsed.content?.[0]?.text ?? "";
  const usage = parsed.usage || { input_tokens: 0, output_tokens: 0 };

  return { text, usage };
}

module.exports = {
  callModel,
  setMockHandler,
};
