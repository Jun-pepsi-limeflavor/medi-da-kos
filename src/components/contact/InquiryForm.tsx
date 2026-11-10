"use client";

// Contact 2 · Inquiry Form — Mock 제출 단계(실제 저장·전송 없음).
// - About you · Your project · Have a brief? (optional) · (프로모션 기간) 관심 체크박스 · Send inquiry
// - 입력칸·오류 표시는 Log In·Sign Up과 같은 공통 Input / FormMessage를 재사용
// - 검증 시점도 Log In·Sign Up과 같다: 제출할 때 모든 필드 검사 → 오류 필드 표시 + 첫 오류 필드로 포커스,
//   오류가 난 필드는 입력할 때마다 다시 검사해 고치면 바로 해제(포커스 해제 시 검사는 하지 않음)
// - 버튼 위 FormMessage(error) "Some required fields are empty…" (Figma 문구, 인증 폼과 같은 오류 안내 UI)
// - 포커스 해제 시 수량은 천 단위 쉼표, 출시일은 'MM / YYYY'로 표기만 정리
// - ?promo=year-end-2026 진입: 체크박스 기본 선택 + Message 첫 줄 자동 입력 + 숨김 값 promo
// - 제출: Mock 모드이면서 운영 도메인이 아닐 때만 완료 화면(Figma 'Inquiry sent') 표시 — 개발용 확인은 콘솔 로그와
//   완료 메시지의 data-mock-submission 속성으로 한다. Firestore·Channel Talk·메일·GA4·Meta 호출 없음,
//   첨부 파일은 브라우저 밖으로 나가지 않는다. 그 밖의 환경에서는 제출하지 않고 오류 안내(허위 성공 화면 없음)
//   (실제 연동은 데이터 구조·규칙 승인 후 dev 환경에서 기존 submitContactForm 경로로 구현 예정)
import Image from "next/image";
import { useId, useState, type FocusEvent, type FormEvent } from "react";
import { BriefUpload } from "@/components/contact/BriefUpload";
import {
  INQUIRY_FIELDS,
  INQUIRY_MESSAGES,
  formatQuantity,
  normalizeLaunchDate,
  validateInquiry,
  validateInquiryField,
  type InquiryField,
  type InquiryValues,
} from "@/components/contact/inquiry-validation";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { BRIEF_TEMPLATE } from "@/lib/config/downloads";
import { YEAR_END_PROMO } from "@/lib/config/promo";
import { SUPPORT_EMAIL } from "@/lib/config/site";
import { useMockAuth } from "@/lib/firebase/client";
import { isNonProductionEnv } from "@/lib/utils/env-flags";
import { cx } from "@/lib/utils/cx";

/** Figma: Message first line when arriving from /contact?promo=year-end-2026. */
const PROMO_MESSAGE_LINE = "Interested in the year-end 10% offer";

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

/** Figma: labels and placeholders (Inquiry Form 291:721). */
const FIELDS: Record<InquiryField, FieldConfig> = {
  fullName: { label: "Full name *", placeholder: "Your name", autoComplete: "name" },
  email: { label: "Email *", placeholder: "name@company.com", type: "email", autoComplete: "email" },
  company: { label: "Company / brand name *", placeholder: "Company or brand", autoComplete: "organization" },
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
  launchDate: { label: "Desired launch date *", placeholder: "MM / YYYY", inputMode: "numeric" },
  message: {
    label: "Message *",
    placeholder:
      "Tell us about your product idea — concept, key ingredients or claims, reference products, and what you already have (formula, packaging, design).",
  },
};

const SECTION_TITLE = "text-mdk-title text-mdk-charcoal";

