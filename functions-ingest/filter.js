const INTERNAL_DOMAINS = [
  "techasset.co.kr",
  "medidakoslabs.com",
  "medidakos.com",
];

const BOT_PATTERNS = [
  /^noreply@/i,
  /^no-reply@/i,
  /^donotreply@/i,
  /^do-not-reply@/i,
  /^mailer-daemon@/i,
  /^postmaster@/i,
  /^notifications?@/i,
  /^alerts?@/i,
  /^bounces?@/i,
];

const DELIVERY_FAILURE_PHRASES = [
  "undelivered mail",
  "delivery status notification",
  "mail delivery subsystem",
  "delivery failure",
  "failure notice",
  "mail delivery failed",
  "returned mail",
];

const FORWARD_SUBJECT_REGEX = /(?:^|\s|\[)(?:fwd|fw|전달)(?:\]|:)/i;

const FORWARD_BODY_PHRASES = [
  "forwarded message",
  "begin forwarded message",
  "original message",
  "전달된 메시지",
  "---------- forwarded message ---------",
  "-----original message-----",
];

const UNSUBSCRIBE_PHRASES = [
  "list-unsubscribe",
  "unsubscribe",
  "수신거부",
  "구독해지",
  "구독 취소",
  "수신 거부",
  "opt-out",
  "opt out",
];

function extractEmail(address) {
  if (!address) return "";
  if (typeof address === "object" && address.email) {
    return address.email.trim().toLowerCase();
  }
  const str = String(address);
  const match = str.match(/<([^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  return str.trim().toLowerCase();
}

function isInternalEmail(address) {
  const email = extractEmail(address);
  if (!email) return false;
  const parts = email.split("@");
  if (parts.length < 2) return false;
  return INTERNAL_DOMAINS.includes(parts[1].toLowerCase());
}

function isBotSender(from) {
  const email = extractEmail(from);
  if (!email) return false;
  if (BOT_PATTERNS.some((re) => re.test(email))) return true;
  const [localPart] = email.split("@");
  if (!localPart) return false;
  const normalized = localPart.toLowerCase();
  return (
    normalized.includes("noreply") ||
    normalized.includes("no-reply") ||
    normalized.includes("donotreply")
  );
}

function isDeliveryFailure(message) {
  if (!message) return false;
  const subject = (message.subject || "").toLowerCase();
  return DELIVERY_FAILURE_PHRASES.some((phrase) => subject.includes(phrase));
}

function isNewsletter(message) {
  if (!message) return false;

  // 1. 명시적 listUnsubscribe 필드
  if (message.listUnsubscribe) return true;

  // 2. Headers 배열 또는 객체 확인
  const headers = message.headers || message.raw?.payload?.headers || message.payload?.headers;
  if (Array.isArray(headers)) {
    const found = headers.some(
      (h) => (h.name || "").toLowerCase() === "list-unsubscribe" && Boolean(h.value),
    );
    if (found) return true;
  } else if (headers && typeof headers === "object") {
    if (headers["list-unsubscribe"] || headers["List-Unsubscribe"]) {
      return true;
    }
  }

  // 3. Subject 또는 body 본문 확인
  const subject = (message.subject || "").toLowerCase();
  const body = (message.bodyText || "").toLowerCase();

  if (subject.includes("list-unsubscribe")) return true;
  if (UNSUBSCRIBE_PHRASES.some((phrase) => body.includes(phrase))) {
    return true;
  }

  return false;
}

function isForwardedMessage(message) {
  if (!message) return false;
  const subject = message.subject || "";
  if (FORWARD_SUBJECT_REGEX.test(subject)) {
    return true;
  }
  const body = (message.bodyText || "").toLowerCase();
  if (FORWARD_BODY_PHRASES.some((phrase) => body.includes(phrase))) {
    return true;
  }
  return false;
}

function hasInternalSignature(bodyText) {
  if (!bodyText || typeof bodyText !== "string") return false;

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
 * 스레드와 메시지 목록을 받아 파싱(LLM) 대상인지 판정한다.
 *
 * @param {object} thread 스레드 메타데이터 (linkState, dealId 등) 또는 단일 메시지
 * @param {Array<object>|object} [messages] 스레드에 속한 메시지 배열 또는 단일 메시지
 * @returns {{ parse: boolean, reason: string }}
 */
function shouldParse(thread = {}, messages) {
  // 1. 이미 딜에 연결된 스레드 차단
  if (thread?.linkState === "linked" && Boolean(thread?.dealId)) {
    return { parse: false, reason: "already_linked" };
  }

  // 메시지 목록 정규화
  let msgList = [];
  if (Array.isArray(messages)) {
    msgList = messages;
  } else if (messages) {
    msgList = [messages];
  } else if (Array.isArray(thread?.messages)) {
    msgList = thread.messages;
  } else if (thread && !Array.isArray(thread) && (thread.from || thread.bodyText || thread.subject)) {
    msgList = [thread];
  }

  if (msgList.length === 0) {
    return { parse: false, reason: "empty_thread" };
  }

  // 인바운드 메시지만 골라내기 (direction: 'out' 제외)
  const inbounds = msgList.filter((m) => m && m.direction !== "out");
  if (inbounds.length === 0) {
    return { parse: false, reason: "empty_thread" };
  }

  // 최신 인바운드 메시지 선택 (sentAt 또는 internalDate 기준 오름차순 정렬)
  const sortedInbounds = [...inbounds].sort((a, b) => {
    const tA = new Date(a.sentAt || a.internalDate || 0).getTime();
    const tB = new Date(b.sentAt || b.internalDate || 0).getTime();
    return tA - tB;
  });
  const latestInbound = sortedInbounds[sortedInbounds.length - 1];

  // 2. 배달 실패 메일 차단
  if (isDeliveryFailure(latestInbound)) {
    return { parse: false, reason: "delivery_failure" };
  }

  // 3. 봇/시스템 발신자 차단
  if (isBotSender(latestInbound.from || latestInbound.sender)) {
    return { parse: false, reason: "bot_sender" };
  }

  // 4. 뉴스레터 / 구독 해지 메일 차단
  if (isNewsletter(latestInbound)) {
    return { parse: false, reason: "newsletter" };
  }

  // 5. 사내 발신자 및 사내 본문 서명 확인
  const fromEmail = extractEmail(latestInbound.from || latestInbound.sender);
  const isInternal = isInternalEmail(fromEmail);
  const isForwarded = isForwardedMessage(latestInbound);
  const hasStaffSignature = hasInternalSignature(latestInbound.bodyText);

  if (isInternal || hasStaffSignature) {
    if (isForwarded && isInternal) {
      const body = (latestInbound.bodyText || "").trim();
      if (body.length < 30) {
        return { parse: false, reason: "body_too_short" };
      }
      return { parse: true, reason: "forwarded_inquiry" };
    }
    return { parse: false, reason: "internal_communication" };
  }

  // 6. 본문 길이 확인 (30자 미만 차단)
  const body = (latestInbound.bodyText || "").trim();
  if (body.length < 30) {
    return { parse: false, reason: "body_too_short" };
  }

  // 7. 전달된 메일이거나 일반 외부 인바운드 통과
  if (isForwarded) {
    return { parse: true, reason: "forwarded_inquiry" };
  }

  return { parse: true, reason: "external_inbound" };
}

module.exports = {
  shouldParse,
  isInternalEmail,
  hasInternalSignature,
  isBotSender,
  isDeliveryFailure,
  isNewsletter,
  isForwardedMessage,
  extractEmail,
};

