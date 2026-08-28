/**
 * 이메일 본문에서 답장/회신 인용구(Quotes, Quoted History)를 분리하는 유틸리티
 * 
 * 원문 데이터는 보존하되, UI 및 파서에서 새 본문과 이전 답장 내역을 깔끔하게 분리합니다.
 */

export interface ParsedEmailBody {
  /** 인용구가 제거된 순수 새 본문 */
  cleanText: string;
  /** 접을 수 있는 인용구/회신 이력 (없으면 null) */
  quotedText: string | null;
}

// 이메일 인용 헤더 패턴들
const QUOTE_HEADER_PATTERNS = [
  // On Mon, 24 Aug 2026 at 5:58 pm, Hally Kim <hally@...> wrote:
  // On Aug 24, 2026, at 5:58 PM, Hally Kim wrote:
  /\n\s*On\s+[^\n]+(?:wrote|작성|보냄)\s*:?/i,
  // 2026년 8월 24일 (월) 오후 5:58, Hally Kim <...>님이 작성:
  /\n\s*\d{4}년\s+\d{1,2}월\s+\d{1,2}일\s+[^\n]+(?:작성|보냄)\s*:?/i,
  // -----Original Message----- or ----- Original Message -----
  /\n\s*-+\s*Original Message\s*-+/i,
  // ---------- Forwarded message ---------
  /\n\s*-+\s*Forwarded message\s*-+/i,
  // Outlook / Apple Mail 헤더 블록: From: ... Sent: ... To: ...
  /\n\s*From:\s+[^\n]+\n\s*(?:Sent|Date):\s+[^\n]+\n\s*To:\s+[^\n]+/i,
  // ________________________________ (언더스코어 구분선)
  /\n\s*_{20,}\s*\n/i,
];

/**
 * 이메일 원문에서 순수 본문과 인용구(답장 이력)를 분리합니다.
 */
export function splitEmailBody(rawText: string): ParsedEmailBody {
  if (!rawText || typeof rawText !== "string") {
    return { cleanText: "", quotedText: null };
  }

  const normalized = rawText.replace(/\r\n/g, "\n");

  // 1. 인용 헤더 구분자 기반 분리 시도
  let earliestSplitIndex = -1;

  for (const pattern of QUOTE_HEADER_PATTERNS) {
    const match = normalized.match(pattern);
    if (match && match.index !== undefined) {
      if (earliestSplitIndex === -1 || match.index < earliestSplitIndex) {
        earliestSplitIndex = match.index;
      }
    }
  }

  if (earliestSplitIndex !== -1) {
    const clean = normalized.slice(0, earliestSplitIndex).trim();
    const quoted = normalized.slice(earliestSplitIndex).trim();
    return {
      cleanText: clean || normalized.trim(),
      quotedText: quoted || null,
    };
  }

  // 2. 헤더 없이 연속된 `>` 라인 블록으로 시작하는 인용구 감지
  const lines = normalized.split("\n");
  let firstQuoteLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith(">")) {
      firstQuoteLineIndex = i;
      break;
    }
  }

  if (firstQuoteLineIndex !== -1) {
    // 인용구 시작 전까지의 텍스트가 있으면 분리
    const clean = lines.slice(0, firstQuoteLineIndex).join("\n").trim();
    const quoted = lines.slice(firstQuoteLineIndex).join("\n").trim();

    if (clean.length > 0) {
      return {
        cleanText: clean,
        quotedText: quoted || null,
      };
    }
  }

  // 인용구가 없는 단일 메시지
  return {
    cleanText: normalized.trim(),
    quotedText: null,
  };
}

/**
 * 목록 및 카드 미리보기를 위한 정제된 텍스트 요약 생성
 */
export function getCleanSnippet(rawText: string, maxLength = 100): string {
  const { cleanText } = splitEmailBody(rawText);
  return cleanText.replace(/\s+/g, " ").trim().slice(0, maxLength);
}
