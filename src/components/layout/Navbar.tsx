"use client";

// 사이트 공통 상단 Navbar(72px, sticky).
// - 900px 이상: 로고·메뉴·Log in/Log out·Contact를 한 줄에 표시
// - 900px 미만: 로고·햄버거만 두고 메뉴와 두 버튼은 패널로 이동
// - 패널은 토글·ESC·바깥 클릭·페이지 이동으로 닫힘, 로그인 상태에 따라 Log in/Log out 전환
// - 메뉴 상태: 기본 Muted Gray·Regular·밑줄 없음 / Hover·키보드 Focus는 Charcoal·Regular + 밑줄 / Active(현재 페이지)는 Charcoal·Medium + 밑줄
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Wordmark } from "@/components/layout/Wordmark";
import { useAuth } from "@/lib/auth/auth-context";
import { NAV_ITEMS, REDIRECT_AFTER_LOGOUT, ROUTES, activeNavHref } from "@/lib/config/routes";
import { cx } from "@/lib/utils/cx";

/**
 * Figma: Design System › Navbar (420:2896), Auth=Logged out. 72px (updated from 88px), white, 1px light-gray bottom edge, sticky.
 * Phase 1: the Log in button reads "Log out" when signed in (same Secondary S style). No Dashboard.
 * Below 900px (where logo + menu + buttons no longer fit comfortably) the bar shows only logo + toggle; the menu
 * moves into a toggle panel, followed by full-width 44px Log in/Log out (Secondary) and Contact (Primary) buttons.
 * Figma has no mobile design: the panel reuses the desktop menu typography and the Button component.
 */
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mdk-charcoal";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  // The menu is open only for the page it was opened on, so any navigation closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const menuOpen = openOn === pathname;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const active = activeNavHref(pathname);

  function closeMenu() {
    setOpenOn(null);
  }

  // Close on a click/tap outside the panel (the page below it, or the bar). The toggle handles its own clicks.
  // Focus is left to the pointer, as on any click; ESC (keyboard) is what returns focus to the toggle.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || toggleRef.current?.contains(target)) return;
      setOpenOn(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await logout();
      closeMenu();
      router.push(REDIRECT_AFTER_LOGOUT);
    } catch (error) {
      // Stay signed in visually: auth state only changes when signOut succeeds.
      console.error("Log out failed", error);
    } finally {
      setSigningOut(false);
    }
  }

  /** Desktop: Secondary S. Mobile panel: Secondary L at full width. */
  const authButton = (size: "s" | "l", className?: string) =>
    loading ? (
      // Reserve the button's space while auth resolves to avoid a Log in → Log out flash.
      <Button variant="secondary" size={size} disabled aria-hidden tabIndex={-1} className={cx("invisible", className)}>
        Log in
      </Button>
    ) : user ? (
      <Button variant="secondary" size={size} onClick={handleLogout} disabled={signingOut} className={className}>
        Log out
      </Button>
    ) : (
      <Button href={ROUTES.login} variant="secondary" size={size} onClick={closeMenu} className={className}>
        Log in
      </Button>
    );

  return (
    <header
      className="font-mdk sticky top-0 z-40 bg-mdk-white shadow-[inset_0_-1px_0_var(--color-mdk-light-gray)]"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          closeMenu();
          toggleRef.current?.focus();
        }
      }}
    >
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-6 xl:px-[120px]">
        <Link
          href={ROUTES.home}
          aria-label="Medidakos home"
          onClick={closeMenu}
          className={cx("flex shrink-0", "min-[900px]:w-[167px]", focusRing)}
        >
          <Wordmark size="navbar" />
        </Link>

        <nav aria-label="Main" className={cx("hidden", "min-[900px]:block")}>
          <ul className="flex gap-10">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href} active={item.href === active} />
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <div className={cx("hidden", "min-[900px]:flex", "items-center gap-2")}>
            {authButton("s")}
            <Button href={ROUTES.contact} variant="primary" size="s">
              Contact
            </Button>
          </div>
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={menuOpen}
            aria-controls={panelId}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setOpenOn(menuOpen ? null : pathname)}
            className={cx(
              "-mr-2 flex size-11 cursor-pointer items-center justify-center text-mdk-charcoal",
              "min-[900px]:hidden",
              "focus-visible:outline-2 focus-visible:outline-mdk-charcoal",
            )}
          >
            {menuOpen ? <X size={22} strokeWidth={1.5} aria-hidden /> : <Menu size={22} strokeWidth={1.5} aria-hidden />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div
          ref={panelRef}
          id={panelId}
          className={cx(
            "absolute inset-x-0 top-full max-h-[calc(100dvh-72px)] overflow-y-auto bg-mdk-white px-6 pt-2 pb-6",
            "shadow-[inset_0_-1px_0_var(--color-mdk-light-gray)]",
            "min-[900px]:hidden",
          )}
        >
          <nav aria-label="Main">
            <ul className="flex flex-col">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <NavLink href={item.href} active={item.href === active} onClick={closeMenu} block />
                </li>
              ))}
            </ul>
          </nav>
          {/* Same-size pair: 24px below FAQ, 12px apart, 44px tall (L type, height overridden for this menu only).
              The panel's white shows through Secondary's transparent fill. */}
          <div className="mt-6 flex flex-col gap-3">
            {authButton("l", "w-full h-11!")}
            <Button href={ROUTES.contact} variant="primary" size="l" onClick={closeMenu} className="w-full h-11!">
              Contact
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function NavLink({
  href,
  active,
  onClick,
  block = false,
}: {
  href: string;
  active: boolean;
  onClick?: () => void;
  block?: boolean;
}) {
  const label = NAV_ITEMS.find((item) => item.href === href)?.label;
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cx(
        "text-[15px] leading-[20px] tracking-[-0.003em] decoration-2 underline-offset-4",
        block ? "flex min-h-11 items-center" : "block",
        focusRing,
        active
          ? "font-medium text-mdk-charcoal underline"
          : cx(
              "font-normal text-mdk-inactive-gray",
              "hover:text-mdk-charcoal hover:underline",
              "focus-visible:text-mdk-charcoal focus-visible:underline",
            ),
      )}
    >
      {label}
    </Link>
  );
}
