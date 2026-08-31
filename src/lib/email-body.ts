/**
 * 이메일 본문에서 답장/회신 인용구(Quotes, Quoted History)를 분리하고
 * 미디어 및 구글 드라이브 링크를 안전하게 추출하는 공통 유틸리티
 */

export interface ExtractedMediaItem {
  type: "gdrive" | "direct_image" | "attachment";
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  previewUrl?: string;
  size?: number;
}

export function isAttributionLine(line: string, nextLine?: string): { isMatch: boolean; linesConsumed: number } {
  const trimmed = line.trim().replace(/\u202F|\u00A0/g, " ");
  const trimmedNext = (nextLine || "").trim().replace(/\u202F|\u00A0/g, " ");

  // Case 1: Single line "On <Date/Name> ... wrote:"
  if (/^On\s+[A-Za-z0-9,\s.:\u202F\u00A0-]{4,}\b(?:wrote|작성|보냄)\s*:?$/i.test(trimmed)) {
    return { isMatch: true, linesConsumed: 1 };
  }

  // Case 2: Two-line "On <Date/Name> ... <email>" followed by "wrote:"
  if (/^On\s+[A-Za-z0-9,\s.:\u202F\u00A0-]{4,}<.+@.+>$/i.test(trimmed) && /^(?:wrote|작성|보냄)\s*:?$/i.test(trimmedNext)) {
    return { isMatch: true, linesConsumed: 2 };
  }

  // Case 3: "On <Date> at <Time>, <Name/Email> wrote:"
  if (/^On\s+.+at\s+\d+:\d+.*(?:wrote|작성|보냄)\s*:?$/i.test(trimmed)) {
    return { isMatch: true, linesConsumed: 1 };
  }
  if (/^On\s+.+at\s+\d+:\d+.*$/i.test(trimmed) && /^(?:wrote|작성|보냄)\s*:?$/i.test(trimmedNext)) {
    return { isMatch: true, linesConsumed: 2 };
  }

  // Case 4: Korean attribution: "2026년 ... 님이 작성:" or "2026년 ...\n님이 작성:"
  if (/^\d{4}년\s+\d{1,2}월\s+\d{1,2}일.*(?:님이\s+작성:?|작성:\s*|보냄:\s*)$/i.test(trimmed)) {
    return { isMatch: true, linesConsumed: 1 };
  }
  if (/^\d{4}년\s+\d{1,2}월\s+\d{1,2}일.*/i.test(trimmed) && /^(?:님이\s+작성:?|작성:\s*|보냄:\s*)$/i.test(trimmedNext)) {
    return { isMatch: true, linesConsumed: 2 };
  }

  // Case 5: Forwarded / Original message separator
  if (/^(?:-{2,}\s*(?:전달된 메일|forwarded message|original message|원본 메일)\s*-{2,}|-----\s*(?:original message|원본 메일)\s*-----)/i.test(trimmed)) {
    return { isMatch: true, linesConsumed: 1 };
  }

  // Case 6: Outlook / Mail Client header block: "From: ... \n Sent: ..." or "보낸사람: ... \n 받는사람/날짜: ..."
  if (
    /^(?:From:\s+.+|<From:\s*.+>|보낸사람:\s*.+)/i.test(trimmed) &&
    /^(?:Sent|Date|To|Subject|받는사람|날짜|제목):\s+/i.test(trimmedNext)
  ) {
    return { isMatch: true, linesConsumed: 1 };
  }

  return { isMatch: false, linesConsumed: 0 };
}

