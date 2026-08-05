import Link from "next/link";
import { SocialLinks } from "@/components/marketing/SocialLinks";
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_HREF } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-sky-100/70 bg-sky-50/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
            <div className="md:col-span-2">
            <p className="font-serif text-lg font-semibold text-slate-800">
              Medi Da Kos
            </p>
            <p className="mt-2 max-w-md text-sm text-slate-600">
            Beauty production from Republic of Korea<br></br>Built around your timeline and your margins
            </p>
            <SocialLinks className="mt-5" showLabel label="Follow us" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Platform</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>
                <Link href="/about-us" className="hover:text-sky-600">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/process" className="hover:text-sky-600">
                  Process
                </Link>
              </li>
              <li>
                <Link href="/compare" className="hover:text-sky-600">
                  Compare
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Contact</p>
            <p className="mt-3 space-y-1 text-sm text-slate-600">
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="block hover:text-sky-600"
              >
                {SUPPORT_EMAIL}
              </a>
              <a href={SUPPORT_PHONE_HREF} className="block hover:text-sky-600">
                {SUPPORT_PHONE}
              </a>
            </p>
          </div>
        </div>
        <p className="mt-10 border-t border-sky-100 pt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Medi Da Kos. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
