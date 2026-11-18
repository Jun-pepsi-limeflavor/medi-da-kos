"use client";

// Channel Talk 런처(Figma 'Cookie & Chat — Components (Final)' › Channel Talk Launcher 742:2189 · Home 런처 주석 746:2098).
// - 모든 페이지 화면 오른쪽 아래 고정. 물방울 비율(60:51.4) 유지. 크기·여백은 화면 폭이 아니라 기기 기준(2026-11-16)
//   Channel Talk SDK는 User-Agent가 휴대폰(device.type "mobile")일 때만 모바일 메신저를 쓰고, 그 밖(폭을 줄인 데스크톱 브라우저·태블릿)은
//   데스크톱 메신저와 아래쪽 기본 X(56×56, 오른쪽 36 · 아래 37 — 실측, 데스크 플러그인 여백)를 쓴다.
//   · 휴대폰이 아닌 환경(폭 무관): 60×51.4 · 오른쪽 34 · 아래 39.32 — 물방울 중심을 SDK X 중심(오른쪽 64 · 아래 65)에 맞춤
//   · 휴대폰(`phone:` 변형, globals.css): 48×41.1 · 16px — 상담창이 전체 화면이고 닫기 버튼이 오른쪽 위에 따로 있음
//   `phone:`은 CSS 근사(터치 전용 + 짧은 변 600px 미만)라 SDK 판정과 완전히 같지는 않다(휴대폰 '데스크톱 사이트' 모드, 펼친 폴더블 등)
//   여백에 safe-area(env(safe-area-inset-right·bottom))를 더한다. 물방울 전체가 버튼이고,
//   모바일은 터치 영역 44px을 위해 버튼 높이만 44px(물방울 위쪽 2.9px 투명 영역 추가, 물방울 위치는 그대로)
// - 기본: 차콜 #292929 물방울 + 흰 Medidakos 심볼, 그림자 drop-shadow(0 8 24 rgba(41,41,41,.2))
//   On Dark: 런처 중심점이 어두운 섹션([data-launcher-theme="dark"]) 안이면 라이트 블루 #D5E7EE + 차콜 심볼, 푸른 그림자 2겹
//   색·그림자는 같은 0.2s로 함께 전환, 움직임 줄이기 설정이면 즉시 변경
// - 열림(메신저 표시 중): 플러그인 키가 있으면 런처를 숨기고 SDK 기본 X만 보인다(2026-11-16 확정 — SDK X 디자인은 바꾸지 않음).
//   SDK X로 닫으면 onHideMessenger로 런처가 다시 보인다. Mock(키 없음)에서는 심볼 대신 24px X(선 1.8).
//   button + aria-expanded, "Open chat" / "Close chat"
// - 운영(플러그인 키 있음): 클릭하면 SDK 연결 성공 상태에서만 showMessenger(닫힘일 때)·hideMessenger(열림일 때)를 직접 호출하고,
//   열림 상태는 SDK 콜백으로 받는다(2026-11-13 — SDK customLauncherSelector 연결이 실제 Chrome에서 열리지 않아 교체)
// - 미읽음(2026-11-11): SDK onBadgeChanged 값이 1 이상이면 물방울 오른쪽 위 외곽에 걸친 빨간 점(숫자 없음), 0이면 숨김.
//   점은 같은 SVG 안의 원(viewBox 기준 지름 12 = 빨강 #E5484D + 흰 테두리 1.5)이라 런처와 함께 축소된다
//   (기본 12px · 휴대폰 9.6px). 기본·On Dark·열림 X 모두 같은 위치, 클릭을 막지 않음(pointer-events: none).
//   aria-label에 ", unread messages"를 덧붙인다
// - 플러그인 키 있음: SDK 연결 성공(channelReady) 전·연결 실패·shutdown 중에는 보이지 않게(invisible) 둔다 — 눌러도 반응 없는 버튼 방지.
//   2026-11-13
// - 플러그인 키 없음: 운영 빌드에서는 그리지 않는다(기존 운영과 같음). 개발 서버에서만 Mock —
//   SDK를 불러오지 않고 클릭 시 열림 표시만 바꾸고 콘솔에 안내를 남긴다.
//   개발 서버에서만 주소에 ?chatUnread=N을 붙이면 미읽음 N건을 흉내 낸다(운영 빌드에는 포함되지 않음)
// - z-30: 쿠키 배너·모바일 메뉴(z-40) 아래, 모달(top layer) 아래. 쿠키 배너는 640px 이상에서 왼쪽 432px이라 겹치지 않는다.
//   640px 미만은 배너가 휴대폰에서 bottom 88px(런처 위 끝 60px), 그 밖의 기기에서 bottom 100px(런처 위 끝 약 90.7px)이라 겹치지 않는다
import { hideMessenger, showMessenger } from "@channel.io/channel-web-sdk-loader";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DROPLET_PATH, LAUNCHER_VIEWBOX, SYMBOL_PATH } from "@/components/channel-talk/launcher-paths";
import {
  LAUNCHER_ATTR,
  setChannelUnread,
  setMessengerOpen,
  useChannelReady,
  useChannelUnread,
  useMessengerOpen,
} from "@/lib/channel-talk/launcher";
import { cx } from "@/lib/utils/cx";

