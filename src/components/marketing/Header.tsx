"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const navLinks = [
  { href: "/business", label: "Business" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-sky-100/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-cyan-600 text-sm font-bold text-white">
            MD
          </span>
          <span className="text-lg font-semibold tracking-tight text-slate-800">
            Medi Da Kos
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-sky-600 ${
                pathname === link.href ? "text-sky-600" : "text-slate-600"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-sky-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-sky-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700"
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
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
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
          <Link
            href={user ? "/dashboard" : "/login"}
            className="mt-3 block rounded-full bg-sky-600 px-4 py-2 text-center text-sm font-medium text-white"
            onClick={() => setOpen(false)}
          >
            {user ? "Dashboard" : "Log in"}
          </Link>
        </div>
      )}
    </header>
  );
}
