"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  BUSINESS_TYPES,
  REFERRAL_SOURCES,
} from "@/lib/contact-form-options";
import { trackConversionEvent } from "@/lib/analytics";
import { getGaClientId } from "@/lib/ga-client-id";
import { submitContactForm } from "@/lib/firestore-service";
import { useUtmParams } from "@/hooks/use-utm-params";

const inputClass =
  "w-full rounded-lg border border-sky-100 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100";
const selectClass = `${inputClass} appearance-none`;
const textareaClass = `${inputClass} min-h-[8.5rem] resize-y leading-relaxed`;

const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";

export function ContactForm() {
  const utmParams = useUtmParams();

  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [message, setMessage] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmedCompany = companyName.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (!trimmedCompany || !trimmedEmail || !trimmedMessage) {
      setError("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      const gaId = process.env.NEXT_PUBLIC_GA_ID;
      const gaClientId = gaId ? await getGaClientId(gaId) : null;

      await submitContactForm({
        companyName: trimmedCompany,
        email: trimmedEmail,
        referralSource: referralSource || undefined,
        businessType: businessType || undefined,
        message: trimmedMessage,
        ...utmParams,
        pageUrl: window.location.href,
        gaClientId: gaClientId ?? undefined,
        userAgent: navigator.userAgent,
      });

      trackConversionEvent("contact_form_submit", {
        referral_source: referralSource || undefined,
        business_type: businessType || undefined,
        utm_source: utmParams.utmSource,
        utm_medium: utmParams.utmMedium,
        utm_campaign: utmParams.utmCampaign,
      });

      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-sky-100/80 bg-sky-50/40 px-6 py-12 text-center">
        <CheckCircle2
          className="mx-auto mb-4 text-sky-500"
          size={40}
          strokeWidth={1.5}
        />
        <h2 className="font-serif text-xl font-semibold text-slate-800">
          Thank you for reaching out
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          We&apos;ve received your inquiry and will get back to you within 1–2
          business days.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-sky-100/80 bg-white px-6 py-8 shadow-sm shadow-sky-100/30 sm:px-8"
    >
      <div className="space-y-5">
        <div>
          <label htmlFor="companyName" className={labelClass}>
            Company / Brand name <span className="text-sky-600">*</span>
          </label>
          <input
            id="companyName"
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className={inputClass}
            autoComplete="organization"
          />
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            Email <span className="text-sky-600">*</span>
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            autoComplete="email"
          />
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

        <div>
          <label htmlFor="message" className={labelClass}>
            Message <span className="text-sky-600">*</span>
          </label>
          <textarea
            id="message"
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Product category, expected quantity, target launch date, etc."
            className={textareaClass}
          />
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded-lg bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Send inquiry"}
      </button>
    </form>
  );
}
