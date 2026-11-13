// 클립보드 텍스트 복사 헬퍼.
// - Clipboard API(보안 컨텍스트) 우선, 권한 거부·미지원이면 숨긴 textarea + execCommand로 대체
// - 사용자 클릭 핸들러 안에서 바로 호출해야 브라우저 정책상 성공 가능성이 높다

/** Resolves to true only when the text was actually copied. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or unsupported: fall back below.
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}
