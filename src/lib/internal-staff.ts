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
  "김현성",
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
 * 스레드 또는 메시지가 직원 간 대화 / 포워딩인지 판별합니다.
 * - 발신자가 사내 직원/도메인이고, 수신 메일함도 사내 계정인 경우
 * - 또는 발신자가 사내 직원 계정이고 제목이 Fwd: 형태인 경우
 */
export function isInternalStaffThread(
  thread: { sourceAccount?: string; channel?: string; side?: string },
  counterpartyOrMessage?: {
    from?: string;
    fromName?: string;
    senderName?: string;
    subject?: string;
  } | string | null,
): boolean {
  if (!counterpartyOrMessage) {
    return false;
  }

  let senderStr = "";
  let subjectStr = "";

  if (typeof counterpartyOrMessage === "string") {
    senderStr = counterpartyOrMessage;
  } else {
    senderStr =
      counterpartyOrMessage.from ||
      counterpartyOrMessage.fromName ||
      counterpartyOrMessage.senderName ||
      "";
    subjectStr = counterpartyOrMessage.subject || "";
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

  return false;
}