export function splitEmailQuotes(raw: string): { clean: string; quoted: string | null; quoteLineCount: number } {
  if (!raw || typeof raw !== "string") return { clean: "", quoted: null, quoteLineCount: 0 };

  const normalized = raw.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  let tailQuoteIndex = -1;

  // 1. Search for genuine tail attribution / forwarding separator
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = i + 1 < lines.length ? lines[i + 1] : "";
    const attr = isAttributionLine(line, nextLine);
    if (attr.isMatch) {
      tailQuoteIndex = i;
      break;
    }
  }

  // 2. If no attribution header found, check if trailing lines at the end of the email are purely '>' quote lines (with no following customer reply)
  if (tailQuoteIndex === -1) {
    let pureTrailingQuoteStart = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;
      if (trimmed.startsWith(">") && trimmed.length > 1) {
        pureTrailingQuoteStart = i;
      } else {
        break;
      }
    }
    if (pureTrailingQuoteStart > 0) {
      tailQuoteIndex = pureTrailingQuoteStart;
    }
  }

  let rawCleanLines: string[] = [];
  let rawQuotedLines: string[] = [];

  if (tailQuoteIndex !== -1) {
    rawCleanLines = lines.slice(0, tailQuoteIndex);
    rawQuotedLines = lines.slice(tailQuoteIndex);
  } else {
    rawCleanLines = [...lines];
  }

  // 3. Clean stray single/empty '>' lines from clean text (drafting artifacts)
  const sanitizedCleanLines: string[] = [];
  for (const line of rawCleanLines) {
    const trimmed = line.trim();
    if (trimmed === ">" || trimmed === "> ") {
      continue;
    }
    sanitizedCleanLines.push(line);
  }

  const clean = sanitizedCleanLines.join("\n").trim();
  const quoted = rawQuotedLines.join("\n").trim();

  return {
    clean,
    quoted: quoted.length > 0 ? quoted : null,
    quoteLineCount: rawQuotedLines.length,
  };
}

export function extractMediaFromText(raw: string): { cleanText: string; media: ExtractedMediaItem[] } {
  if (!raw) return { cleanText: "", media: [] };

  const lines = raw.split("\n");
  const cleanLines: string[] = [];
  const media: ExtractedMediaItem[] = [];

  const driveRegex = /https:\/\/(?:drive|docs)\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|(?:open|uc)\?(?:[a-zA-Z0-9_=&-]*\b)?id=([a-zA-Z0-9_-]+))/i;
  const imageExtRegex = /\.(png|jpe?g|gif|webp|svg|bmp|pdf|ai|psd)$/i;

  let pendingFilename: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if line is purely a filename like "back-blue-final.png"
    if (imageExtRegex.test(trimmed) && !trimmed.includes("http") && !trimmed.includes(" ")) {
      pendingFilename = trimmed;
      continue;
    }

    const driveMatch = trimmed.match(driveRegex);
    if (driveMatch) {
      const fileId = driveMatch[1] || driveMatch[2];
      const rawUrlMatch = trimmed.match(/https?:\/\/[^\s<>]+/);
      const rawUrl = rawUrlMatch ? rawUrlMatch[0] : trimmed;

      let name = pendingFilename;
      if (!name) {
        const lineWithoutUrl = trimmed.replace(rawUrl, "").replace(/[<>]/g, "").trim();
        if (lineWithoutUrl && imageExtRegex.test(lineWithoutUrl)) {
          name = lineWithoutUrl;
        } else if (lineWithoutUrl) {
          name = lineWithoutUrl;
        } else {
          name = "Google Drive 파일";
        }
      }

      media.push({
        type: "gdrive",
        id: fileId,
        name: name,
        url: rawUrl,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
        previewUrl: `https://lh3.googleusercontent.com/d/${fileId}`,
      });

      pendingFilename = null;
      continue;
    }

    if (pendingFilename) {
      cleanLines.push(pendingFilename);
      pendingFilename = null;
    }
    cleanLines.push(line);
  }

  if (pendingFilename) {
    cleanLines.push(pendingFilename);
  }

  return {
    cleanText: cleanLines.join("\n").trim(),
    media,
  };
}

export function splitEmailBody(rawText: string): { cleanText: string; quotedText: string | null } {
  const res = splitEmailQuotes(rawText);
  return {
    cleanText: res.clean,
    quotedText: res.quoted,
  };
}

export function getCleanSnippet(rawText: string, maxLength: number = 100): string {
  const { cleanText } = splitEmailBody(rawText);
  const singleLine = cleanText.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) {
    return singleLine;
  }
  return singleLine.slice(0, maxLength).trim() + "…";
}
