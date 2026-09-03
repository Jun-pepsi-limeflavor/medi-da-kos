/**
 * 사내 직원 계정 및 포워딩 대화 판별 모듈
 */

export const INTERNAL_DOMAINS = [
  "techasset.co.kr",
  "medidakoslabs.com",
  "medidakos.com",
];

export const INTERNAL_STAFF_ACCOUNTS = [
  "thomas@medidakoslabs.com",
  "hally@medidakoslabs.com",
  "rheekw@techasset.co.kr",
  "songjh@techasset.co.kr",
  "kimhs@techasset.co.kr",
  "parkjy@techasset.co.kr",
  "support@medidakos.com",
  "contact@medidakos.com",
];

export const INTERNAL_STAFF_NAMES = [
  "thomas",
  "hally",
  "rheekw",
  "songjh",
  "kimhs",
  "parkjy",
  "이동훈",
  "김하은",
  "이관우",
  "송준혁",
  "송준하",
  "김현성",
  "김형선",
  "박준영",
];

/**
 * 이메일 문자열에서 순수 이메일 주소만 추출 (예: "Thomas <thomas@medidakoslabs.com>" -> "thomas@medidakoslabs.com")
 */
export function extractEmailAddress(address?: string | null): string {
  if (!address) return "";
  const str = String(address).trim();
  const match = str.match(/<([^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  return str.toLowerCase();
}

/**
 * 주어진 이메일 또는 이름이 사내 직원/사내 도메인인지 판별
 */
export function isInternalAddress(address?: string | null): boolean {
  if (!address) return false;
  const clean = String(address).trim().toLowerCase();
  const email = extractEmailAddress(address);

  // 1. 등록된 사내 계정 이메일 일치 여부
  if (INTERNAL_STAFF_ACCOUNTS.some((acc) => acc.toLowerCase() === email)) {
    return true;
  }

  // 2. 사내 도메인 일치 여부 (@medidakoslabs.com, @techasset.co.kr 등)
  const domain = email.split("@")[1];
  if (domain && INTERNAL_DOMAINS.includes(domain.toLowerCase())) {
    return true;
  }

  // 3. 발신자 명 또는 로컬 파트 일치 여부 (예: "thomas", "hally")
  const localPart = email.split("@")[0].toLowerCase();
  if (INTERNAL_STAFF_NAMES.includes(localPart) || INTERNAL_STAFF_NAMES.includes(clean)) {
    return true;
  }

  return false;
}

/**
 * 제목에 포워딩(Fwd:, FW:, 전달 등) 패턴이 포함되어 있는지 확인
 */
export function isForwardedSubject(subject?: string | null): boolean {
  if (!subject) return false;
  return /(?:^|\s|\[)(?:fwd|fw|전달)(?:\]|:)/i.test(subject);
}

/**
 * 본문(서명 영역 등)에 사내 도메인/사내 직원 연락처가 포함되어 있는지 판별합니다.
 * 외부 발신자 메일이라도 본문에 <담당자>...techasset.co.kr 등이 있으면 내부 직원 발신/포워딩으로 판정합니다.
 */
export function hasInternalSignature(bodyText?: string | null): boolean {
  if (!bodyText || typeof bodyText !== "string") return false;

  // 인용문 구분선 이전의 최신 메시지 본문만 우선 분리 (바이어 답장 메일의 인용구 오탐 방지)
  const quoteSplitRegex = /(?:^|\n)(?:-{2,}\s*original message\s*-{2,}|_{2,}|on .+ wrote:|>\s*|20\d{2}[-./]\s*\d{1,2}[-./]\s*\d{1,2}.+작성:)/i;
  const match = bodyText.split(quoteSplitRegex);
  const primaryBody = match[0] || bodyText;

  // 1. 사내 도메인 이메일 주소 포함 여부
  const internalDomainPattern = /(?:[a-zA-Z0-9._%+-]+)@(techasset\.co\.kr|medidakoslabs\.com|medidakos\.com)/i;
  if (internalDomainPattern.test(primaryBody)) {
    return true;
  }

  // 2. <담당자> 또는 드림 서명 패턴 검사
  const staffSignaturePattern = /<담당자>\s*[^:\n]+:\s*(?:[a-zA-Z0-9._%+-]+)@(techasset\.co\.kr|medidakoslabs\.com|medidakos\.com)/i;
  if (staffSignaturePattern.test(primaryBody)) {
    return true;
  }

  return false;
}

/**
 * 메시지가 사내 직원의 발신/포워딩 메일인지 판별합니다.
 * - 발신자 주소/이름이 사내 직원이거나
 * - 본문에 사내 도메인 서명이 포함된 경우
 */
export function isInternalStaffMessage(message?: {
  from?: string;
  fromName?: string;
  bodyText?: string;
  subject?: string;
} | null): boolean {
  if (!message) return false;

  // 1. 발신자 주소 또는 이름이 사내 계정인 경우
  if (isInternalAddress(message.from) || isInternalAddress(message.fromName)) {
    return true;
  }

  // 2. 본문에 사내 도메인 서명/연락처가 포함된 경우
  if (hasInternalSignature(message.bodyText)) {
    return true;
  }

  return false;
}

/**
 * 스레드 또는 메시지가 직원 간 대화 / 포워딩인지 판별합니다.
 * - 발신자가 사내 직원/도메인이고, 수신 메일함도 사내 계정인 경우
 * - 또는 발신자가 사내 직원 계정이고 제목이 Fwd: 형태인 경우
 * - 또는 본문에 사내 서명이 포함된 경우
 */
export function isInternalStaffThread(
  thread: { sourceAccount?: string; channel?: string; side?: string },
  counterpartyOrMessage?: {
    from?: string;
    fromName?: string;
    senderName?: string;
    subject?: string;
    bodyText?: string;
  } | string | null,
): boolean {
  if (!counterpartyOrMessage) {
    return false;
  }

  let senderStr = "";
  let subjectStr = "";
  let bodyTextStr = "";

  if (typeof counterpartyOrMessage === "string") {
    senderStr = counterpartyOrMessage;
  } else {
    senderStr =
      counterpartyOrMessage.from ||
      counterpartyOrMessage.fromName ||
      counterpartyOrMessage.senderName ||
      "";
    subjectStr = counterpartyOrMessage.subject || "";
    bodyTextStr = counterpartyOrMessage.bodyText || "";
  }

  const isSenderInternal = isInternalAddress(senderStr);

  const isAccountInternal =
    isInternalAddress(thread.sourceAccount) ||
    Boolean(thread.channel?.startsWith("gmail_")) ||
    Boolean(thread.channel?.startsWith("outlook_"));

  // 1. 발신자 및 수신 계정 모두 내부 직원이거나
  if (isSenderInternal && isAccountInternal) {
    return true;
  }

  // 2. 제목이 포워딩이고 발신자가 내부 직원이거나
  if (isForwardedSubject(subjectStr) && isSenderInternal) {
    return true;
  }

  // 3. 본문에 사내 서명이 포함된 경우
  if (hasInternalSignature(bodyTextStr)) {
    return true;
  }

  return false;
}

