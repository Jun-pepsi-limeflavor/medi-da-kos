"use client";

// Contact 2 · Inquiry Form — Firestore contact 저장(formVersion 2, 2026-11).
// - About you · Your project · Have a brief? (optional) · (프로모션 기간) 관심 체크박스 · Send inquiry
//   Have a brief? 아래 'Not ready? Skip this…' 안내는 삭제(2026.11.12 확정), 제목의 (optional)은 유지
// - Company / brand name placeholder 'Your company or brand'(2026.11.12 확정, Sign Up Company name과 같음)
// - 입력칸·오류 표시는 Log In·Sign Up과 같은 공통 Input / FormMessage를 재사용
// - 검증 시점도 Log In·Sign Up과 같다: 제출할 때 모든 필드 검사 → 오류 필드 표시 + 첫 오류 필드로 포커스,
//   오류가 난 필드는 입력할 때마다 다시 검사해 고치면 바로 해제(포커스 해제 시 검사는 하지 않음)
// - 버튼 위 FormMessage(error): 현재 필드 오류에서 바로 계산 — 필수 누락이 남으면 "Please fill in the required fields and try again.",
//   형식 오류만 남으면 "Please correct the highlighted fields and try again.", 마지막 오류를 고치면 재제출 없이 즉시 사라짐(자동 제출 없음).
//   실제 제출 실패 안내(submitError)는 입력 검증과 별개로 다음 제출 때까지 유지
// - 포커스 해제 시 수량만 천 단위 쉼표로 표기 정리
// - 2026.11.11 확정: Desired launch date·Message는 선택 항목(* 없음, 비워도 제출). 출시일은 형식 없는 텍스트
//   (placeholder 'e.g., Q1 2027, March 2027, or TBD'). Message 아래 8px에 MOQ 안내와 같은 스타일의 안내 문구, placeholder는 기존 그대로
// - 프로모션 기간: 관심 체크박스 표시(기본 미선택, 고객이 직접 선택), 선택 여부는 문의 데이터의 별도 항목(promoInterest).
//   모든 진입(일반·프로모션 CTA)은 /contact 하나 — 진입 URL로 체크박스·Message를 바꾸지 않는다(2026-11-10 확정)
// - 예전에 공유된 /contact?promo=… 주소: 처음 열릴 때 promo 값만 주소창에서 지우고 다른 query·입력값은 유지
// - 제출: submitInquiry로 contact 문서 저장 → 기존 Functions가 관리자 메일·Channel Talk 상담·내부 메모를 만든다.
//   회원이면 본인 uid, 브라우저 Channel 고객 id는 바로 얻을 때만 넣는다(기존 ContactForm과 같음). 저장 성공 후에만 완료 화면,
//   실패하면 오류 안내 + 입력값 유지(재시도 가능). Mock 모드는 저장하지 않고 완료 화면(data-mock-submission),
//   단 운영 도메인에서는 Mock이어도 허위 성공 화면을 띄우지 않는다
// - GA4 generate_lead · Meta Lead는 아직 연결하지 않는다(별도 승인 후 저장 성공 직후 위치에 추가)
// - 브리프 첨부(BriefUpload)는 업로드 저장소가 없어 숨김(BRIEF_UPLOAD_ENABLED). 코드·디자인은 유지, 템플릿 다운로드는 표시
// - 제출 성공 후: 완료 메시지가 렌더링된 뒤 그 위치(Navbar 72 + 24px 아래)로 한 번 스크롤하고(동작 줄이기 설정이면 즉시),
//   완료 메시지(tabIndex -1)로 포커스를 옮긴다(추가 스크롤 없음). 검증·저장 실패 시에는 이동하지 않는다
// - Message 입력칸: 테두리를 inset 그림자 대신 실제 border로 그려 스크롤바가 테두리 안쪽에 오게 하고,
//   얇은 스크롤바(보이는 thumb 6px + 오른쪽 테두리와 5px 간격, 투명 트랙, mid-gray 둥근 thumb)를 이 입력칸에만 적용.
//   thumb 양끝은 같은 3px 반원(투명 border 두께 명시 + 모서리별 반경 보정, SNS 모달 Caption과 같은 방식, 2026-11-11).
//   테두리+여백 합은 기존과 같은 18px·16px
import Image from "next/image";
import { useEffect, useId, useRef, useState, type FocusEvent, type FormEvent } from "react";
import { BriefUpload } from "@/components/contact/BriefUpload";
import {
  INQUIRY_FIELDS,
  OPTIONAL_FIELDS,
  formatQuantity,
  inquiryErrorSummary,
  toInquiryFields,
  validateInquiry,
  validateInquiryField,
  type InquiryField,
  type InquiryValues,
} from "@/components/contact/inquiry-validation";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { BRIEF_TEMPLATE } from "@/lib/config/downloads";
import { SUPPORT_EMAIL } from "@/lib/config/site";
import { useAuth } from "@/lib/auth/auth-context";
import { getChannelTalkUserId } from "@/lib/channel-talk/client";
import { contactIdentityFields } from "@/lib/channel-talk/intake";
import { useMockAuth } from "@/lib/firebase/client";
import { submitInquiry } from "@/lib/firebase/firestore-service";
import { readUtmParams } from "@/hooks/use-utm-params";
import { isNonProductionEnv } from "@/lib/utils/env-flags";
import { cx } from "@/lib/utils/cx";

