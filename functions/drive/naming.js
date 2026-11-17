/**
 * Contact 브리프 Google Drive 폴더·파일 이름 규칙 (순수 함수).
 *
 * 루트(공유 드라이브) / [_test /] YYYY / YYYY-MM / YYYY-MM-DD_{회사명}_{contactId 앞 8자} / 01_{원본 파일명}
 * - 날짜는 KST(문의 serverCreatedAt 기준). isTest 문의는 _test 아래로 분리한다.
 * - 회사명·파일명은 원문 유지(한글 검색 가능), Drive·OS에서 문제 되는 문자만 '_'로 바꾼다.
 */

const KST_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const UNSAFE = /[/\\:*?"<>|\u0000-\u001f\u007f]/g;

/** "2026-11-17" in KST. */
function kstDate(date) {
  return KST_DATE.format(date);
}

function cleanName(value, max) {
  return String(value ?? "")
    .replace(/\s+/g, " ") // line breaks and tabs become spaces first
    .replace(UNSAFE, "_")
    .trim()
    .slice(0, max)
    .trim();
}

/** Parent folder names under the root, and the inquiry's own folder name. */
function briefFolderPath({ contactId, companyName, createdAt, isTest }) {
  const day = kstDate(createdAt);
  const year = day.slice(0, 4);
  const month = day.slice(0, 7);
  const company = cleanName(companyName, 60) || "unknown";
  return {
    segments: [...(isTest ? ["_test"] : []), year, month],
    folderName: `${day}_${company}_${String(contactId).slice(0, 8)}`,
  };
}

/** "01_brief.pdf" for briefFiles[0]. */
function briefFileName(index, name) {
  return `${String(index + 1).padStart(2, "0")}_${cleanName(name, 200) || "file"}`;
}

module.exports = { briefFolderPath, briefFileName, cleanName, kstDate };
