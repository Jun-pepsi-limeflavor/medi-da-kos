"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  BUSINESS_TYPES,
  EXPECTED_VOLUMES,
  REFERRAL_SOURCES,
} from "@/lib/contact-form-options";
import { trackConversionEvent } from "@/lib/analytics";
import { getGaClientId } from "@/lib/ga-client-id";
import { submitKoreaLead } from "@/lib/firestore-service";

/** 폼이 죽었을 때의 대체 경로. 콜드메일 발신 계정이라 회신 스레드와 같은 곳으로 간다. */
const FALLBACK_EMAIL = "hally@medidakoslabs.com";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass =
  "w-full rounded-lg border border-sky-100 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100";
const selectClass = `${inputClass} appearance-none`;
const textareaClass = `${inputClass} min-h-[8.5rem] resize-y leading-relaxed`;
const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";
const fieldErrorClass = "mt-1.5 text-xs text-rose-600";

type FieldName =
  | "companyName"
  | "email"
  | "expectedVolume"
  | "message";

type UtmProps = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
};

export function KoreaLeadForm({
  positioningArm,
  utm,
}: {
  positioningArm: string;
  utm: UtmProps;
}) {
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [expectedVolume, setExpectedVolume] = useState("");
  const [message, setMessage] = useState("");

  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FieldName, string>>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function validate(field: FieldName, value: string): string {
    const trimmed = value.trim();
    switch (field) {
      case "companyName":
        return trimmed ? "" : "Which brand is this for?";
      case "email":
        if (!trimmed) return "We need an email to reply to.";
        return EMAIL_PATTERN.test(trimmed)
          ? ""
          : "That email doesn't look right.";
      case "expectedVolume":
        return trimmed ? "" : 'Pick a range — "Not sure yet" is a real answer.';
      case "message":
        return trimmed ? "" : "One line is enough, but we need one.";
    }
  }

  function handleBlur(field: FieldName, value: string) {
    setFieldErrors((prev) => ({ ...prev, [field]: validate(field, value) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const nextErrors: Partial<Record<FieldName, string>> = {
      companyName: validate("companyName", companyName),
      email: validate("email", email),
      expectedVolume: validate("expectedVolume", expectedVolume),
      message: validate("message", message),
    };
    setFieldErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    try {
      const gaId = process.env.NEXT_PUBLIC_GA_ID;
      const gaClientId = gaId ? await getGaClientId(gaId) : null;

      const lead = await submitKoreaLead({
        companyName: companyName.trim(),
        email: email.trim(),
        referralSource: referralSource || undefined,
        businessType: businessType || undefined,
        expectedVolume,
        message: message.trim(),
        positioningArm,
        ...utm,
        pageUrl: window.location.href,
        gaClientId: gaClientId ?? undefined,
        userAgent: navigator.userAgent,
      });

      // 이벤트는 write가 성공한 뒤에만. 클릭이 아니라 실제 저장을 센다.
      // 이벤트를 늘리는 대신 파라미터로 분해한다 — 구글 권장명 generate_lead 유지.
      trackConversionEvent("generate_lead", {
        form_id: "coldmail-landing",
        lead_type: "quote",
        positioning_arm: positioningArm,
        expected_volume: expectedVolume,
        is_test: lead.isTest,
        utm_source: utm.utmSource,
        utm_medium: utm.utmMedium,
        utm_campaign: utm.utmCampaign,
        utm_content: utm.utmContent,
      });

      setSubmitted(true);
    } catch {
      setError(
        `That didn't go through. Try again, or send it straight to ${FALLBACK_EMAIL} and we'll pick it up there.`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-sky-100/90 bg-sky-50/40 p-8 text-center shadow-sm shadow-sky-100/30">
        <CheckCircle2
          className="mx-auto mb-4 text-sky-500"
          size={40}
          strokeWidth={1.5}
        />
        <h3 className="font-serif text-xl font-semibold text-slate-800">
          Got it.
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          This is with our production team now. You&apos;ll hear back within a
          week with feasibility, MOQ, unit cost, and lead time.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          If it isn&apos;t a fit, we&apos;ll say so — that&apos;s an answer too.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-2xl border border-sky-100/90 bg-white/85 p-6 shadow-md shadow-sky-100/35 sm:p-8"
    >
      <div className="space-y-5">
        <div>
          <label htmlFor="companyName" className={labelClass}>
            Company / Brand name <span className="text-sky-600">*</span>
          </label>
          <input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            onBlur={(e) => handleBlur("companyName", e.target.value)}
            className={inputClass}
            autoComplete="organization"
            aria-invalid={Boolean(fieldErrors.companyName)}
          />
          {fieldErrors.companyName && (
            <p className={fieldErrorClass}>{fieldErrors.companyName}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            Email <span className="text-sky-600">*</span>
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={(e) => handleBlur("email", e.target.value)}
            className={inputClass}
            autoComplete="email"
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldErrors.email && (
            <p className={fieldErrorClass}>{fieldErrors.email}</p>
          )}
        </div>

        <div>
          <label htmlFor="referralSource" className={labelClass}>
            How did you hear about us?
          </label>
          <select
            id="referralSource"
            value={referralSource}
            onChange={(e) => setReferralSource(e.target.value)}
            className={selectClass}
          >
            <option value="">Select an option</option>
            {REFERRAL_SOURCES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="businessType" className={labelClass}>
            Which of the following best describes you?
          </label>
          <select
            id="businessType"
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            className={selectClass}
          >
            <option value="">Select an option</option>
            {BUSINESS_TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* 물량을 message 바로 위에 둔다 — 스펙이 아직 추상일 때 "몇 개"에 답하게 하는 배치 */}
        <div>
          <label htmlFor="expectedVolume" className={labelClass}>
            Expected volume, first run <span className="text-sky-600">*</span>
          </label>
          <select
            id="expectedVolume"
            value={expectedVolume}
            onChange={(e) => {
              setExpectedVolume(e.target.value);
              if (fieldErrors.expectedVolume) {
                setFieldErrors((prev) => ({ ...prev, expectedVolume: "" }));
              }
            }}
            onBlur={(e) => handleBlur("expectedVolume", e.target.value)}
            className={selectClass}
            aria-invalid={Boolean(fieldErrors.expectedVolume)}
          >
            <option value="">Select a range</option>
            {EXPECTED_VOLUMES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {fieldErrors.expectedVolume ? (
            <p className={fieldErrorClass}>{fieldErrors.expectedVolume}</p>
          ) : (
            <p className="mt-1.5 text-xs text-slate-500">
              A rough number is fine. It decides which packaging options are on
              the table.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="message" className={labelClass}>
            Message <span className="text-sky-600">*</span>
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onBlur={(e) => handleBlur("message", e.target.value)}
            placeholder="Product category, target launch date, or just the idea — whatever you have."
            className={textareaClass}
            aria-invalid={Boolean(fieldErrors.message)}
          />
          {fieldErrors.message && (
            <p className={fieldErrorClass}>{fieldErrors.message}</p>
          )}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-rose-100 bg-rose-50/60 px-4 py-3 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded-full bg-sky-500/90 px-8 py-3 text-sm font-semibold text-white shadow-sm shadow-sky-200/50 transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-300 disabled:hover:bg-sky-300"
      >
        {submitting ? "Sending…" : "Send it over"}
      </button>

      <p className="mt-3 text-center text-xs text-slate-500">
        Goes to our production team. No call, nothing to sign.
      </p>
      <p className="mt-1 text-center text-xs text-slate-500">
        We use what you send here to answer your inquiry. Nothing else.
      </p>
    </form>
  );
}