const DARK_SECTION = '[data-launcher-theme="dark"]';
/** Unread dot in droplet (viewBox) units: on the upper-right outline, 12 across including the white ring. */
const UNREAD_DOT = { cx: 72, cy: 27, r: 5.25, ring: 1.5, color: "#E5484D" };

/** True when the droplet's centre point (current responsive size and position) is inside a dark section. */
function centreOnDark(): boolean {
  const droplet = document.querySelector(`[${LAUNCHER_ATTR}] svg`);
  if (!droplet) return false;
  const box = droplet.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  return Array.from(document.querySelectorAll(DARK_SECTION)).some((el) => {
    const r = el.getBoundingClientRect();
    return x >= r.left && x < r.right && y >= r.top && y < r.bottom;
  });
}

function useOnDark(): boolean {
  const pathname = usePathname();
  const [onDark, setOnDark] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setOnDark(centreOnDark()));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [pathname]);
  return onDark;
}

export function ChannelTalkLauncher({ sdk }: { sdk: boolean }) {
  const open = useMessengerOpen();
  const onDark = useOnDark();
  const unread = useChannelUnread() > 0;
  const ready = useChannelReady();

  useEffect(() => {
    // Dev-only mock of the SDK badge: /?chatUnread=1 (removed from production builds).
    if (process.env.NODE_ENV === "production" || sdk) return;
    const mock = new URLSearchParams(window.location.search).get("chatUnread");
    if (mock !== null) setChannelUnread(Number(mock));
  }, [sdk]);

  function handleClick() {
    if (sdk) {
      // Only once the SDK is booted (the button is hidden before that anyway).
      if (!ready) return;
      if (open) hideMessenger();
      else showMessenger();
      return;
    }
    setMessengerOpen(!open);
    console.info(`[ChannelTalk] mock launcher: messenger ${open ? "closed" : "opened"} (no plugin key, SDK not loaded)`);
  }

  // No plugin key in a production build: no launcher at all (no mock button for visitors).
  if (!sdk && process.env.NODE_ENV === "production") return null;

  return (
    <button
      type="button"
      {...{ [LAUNCHER_ATTR]: "" }}
      aria-expanded={open}
      aria-label={`${open ? "Close chat" : "Open chat"}${unread ? ", unread messages" : ""}`}
      onClick={handleClick}
      className={cx(
        "fixed z-30 flex cursor-pointer items-end rounded-[14px] focus-visible:outline-2 focus-visible:outline-offset-4",
        // By device, not width (like the Channel SDK): 60×51.4 centred on the SDK's desktop X at any width; phones
        // (`phone:` variant, globals.css) keep 48×41.1 in a 48×44 touch target at 16px. Plus safe-area insets.
        "right-[calc(34px_+_env(safe-area-inset-right))] bottom-[calc(39.32px_+_env(safe-area-inset-bottom))] h-auto w-[60px]",
        "phone:right-[calc(16px_+_env(safe-area-inset-right))] phone:bottom-[calc(16px_+_env(safe-area-inset-bottom))] phone:h-11 phone:w-12",
        onDark ? "focus-visible:outline-[#D5E7EE]" : "focus-visible:outline-mdk-charcoal",
        // Hidden until the SDK is booted (and after it failed / shut down) so it never shows as a dead button.
        // While the messenger is open the SDK shows its own X in the same spot (centre-aligned), so the droplet steps aside.
        sdk && (!ready || open) && "invisible",
      )}
    >
      <svg
        viewBox={LAUNCHER_VIEWBOX}
        aria-hidden="true"
        className={cx(
          "block aspect-[60/51.365] h-auto w-full overflow-visible transition-[filter] duration-200 motion-reduce:transition-none",
          onDark
            ? "[filter:drop-shadow(0_2px_6px_rgba(62,101,117,0.22))_drop-shadow(0_8px_20px_rgba(62,101,117,0.18))]"
            : "[filter:drop-shadow(0_8px_24px_rgba(41,41,41,0.2))_drop-shadow(0_0_0_transparent)]",
        )}
      >
        <path
          d={DROPLET_PATH}
          className={cx("transition-[fill] duration-200 motion-reduce:transition-none", onDark ? "fill-[#D5E7EE]" : "fill-mdk-charcoal")}
        />
        {open ? (
          <path
            d="M49 36.6l10 10M59 36.6l-10 10"
            fill="none"
            strokeWidth={1.8}
            strokeLinecap="round"
            className={cx("transition-[stroke] duration-200 motion-reduce:transition-none", onDark ? "stroke-mdk-charcoal" : "stroke-mdk-white")}
          />
        ) : (
          <path
            d={SYMBOL_PATH}
            className={cx("transition-[fill] duration-200 motion-reduce:transition-none", onDark ? "fill-mdk-charcoal" : "fill-mdk-white")}
          />
        )}
        {unread ? (
          <circle
            data-unread-dot=""
            cx={UNREAD_DOT.cx}
            cy={UNREAD_DOT.cy}
            r={UNREAD_DOT.r}
            fill={UNREAD_DOT.color}
            stroke="#FFFFFF"
            strokeWidth={UNREAD_DOT.ring}
            pointerEvents="none"
          />
        ) : null}
      </svg>
    </button>
  );
}