/** Query parameter of the retired promotion link (/contact?promo=year-end-2026). */
const LEGACY_PROMO_PARAM = "promo";
/** Navbar 72 + 24px: where 'Inquiry sent' lands after submitting (same offset as the site's anchor scrolls). */
const SENT_SCROLL_OFFSET = 96;
/** Brief attachments have no storage yet: the dropzone stays hidden so no one thinks files were sent. */
const BRIEF_UPLOAD_ENABLED = false;
const SUBMIT_FAILED = `We couldn’t send your inquiry. Please try again, or email us at ${SUPPORT_EMAIL}.`;

const EMPTY: InquiryValues = {
  fullName: "",
  email: "",
  company: "",
  country: "",
  website: "",
  productCategory: "",
  quantity: "",
  targetMarkets: "",
  launchDate: "",
  message: "",
};

type FieldConfig = {
  label: string;
  placeholder: string;
  type?: "text" | "email" | "url";
  inputMode?: "numeric" | "text";
  autoComplete?: string;
  note?: string;
};

/** Helper text under an input (same style for the quantity MOQ note and the Message note). */
const FIELD_NOTE = "text-mdk-caption text-mdk-charcoal-muted";

/** Figma: labels and placeholders (Inquiry Form 291:721). */
const FIELDS: Record<InquiryField, FieldConfig> = {
  fullName: { label: "Full name *", placeholder: "Your name", autoComplete: "name" },
  email: { label: "Email *", placeholder: "name@company.com", type: "email", autoComplete: "email" },
  company: { label: "Company / brand name *", placeholder: "Your company or brand", autoComplete: "organization" },
  country: { label: "Country *", placeholder: "Your country", autoComplete: "country-name" },
  website: { label: "Website or social link", placeholder: "https://", type: "url", autoComplete: "url" },
  productCategory: { label: "Product category *", placeholder: "e.g., serum, sunscreen, cushion" },
  quantity: {
    label: "Estimated quantity per SKU *",
    placeholder: "e.g., 5,000",
    inputMode: "numeric",
    note: "Standard MOQ starts at 5,000 units per SKU (may vary with packaging).",
  },
  targetMarkets: { label: "Target markets *", placeholder: "e.g., United States, United Kingdom" },
  launchDate: { label: "Desired launch date", placeholder: "e.g., Q1 2027, March 2027, or TBD" },
  message: {
    label: "Message",
    placeholder:
      "Tell us about your product idea — concept, key ingredients or claims, reference products, and what you already have (formula, packaging, design).",
    note: "The more details you share, the faster we can respond to your inquiry.",
  },
};

const SECTION_TITLE = "text-mdk-title text-mdk-charcoal";

