"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

const navLinks = [
  { href: "/about-us", label: "About Us" },
  { href: "/process", label: "Process" },
  { href: "/compare", label: "Compare" },
  { href: "/contact", label: "Contact" },
];

/** Home: header appears after user scrolls past the first ~12% of the viewport */
const HOME_HEADER_SCROLL_THRESHOLD = 0.12;

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const isHome = pathname === "/";
  const [visible, setVisible] = useState(!isHome);

  useEffect(() => {
    if (!isHome) {
      setVisible(true);
      return;
    }

    function updateVisibility() {
      const threshold =
        window.innerHeight * HOME_HEADER_SCROLL_THRESHOLD;
      setVisible(window.scrollY > threshold);
    }

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);
    return () => {
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
    };
  }, [isHome]);

  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);

  async function handleLogout() {
    await logout();
    router.push("/");
    setOpen(false);
  }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-500 ease-out ${
        visible
          ? "translate-y-0 border-sky-100/60 bg-white/75 opacity-100 shadow-sm shadow-sky-100/30 backdrop-blur-xl"
          : "pointer-events-none -translate-y-full border-transparent bg-transparent opacity-0 backdrop-blur-none"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-serif text-xl font-semibold tracking-tight text-slate-800">
            Medi Da Kos
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-sky-600 ${
                pathname === link.href ? "text-sky-500" : "text-slate-600"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-full border border-sky-200/80 bg-white/50 px-5 py-2 text-sm font-medium text-sky-700 backdrop-blur-sm transition hover:bg-sky-50/80"
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-full bg-slate-100 px-5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
              >
                <LogOut size={16} />
                Log out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-sky-500/90 px-5 py-2 text-sm font-medium text-white shadow-sm shadow-sky-200/40 transition hover:bg-sky-600"
            >
              Log in
            </Link>
          )}
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-slate-600 md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
          tabIndex={visible ? 0 : -1}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && visible && (
        <div className="border-t border-sky-50 bg-white px-4 py-4 md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block py-2 text-sm font-medium text-slate-700"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="mt-3 block rounded-full bg-sky-600 px-4 py-2 text-center text-sm font-medium text-white"
                onClick={() => setOpen(false)}
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
              >
                <LogOut size={16} />
                Log out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="mt-3 block rounded-full bg-sky-600 px-4 py-2 text-center text-sm font-medium text-white"
              onClick={() => setOpen(false)}
            >
              Log in
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
