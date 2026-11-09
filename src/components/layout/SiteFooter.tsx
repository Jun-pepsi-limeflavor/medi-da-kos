"use client";

// 리뉴얼 사이트 공통 Footer.
// - 메뉴·Services 섹션·연락처·SNS 링크, 이메일 클릭 이벤트 측정
// - 하단 정책 링크와 Cookie Settings 트리거
import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/layout/Wordmark";
import { openCookieSettings } from "@/components/cookie-consent/cookie-settings";
import { trackEmailClick } from "@/lib/analytics/events";
import { ROUTES, SERVICES_SECTIONS } from "@/lib/config/routes";
import { SOCIAL_LINKS, SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_HREF, type SocialPlatform } from "@/lib/config/site";

/**
 * Figma: Design System › Footer (742:2200). off-white, padding 120/120/48/120, 72px between rows.
 * Email is a mailto link (Figma annotation), measured with the existing email_click event.
 */
const linkClass =
  "block w-fit text-mdk-body text-mdk-charcoal underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-charcoal";
const legalClass =
  "block py-2 sm:py-0 text-[13px] leading-4 text-mdk-charcoal-muted underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-charcoal cursor-pointer";

const FOLLOW_ORDER: SocialPlatform[] = ["instagram", "tiktok", "linkedin", "facebook"];

function Column({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 lg:w-[200px] lg:shrink-0">
      <h2 className="text-[13px] leading-4 font-medium text-mdk-charcoal-muted">{heading}</h2>
      {/* Figma: 4px spacer between the heading and the first link (12 + 4 + 12). */}
      <ul className="mt-4 flex flex-col gap-3">{children}</ul>
    </div>
  );
}

export function SiteFooter() {
  const follow = FOLLOW_ORDER.map((platform) => SOCIAL_LINKS.find((s) => s.platform === platform)).filter(
    (s): s is (typeof SOCIAL_LINKS)[number] => Boolean(s),
  );

  return (
    <footer className="font-mdk bg-mdk-off-white px-6 pt-16 pb-12 lg:pt-30 xl:px-[120px]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-12 lg:gap-[72px]">
        <div className="flex flex-col gap-10 lg:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <p className="text-mdk-lead text-mdk-charcoal-muted">Your Gateway to K-Cosmetics Manufacturing</p>
            <p className="mt-8 text-mdk-body text-mdk-charcoal">5F, 6 Jong-ro, Jongno-gu, Seoul, Republic of Korea</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              onClick={() => trackEmailClick("footer", SUPPORT_EMAIL)}
              className={`${linkClass} self-start`}
            >
              {SUPPORT_EMAIL}
            </a>
            <a href={SUPPORT_PHONE_HREF} className={`${linkClass} self-start`}>
              {SUPPORT_PHONE}
            </a>
          </div>

          {/* Below lg the three link columns sit in a 2–3 column grid under the brand column. */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:flex lg:gap-10">
          <Column heading="Services">
            <li><Link href={SERVICES_SECTIONS.scope} className={linkClass}>Scope</Link></li>
            <li><Link href={SERVICES_SECTIONS.howItWorks} className={linkClass}>How it works</Link></li>
            <li><Link href={SERVICES_SECTIONS.samplesMoq} className={linkClass}>Samples &amp; MOQ</Link></li>
            <li><Link href={SERVICES_SECTIONS.paymentShipping} className={linkClass}>Payment &amp; shipping</Link></li>
            <li><Link href={SERVICES_SECTIONS.qualityCompliance} className={linkClass}>Quality &amp; compliance</Link></li>
          </Column>

          <Column heading="Company">
            <li><Link href={ROUTES.aboutUs} className={linkClass}>About Us</Link></li>
            <li><Link href={ROUTES.portfolio} className={linkClass}>Portfolio</Link></li>
            <li><Link href={ROUTES.faq} className={linkClass}>FAQ</Link></li>
            <li><Link href={ROUTES.contact} className={linkClass}>Contact</Link></li>
          </Column>

          <Column heading="Follow">
            {follow.map((s) => (
              <li key={s.platform}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {s.name}
                </a>
              </li>
            ))}
          </Column>
          </div>
        </div>

        <Link
          href={ROUTES.home}
          aria-label="Medidakos home"
          className="self-start focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mdk-charcoal"
        >
          <Wordmark size="footer" />
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] leading-4 text-mdk-charcoal-muted">© 2026 Medidakos. All rights reserved.</p>
          <ul className="flex flex-wrap gap-x-6">
            <li><Link href={ROUTES.privacy} className={legalClass}>Privacy Policy</Link></li>
            <li><Link href={ROUTES.terms} className={legalClass}>Terms of Service</Link></li>
            <li>
              <button type="button" onClick={openCookieSettings} className={legalClass}>
                Cookie Settings
              </button>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