export function InquiryForm({ showPromo }: { showPromo: boolean }) {
  const formId = useId();
  const [values, setValues] = useState<InquiryValues>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<InquiryField, string>>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [promoInterest, setPromoInterest] = useState(false);
  // Submission failure (not input validation): kept until the next submit.
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const sentRef = useRef<HTMLDivElement>(null);
  const mock = useMockAuth();
  const { user } = useAuth();

  // Old shared links (/contact?promo=…) no longer change the form: drop just that parameter from the address bar,
  // keeping any other query and the hash. replaceState(null) lets Next sync its router without a reload or scroll.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(LEGACY_PROMO_PARAM)) return;
    url.searchParams.delete(LEGACY_PROMO_PARAM);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, []);

  // After a successful submission only: bring 'Inquiry sent' into view below the sticky Navbar, once, measured
  // after the message has rendered, then move focus there without a second scroll.
  useEffect(() => {
    const el = sentRef.current;
    if (!sent || !el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - SENT_SCROLL_OFFSET);
    window.scrollTo({ top, behavior: reduce ? "instant" : "smooth" });
    el.focus({ preventScroll: true });
  }, [sent]);

  const idFor = (field: InquiryField) => `${formId}-${field}`;

  /** Same as Log In · Sign Up: while a field shows an error, re-check it on every edit so it updates or clears. */
  const onChange = (field: InquiryField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      const error = validateInquiryField(field, value);
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  };

  /** Blur only tidies the display (no validation): quantity thousands commas. */
  const onBlur = (field: InquiryField) => (event: FocusEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    const tidy = field === "quantity" ? formatQuantity(raw) : raw;
    if (tidy !== raw) onChange(field, tidy);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const found = validateInquiry(values);
    setErrors(found);
    const first = INQUIRY_FIELDS.find((field) => found[field]);
    setSubmitError(null);
    if (first) {
      document.getElementById(idFor(first))?.focus();
      return;
    }

    // Mock mode saves nothing, so it must never show a success screen on the production domain.
    if (mock && !isNonProductionEnv()) {
      setSubmitError(SUBMIT_FAILED);
      return;
    }

    setSubmitting(true);
    try {
      await submitInquiry({
        ...toInquiryFields(values, showPromo ? promoInterest : undefined),
        ...readUtmParams(),
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
        // Member's own uid, and the browser's Channel user id only if already available (never waits).
        ...contactIdentityFields({ uid: user?.uid, channelUserId: getChannelTalkUserId() }),
      });
      // GA4 generate_lead / Meta Lead go here once approved (after a successful save only).
      setSent(true);
    } catch (error) {
      console.error("contact inquiry submit failed", error);
      setSubmitError(SUBMIT_FAILED);
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div ref={sentRef} tabIndex={-1} data-mock-submission={mock ? "true" : undefined} className="outline-none">
        <FormMessage type="success" title="Inquiry sent">
          Thanks — we&apos;ve received your inquiry. We&apos;ll reply by email within 5–7 business days.
        </FormMessage>
      </div>
    );
  }

  // Validation notice follows the live field errors (clears as soon as the last one is fixed); a submission failure wins.
  const formNotice = submitError ?? inquiryErrorSummary(errors);

  const field = (name: InquiryField) => {
    const config = FIELDS[name];
    const noteId = `${idFor(name)}-note`;
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <Input
          id={idFor(name)}
          name={name}
          label={config.label}
          value={values[name]}
          placeholder={config.placeholder}
          type={config.type ?? "text"}
          inputMode={config.inputMode}
          autoComplete={config.autoComplete ?? "off"}
          aria-required={OPTIONAL_FIELDS.has(name) ? undefined : true}
          aria-describedby={config.note ? noteId : undefined}
          onChange={(e) => onChange(name, e.target.value)}
          onBlur={onBlur(name)}
          error={errors[name]}
        />
        {config.note ? (
          <p id={noteId} className={FIELD_NOTE}>
            {config.note}
          </p>
        ) : null}
      </div>
    );
  };

  const messageError = errors.message;
  const messageErrorId = `${idFor("message")}-error`;
  const messageNoteId = `${idFor("message")}-note`;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label="Inquiry form"
      className="flex flex-col gap-10 rounded-mdk-lg border border-mdk-light-gray bg-mdk-white p-6 sm:p-8 lg:p-12"
    >
      <div role="group" aria-labelledby={`${formId}-about`} className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id={`${formId}-about`} className={SECTION_TITLE}>
            About you
          </h2>
          <p className="text-mdk-caption text-mdk-charcoal-muted">Fields marked * are required.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-x-5">
          {field("fullName")}
          {field("email")}
          {field("company")}
          {field("country")}
        </div>
        {field("website")}
      </div>

      <div
        role="group"
        aria-labelledby={`${formId}-project`}
        className="flex min-w-0 flex-col gap-6 border-t border-mdk-light-gray pt-10"
      >
        <h2 id={`${formId}-project`} className={SECTION_TITLE}>
          Your project
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-x-5">
          {field("productCategory")}
          {field("quantity")}
          {field("targetMarkets")}
          {field("launchDate")}
        </div>
        {/* Textarea: no shared component, so it mirrors Input's label · border · error styles. */}
        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor={idFor("message")} className="text-mdk-label text-mdk-charcoal">
            {FIELDS.message.label}
          </label>
          <textarea
            id={idFor("message")}
            name="message"
            value={values.message}
            placeholder={FIELDS.message.placeholder}
            aria-invalid={messageError ? true : undefined}
            aria-describedby={messageError ? `${messageErrorId} ${messageNoteId}` : messageNoteId}
            onChange={(e) => onChange("message", e.target.value)}
            className={cx(
              "h-[168px] w-full resize-y overflow-y-auto rounded-[4px] bg-mdk-white text-mdk-body text-mdk-charcoal outline-none placeholder:text-mdk-charcoal-muted",
              // Real border (not an inset shadow) so the scrollbar sits inside it; padding + border = 18px / 16px as before.
              messageError
                ? "border-[1.5px] border-mdk-error px-[16.5px] py-[14.5px]"
                : "border border-mdk-light-gray px-[17px] py-[15px] focus:border-[1.5px] focus:border-mdk-charcoal focus:px-[16.5px] focus:py-[14.5px]",
              // Thin scrollbar, transparent track: WebKit/Blink via pseudo-elements, Firefox via scrollbar-width/color.
              // 11px bar = 6px visible thumb + 5px transparent thumb border on the right (background-clip keeps it
              // unpainted), so the thumb stands 5px off the right border; the track is inset 4px top and bottom.
              // Border widths are explicit (3px top/bottom, 0 left; unset sides would default to 3px) and each corner
              // radius adds its borders back (8px×6px / 3px×6px) so both ends are the same 3px semicircle.
              "[&::-webkit-scrollbar]:w-[11px] [&::-webkit-scrollbar-track]:my-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-corner]:bg-transparent",
              "[&::-webkit-scrollbar-thumb]:rounded-l-[3px_6px] [&::-webkit-scrollbar-thumb]:rounded-r-[8px_6px] [&::-webkit-scrollbar-thumb]:border-y-[3px] [&::-webkit-scrollbar-thumb]:border-r-[5px] [&::-webkit-scrollbar-thumb]:border-l-0 [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-mdk-mid-gray [&::-webkit-scrollbar-thumb]:bg-clip-padding",
              "supports-[-moz-appearance:none]:[scrollbar-width:thin] supports-[-moz-appearance:none]:[scrollbar-color:var(--color-mdk-mid-gray)_transparent]",
            )}
          />
          {messageError ? (
            <p id={messageErrorId} className="text-mdk-caption text-mdk-error">
              {messageError}
            </p>
          ) : null}
          <p id={messageNoteId} className={FIELD_NOTE}>
            {FIELDS.message.note}
          </p>
        </div>
      </div>

      <div
        role="group"
        aria-labelledby={`${formId}-brief`}
        className="flex min-w-0 flex-col gap-5 border-t border-mdk-light-gray pt-10"
      >
        <h2 id={`${formId}-brief`} className={SECTION_TITLE}>
          Have a brief? (optional)
        </h2>
        {BRIEF_UPLOAD_ENABLED ? <BriefUpload files={files} onChange={setFiles} /> : null}
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-mdk-body text-mdk-charcoal">
          Need a template?
          <a
            href={BRIEF_TEMPLATE.href}
            download={BRIEF_TEMPLATE.fileName}
            className="flex items-center gap-1 py-1 text-[15px] leading-5 font-semibold tracking-[-0.003em] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-charcoal"
          >
            Download brief template
            <Image src="/icons/download.svg" alt="" width={16} height={16} />
          </a>
        </p>
      </div>

      <div className="flex flex-col gap-7 border-t border-mdk-light-gray pt-10">
        {showPromo ? (
          <label className="flex cursor-pointer items-center gap-3 text-mdk-body text-mdk-charcoal">
            <input
              type="checkbox"
              checked={promoInterest}
              onChange={(e) => setPromoInterest(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className={cx(
                "flex size-5 shrink-0 items-center justify-center rounded-[4px] border peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-mdk-charcoal",
                promoInterest ? "border-mdk-charcoal bg-mdk-charcoal" : "border-mdk-mid-gray bg-mdk-white",
              )}
            >
              {promoInterest ? <Image src="/icons/check-white.svg" alt="" width={12} height={12} /> : null}
            </span>
            I&apos;m interested in the year-end 10% offer.
          </label>
        ) : null}
        <div className="flex flex-col items-start gap-3">
          {formNotice ? (
            <FormMessage type="error" className="w-full">
              {formNotice}
            </FormMessage>
          ) : null}
          <Button type="submit" disabled={submitting}>
            Send inquiry
          </Button>
          <p className="text-[14px] leading-5 tracking-[-0.002em] text-mdk-charcoal-muted">
            We&apos;ll reply by email within 5–7 business days.
          </p>
        </div>
      </div>
    </form>
  );
}
