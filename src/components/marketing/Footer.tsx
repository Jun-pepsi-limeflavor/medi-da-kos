import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-sky-100 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
            <div className="md:col-span-2">
            <p className="text-lg font-semibold text-slate-800">Medi Da Kos</p>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              Korea&apos;s custom ODM brokerage platform connecting global beauty
              brands with advanced Korean manufacturing partners.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Platform</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>
                <Link href="/business" className="hover:text-sky-600">
                  Business
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="hover:text-sky-600">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-sky-600">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Contact</p>
            <p className="mt-3 text-sm text-slate-600">
              <a
                href="mailto:contact@techasset.co.kr"
                className="hover:text-sky-600"
              >
                contact@techasset.co.kr
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
