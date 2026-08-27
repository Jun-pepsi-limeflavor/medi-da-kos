"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { submitLandingRequest, validateLandingContact } from "@/lib/landing/request";
import { trackLandingEvent } from "@/lib/landing/analytics";
import type { LandingCatalogItem, LandingRequestInput, LandingVariant } from "@/lib/landing/types";
import type { CMBrief } from "@/lib/types";
import { useLandingAttribution } from "./useLandingAttribution";
import { ConsultationSuccess } from "./ConsultationSuccess";
import { shouldReduceLandingMotion } from "@/lib/landing/motion";

export function ConsultationForm({ variant, catalogItems, dashboardBrief, onBack }: { variant: LandingVariant; catalogItems?: LandingCatalogItem[]; dashboardBrief?: CMBrief; onBack?: () => void }) {
  const attribution = useLandingAttribution();
  const formRef = useRef<HTMLElement>(null);
  const [fields, setFields] = useState({ companyName: "", contactName: "", email: "", country: "", expectedVolume: "", message: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof fields, string>>>({});
  const [failure, setFailure] = useState(""); const [sending, setSending] = useState(false); const [complete, setComplete] = useState(false);
  useEffect(() => {
    if (shouldReduceLandingMotion() || !formRef.current) return;
    const context = gsap.context(() => {
      gsap.fromTo("[data-consultation-heading]", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.32, ease: "power2.out" });
      gsap.fromTo("[data-consultation-field]", { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.26, stagger: 0.045, delay: 0.06, ease: "power2.out" });
      gsap.fromTo("[data-consultation-submit]", { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.24, delay: 0.3, ease: "power2.out" });
    }, formRef);
    return () => context.revert();
  }, []);
  if (complete) return <ConsultationSuccess />;
  function change(key: keyof typeof fields, value: string) { setFields((current) => ({ ...current, [key]: value })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); const nextErrors = validateLandingContact(fields); setErrors(nextErrors); setFailure("");
    if (Object.keys(nextErrors).length) return;
    const input: LandingRequestInput = variant === "catalog"
      ? { ...fields, landingVariant: "catalog", catalogItems: catalogItems ?? [] }
      : { ...fields, landingVariant: "dashboard", dashboardBrief: dashboardBrief! };
    setSending(true);
    try { await submitLandingRequest(input, attribution); trackLandingEvent("consultation_submit", variant, { expected_volume: fields.expectedVolume, utm_source: attribution.utmSource, utm_medium: attribution.utmMedium, utm_campaign: attribution.utmCampaign, utm_content: attribution.utmContent }); setComplete(true); }
    catch { setFailure("We could not send your request. Please try again, or contact hally@medidakoslabs.com."); }
    finally { setSending(false); }
  }
  const labels: Array<[keyof typeof fields, string, boolean]> = [["companyName", "Company / brand name", true], ["contactName", "Contact name", true], ["email", "Work email", true], ["country", "Country", true], ["expectedVolume", "Expected order quantity", true], ["message", "Message", false]];
  return <section ref={formRef} className="mx-auto max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8"><div data-consultation-heading className="mb-6">{onBack && <button type="button" onClick={onBack} className="mb-4 text-sm font-medium text-sky-700 underline">Back to brief</button>}<h2 className="text-2xl font-semibold">Talk with our team</h2><p className="mt-2 text-slate-600">Share a few details and we will follow up by email.</p></div><form noValidate onSubmit={submit} className="space-y-5">{labels.map(([key, label, required]) => <label key={key} data-consultation-field className="block text-sm font-medium text-slate-700">{label}{required && " *"}{key === "message" ? <textarea value={fields[key]} onChange={(e) => change(key, e.target.value)} aria-describedby={errors[key] ? `${key}-error` : undefined} className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2" /> : <input type={key === "email" ? "email" : "text"} value={fields[key]} onChange={(e) => change(key, e.target.value)} aria-describedby={errors[key] ? `${key}-error` : undefined} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" />}{errors[key] && <span id={`${key}-error`} className="mt-1 block text-sm text-red-700">{errors[key]}</span>}</label>)}{failure && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{failure}</p>}<button data-consultation-submit disabled={sending} className="w-full rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-60">{sending ? "Sending…" : "Send consultation request"}</button></form></section>;
}
