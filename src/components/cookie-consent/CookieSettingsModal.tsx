"use client";

// Cookie Settings 모달(Figma 'Cookie Settings — Final (Prototype Overlay)' 714:14 · 'Cookie Settings Modal' 742:2167).
// - 640×784 흰 패널(radius 20): Header(제목·설명·X) → Body(카테고리 4행 + Cookie Details, 최대 560px 내부 스크롤) → Footer(Privacy Policy · 버튼 3개)
// - 열 때 저장값을 임시값(draft)으로 복사, 토글은 draft만 바꾼다. Save Preferences = draft 저장 · Accept All / Reject Optional = 즉시 저장
//   X·ESC·배경 클릭은 저장 없이 닫기(동의로 처리하지 않음). 저장 기록이 없으면 draft는 모두 꺼짐에서 시작
// - Essential은 'Always Active'(토글 없음). Cookie Details는 한 번 클릭으로 쿠키 6개 전체 펼침(중첩 아코디언 없음)
// - 구분선은 Figma처럼 각 행·Cookie Details 헤더·Footer의 위쪽 1px만(접힌 헤더 아래·펼친 마지막 항목 아래 선 없음).
//   설명은 두 문장을 줄바꿈해 표시(문단 간격 없음, 2026-11-11 Figma)
// - 작은 화면: 패널이 화면 높이 안에 들어가고 Body만 스크롤, Footer 버튼은 줄바꿈
import Link from "next/link";
import { useId, useState } from "react";
import { COOKIE_DETAIL_GROUPS, COOKIE_SETTINGS_COPY, ESSENTIAL_CATEGORY, OPTIONAL_CATEGORIES } from "@/components/cookie-consent/cookie-data";
import { Button } from "@/components/ui/Button";
import { CloseButton } from "@/components/ui/CloseButton";
import { Modal } from "@/components/ui/Modal";
import { ROUTES } from "@/lib/config/routes";
import { ALL_ACCEPTED, ALL_REJECTED, type CookieChoices, type CookieConsent } from "@/lib/cookie-consent/consent";
import { cx } from "@/lib/utils/cx";

/** Figma: each row has a 1px light-gray TOP border (no bottom border). */
const ROW = "flex flex-col gap-1.5 border-t border-mdk-light-gray py-5";
const LINK = "text-mdk-label text-mdk-charcoal underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-charcoal";

/** Figma: Consent Toggle (742:1673) — 44×24 track, 20px white knob. Off light-gray, On charcoal. */
function ConsentToggle({ checked, onChange, labelledBy }: { checked: boolean; onChange: (next: boolean) => void; labelledBy: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-charcoal",
        checked ? "bg-mdk-charcoal" : "bg-mdk-light-gray",
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-mdk-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform motion-reduce:transition-none",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

type CookieSettingsModalProps = {
  open: boolean;
  saved: CookieConsent | null;
  onClose: () => void;
  onSave: (choices: CookieChoices) => void;
};

export function CookieSettingsModal({ open, saved, onClose, onSave }: CookieSettingsModalProps) {
  const titleId = useId();
  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} className="w-[640px] rounded-[20px]">
      {/* Mounted per open, so the draft always starts from the saved choice. */}
      <SettingsPanel titleId={titleId} saved={saved} onClose={onClose} onSave={onSave} />
    </Modal>
  );
}

