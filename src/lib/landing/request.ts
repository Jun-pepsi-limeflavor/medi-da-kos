"use client";

import type { CMBrief } from "../types";
import type { LandingContactFields, LandingRequestContext, LandingRequestInput, LandingRequestSubmission } from "./types";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLandingContact(fields: LandingContactFields): Partial<Record<keyof LandingContactFields, string>> {
  const errors: Partial<Record<keyof LandingContactFields, string>> = {};
  const required: Array<[keyof LandingContactFields, number]> = [
    ["companyName", 200], ["contactName", 120], ["email", 320], ["country", 100], ["expectedVolume", 40],
  ];
  for (const [field, max] of required) {
    const value = fields[field]?.trim() ?? "";
    if (!value) errors[field] = "This field is required.";
    else if (value.length > max) errors[field] = `Use ${max} characters or fewer.`;
  }
  if (fields.email && !emailPattern.test(fields.email.trim())) errors.email = "Enter a valid work email address.";
  if ((fields.message?.length ?? 0) > 5000) errors.message = "Use 5,000 characters or fewer.";
  return errors;
}

function stripLogoDataUrl(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripLogoDataUrl);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => key !== "logoDataUrl")
    .map(([key, inner]) => [key, stripLogoDataUrl(inner)]));
}

function snapshotBrief(brief: CMBrief): Record<string, unknown> {
  return stripLogoDataUrl(brief) as Record<string, unknown>;
}

export function buildLandingRequest(input: LandingRequestInput, context: LandingRequestContext): LandingRequestSubmission {
  const errors = validateLandingContact(input);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  if (input.landingVariant === "catalog") {
    if ("dashboardBrief" in input && input.dashboardBrief !== undefined) throw new Error("catalog request cannot include dashboardBrief");
    if (!input.catalogItems.length || input.catalogItems.length > 12) throw new Error("catalog request must include 1 to 12 products");
  } else {
    if ("catalogItems" in input && input.catalogItems !== undefined) throw new Error("dashboard request cannot include catalogItems");
    if (!input.dashboardBrief) throw new Error("dashboard request requires dashboardBrief");
  }
  const base = {
    companyName: input.companyName.trim(), contactName: input.contactName.trim(), email: input.email.trim(),
    country: input.country.trim(), expectedVolume: input.expectedVolume.trim(), message: input.message?.trim() || undefined,
    ...context, isTest: typeof window === "undefined" || window.location.hostname.replace(/^www\./, "") !== "medidakos.com" || new URLSearchParams(window.location.search).has("qa"), status: "new" as const, createdAt: new Date().toISOString(),
  };
  return input.landingVariant === "catalog"
    ? { ...base, landingVariant: "catalog", catalogItems: input.catalogItems.map(({ id, name, category }) => ({ id, name, category })) }
    : { ...base, landingVariant: "dashboard", dashboardBrief: snapshotBrief(input.dashboardBrief) };
}

export async function submitLandingRequest(input: LandingRequestInput, context: LandingRequestContext): Promise<{ id: string; request: LandingRequestSubmission }> {
  const request = buildLandingRequest(input, context);
  const [{ addDoc, collection, serverTimestamp }, { getFirebaseDb, useMockAuth: isMockAuth }, { stripUndefined }] = await Promise.all([
    import("firebase/firestore"), import("../firebase"), import("../firestore-sanitize"),
  ]);
  if (isMockAuth()) return { id: `landing-mock-${Date.now()}`, request };
  const ref = await addDoc(collection(getFirebaseDb(), "landingRequests"), stripUndefined({ ...request, serverCreatedAt: serverTimestamp() }));
  return { id: ref.id, request };
}
