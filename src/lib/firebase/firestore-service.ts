"use client";

// Firestore 쓰기(브라우저): users/{uid} 회원 프로필 저장(saveUserProfile)·contact 문의 저장.
// - submitContactForm: 기존 운영 Contact 형식(formVersion 없음) — 그대로 유지
// - submitInquiry: 리뉴얼 Contact(formVersion 2, 2026-11). 필드·길이는 firestore.rules의 validContactV2와 맞춘다
// - 저장 값은 user-profile-write가 만든다. 기존 문서가 있으면 빈 값으로 덮어쓰지 않는다(2026-11-12)
// - Mock 모드에서는 아무것도 저장하지 않는다
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import type { ContactSubmission, UserProfile } from "@/lib/types";
import { isNonProductionEnv } from "@/lib/utils/env-flags";
// useMockAuth is a plain env check, not a React hook: aliased so the hooks lint rule does not misfire here.
import { getFirebaseDb, useMockAuth as isMockAuth } from "@/lib/firebase/client";
import { stripUndefined } from "@/lib/firebase/sanitize";
import { userProfileWrite } from "@/lib/firebase/user-profile-write";

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  if (isMockAuth()) return;
  const ref = doc(getFirebaseDb(), "users", profile.uid);
  const existing = await getDoc(ref);
  // A later Google sign-in must not blank the phone · country · company saved at email sign-up (user-profile-write).
  await setDoc(ref, userProfileWrite(profile, existing.exists(), isNonProductionEnv()), { merge: true });
}

export type ContactFormPayload = {
  companyName: string;
  email: string;
  referralSource?: string;
  businessType?: string;
  message: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  pageUrl?: string;
  gaClientId?: string;
  userAgent?: string;
  /** 로그인 회원의 본인 uid(rules가 uid == auth.uid를 요구). 비로그인이면 넣지 않는다. */
  uid?: string;
  /** 제출 브라우저에서 boot된 Channel 고객 id. 얻지 못하면 넣지 않는다(서버가 server_lead로 처리). */
  channelUserId?: string;
};

export async function submitContactForm(
  data: ContactFormPayload,
): Promise<ContactSubmission> {
  const now = new Date().toISOString();
  const payload = {
    ...data,
    isTest: isNonProductionEnv(),
    status: "submitted" as const,
    createdAt: now,
  };

  if (isMockAuth()) {
    const id = `mock-contact-${Date.now()}`;
    console.info("[mock] contact submission", { id, ...payload });
    return { id, ...payload };
  }

  const ref = await addDoc(
    collection(getFirebaseDb(), "contact"),
    stripUndefined({
      ...payload,
      serverCreatedAt: serverTimestamp(),
    }),
  );

  return { id: ref.id, ...payload };
}

/** Renewal Contact form fields (strings trimmed, empty optionals omitted — see toInquiryFields). */
export type InquiryFields = {
  fullName: string;
  email: string;
  companyName: string;
  /** Where the person is based. */
  country: string;
  productCategory: string;
  quantityPerSku: number;
  /** Where the product will be sold (free text). */
  targetMarkets: string;
  website?: string;
  launchDate?: string;
  message?: string;
  /** Promotion interest checkbox, only while the promotion runs. */
  promoInterest?: boolean;
};

export type InquiryPayload = InquiryFields & {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  pageUrl?: string;
  userAgent?: string;
  /** Signed-in member's own uid (rules require uid == auth.uid). */
  uid?: string;
  /** Channel Talk user id booted in this browser, when available. */
  channelUserId?: string;
};

/** Optional tracking strings are cut to the rules limits instead of failing the whole inquiry. */
function clip(value: string | undefined, max: number): string | undefined {
  return typeof value === "string" && value ? value.slice(0, max) : undefined;
}

/**
 * Saves a renewal Contact inquiry to `contact` (formVersion 2). The existing Functions pick it up from there:
 * admin notification mail (onContactCreated) and Channel Talk chat + internal note (channelTalkOnContactCreated).
 * Mock mode logs and saves nothing.
 */
export async function submitInquiry(data: InquiryPayload): Promise<{ id: string }> {
  const doc = {
    ...data,
    utmSource: clip(data.utmSource, 200),
    utmMedium: clip(data.utmMedium, 200),
    utmCampaign: clip(data.utmCampaign, 200),
    utmContent: clip(data.utmContent, 200),
    utmTerm: clip(data.utmTerm, 200),
    pageUrl: clip(data.pageUrl, 2000),
    userAgent: clip(data.userAgent, 1000),
    formVersion: 2 as const,
    isTest: isNonProductionEnv(),
    status: "submitted" as const,
    createdAt: new Date().toISOString(),
  };

  if (isMockAuth()) {
    const id = `mock-inquiry-${Date.now()}`;
    console.info("[mock] contact inquiry (formVersion 2) — not saved", { id, ...doc });
    return { id };
  }

  const ref = await addDoc(
    collection(getFirebaseDb(), "contact"),
    stripUndefined({ ...doc, serverCreatedAt: serverTimestamp() }),
  );
  return { id: ref.id };
}