function SettingsPanel({ titleId, saved, onClose, onSave }: { titleId: string; saved: CookieConsent | null; onClose: () => void; onSave: (choices: CookieChoices) => void }) {
  const [draft, setDraft] = useState<CookieChoices>(() =>
    saved ? { analytics: saved.analytics, marketing: saved.marketing, functional: saved.functional } : ALL_REJECTED,
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const idBase = useId();
  const detailsId = `${idBase}-details`;

  return (
    <div className="flex max-h-[calc(100dvh-32px)] flex-col rounded-[20px] bg-mdk-white shadow-[0_16px_48px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)]">
      <div className="flex flex-col gap-2 px-5 pt-6 pb-4 sm:px-8 sm:pt-8 sm:pb-5">
        <div className="flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-mdk-title text-mdk-charcoal">
            {COOKIE_SETTINGS_COPY.title}
          </h2>
          <CloseButton onClick={onClose} label="Close cookie settings" variant="plain" className="-mr-2" />
        </div>
        <p className="text-mdk-body text-mdk-charcoal-muted">
          {COOKIE_SETTINGS_COPY.description[0]}
          <br />
          {COOKIE_SETTINGS_COPY.description[1]}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2 sm:max-h-[560px] sm:px-8">
        <div className={ROW}>
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-mdk-label text-mdk-charcoal">{ESSENTIAL_CATEGORY.name}</h3>
            <span className="shrink-0 text-mdk-label text-mdk-charcoal-muted">Always Active</span>
          </div>
          <p className="text-mdk-body text-mdk-charcoal-muted">{ESSENTIAL_CATEGORY.description}</p>
        </div>
        {OPTIONAL_CATEGORIES.map(({ key, name, description }) => {
          const nameId = `${idBase}-${key}`;
          return (
            <div key={key} className={ROW}>
              <div className="flex items-center justify-between gap-4">
                <h3 id={nameId} className="text-mdk-label text-mdk-charcoal">
                  {name}
                </h3>
                <ConsentToggle
                  checked={draft[key]}
                  labelledBy={nameId}
                  onChange={(next) => setDraft((current) => ({ ...current, [key]: next }))}
                />
              </div>
              <p className="text-mdk-body text-mdk-charcoal-muted">{description}</p>
            </div>
          );
        })}

        <div>
          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-controls={detailsId}
            onClick={() => setDetailsOpen((current) => !current)}
            className="flex w-full cursor-pointer items-center justify-between border-t border-mdk-light-gray py-5 text-left text-mdk-label text-mdk-charcoal focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mdk-charcoal"
          >
            Cookie Details
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={cx("transition-transform motion-reduce:transition-none", detailsOpen && "rotate-180")}>
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div id={detailsId} hidden={!detailsOpen} className="flex flex-col gap-6 pb-4">
            {COOKIE_DETAIL_GROUPS.map((group) => (
              <div key={group.title} className="flex flex-col gap-2.5">
                <h4 className="text-[14px] leading-5 font-medium text-mdk-charcoal">{group.title}</h4>
                {group.items.map((item) => (
                  <dl key={item.name} className="flex flex-col gap-2.5 rounded-xl bg-mdk-off-white p-4">
                    <dt className="sr-only">Cookie</dt>
                    <dd className="text-mdk-label text-mdk-charcoal [overflow-wrap:anywhere]">{item.name}</dd>
                    {([["Provider", item.provider], ["Purpose", item.purpose], ["Expiration", item.expiration]] as const).map(([label, value]) => (
                      <div key={label} className="flex gap-4">
                        <dt className="w-[88px] shrink-0 pt-0.5 text-mdk-caption text-mdk-charcoal-muted">{label}</dt>
                        <dd className="min-w-0 text-[14px] leading-5 tracking-[-0.1px] text-mdk-charcoal">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-mdk-light-gray px-5 pt-4 pb-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:pt-5 sm:pb-6">
        <Link href={ROUTES.privacy} onClick={onClose} className={cx(LINK, "self-start sm:self-auto")}>
          Privacy Policy
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="s" onClick={() => onSave(ALL_REJECTED)}>
            Reject Optional
          </Button>
          <Button variant="secondary" size="s" onClick={() => onSave(ALL_ACCEPTED)}>
            Accept All
          </Button>
          <Button variant="primary" size="s" onClick={() => onSave(draft)}>
            Save Preferences
          </Button>
        </div>
      </div>
    </div>
  );
}

export { LINK as COOKIE_LINK_CLASS };