export function InquiryForm({ showPromo, promoFromLink }: { showPromo: boolean; promoFromLink: boolean }) {
  const formId = useId();
  const [values, setValues] = useState<InquiryValues>(() =>
    promoFromLink ? { ...EMPTY, message: `${PROMO_MESSAGE_LINE}\n` } : EMPTY,
  );
  const [errors, setErrors] = useState<Partial<Record<InquiryField, string>>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [promoInterest, setPromoInterest] = useState(promoFromLink);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const mock = useMockAuth();

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

  /** Blur only tidies the display (no validation): quantity thousands commas, launch date "MM / YYYY". */
  const onBlur = (field: InquiryField) => (event: FocusEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    const tidy = field === "quantity" ? formatQuantity(raw) : field === "launchDate" ? normalizeLaunchDate(raw) : raw;
    if (tidy !== raw) onChange(field, tidy);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const found = validateInquiry(values);
    setErrors(found);
    const first = INQUIRY_FIELDS.find((field) => found[field]);
    if (first) {
      setFormError(INQUIRY_MESSAGES.formError);
      document.getElementById(idFor(first))?.focus();
      return;
    }
    setFormError(null);

    // Not wired to Firestore / Channel Talk yet (pending data-structure approval). Outside local mock mode the form
    // never shows a success screen; the production domain is excluded even if the mock flag were set by mistake.
    if (!mock || !isNonProductionEnv()) {
      setFormError(`Online inquiries aren’t connected yet. Please email us at ${SUPPORT_EMAIL}.`);
      return;
    }

    setSubmitting(true);
    // Mock submission: stays in the browser. File contents are never read — only names and sizes are logged.
    await new Promise((resolve) => setTimeout(resolve, 600));
    console.info("[mock] contact inquiry — not sent (no Firestore / Channel Talk / email / analytics)", {
      ...values,
      promo: promoFromLink ? YEAR_END_PROMO.code : undefined,
      promoInterest: showPromo ? promoInterest : undefined,
      files: files.map((file) => ({ name: file.name, size: file.size })),
    });
    setSubmitting(false);
    setSent(true);
  };

  if (sent) {
    return (
      <div data-mock-submission="true">
        <FormMessage type="success" title="Inquiry sent">
          Thanks — we&apos;ve received your inquiry. We&apos;ll reply by email within 5–7 business days.
        </FormMessage>
      </div>
    );
  }

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
          aria-required={name === "website" ? undefined : true}
          aria-describedby={config.note ? noteId : undefined}
          onChange={(e) => onChange(name, e.target.value)}
          onBlur={onBlur(name)}
          error={errors[name]}
        />
        {config.note ? (
          <p id={noteId} className="text-mdk-caption text-mdk-charcoal-muted">
            {config.note}
          </p>
        ) : null}
      </div>
    );
  };

  const messageError = errors.message;
  const messageErrorId = `${idFor("message")}-error`;

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
            aria-required
            aria-invalid={messageError ? true : undefined}
            aria-describedby={messageError ? messageErrorId : undefined}
            onChange={(e) => onChange("message", e.target.value)}
            className={cx(
              "h-[168px] w-full resize-y rounded-[4px] bg-mdk-white px-[18px] py-4 text-mdk-body text-mdk-charcoal outline-none placeholder:text-mdk-charcoal-muted",
              messageError
                ? "shadow-[inset_0_0_0_1.5px_var(--color-mdk-error)]"
                : "shadow-[inset_0_0_0_1px_var(--color-mdk-light-gray)] focus:shadow-[inset_0_0_0_1.5px_var(--color-mdk-charcoal)]",
            )}
          />
          {messageError ? (
            <p id={messageErrorId} className="text-mdk-caption text-mdk-error">
              {messageError}
            </p>
          ) : null}
        </div>
      </div>

      <div
        role="group"
        aria-labelledby={`${formId}-brief`}
        className="flex min-w-0 flex-col gap-5 border-t border-mdk-light-gray pt-10"
      >
        <div className="flex flex-col gap-1.5">
          <h2 id={`${formId}-brief`} className={SECTION_TITLE}>
            Have a brief? (optional)
          </h2>
          <p className="text-mdk-body text-mdk-charcoal-muted">Not ready? Skip this — your message is enough.</p>
        </div>
        <BriefUpload files={files} onChange={setFiles} />
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
          {formError ? (
            <FormMessage type="error" className="w-full">
              {formError}
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
