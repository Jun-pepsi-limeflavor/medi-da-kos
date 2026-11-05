"use client";

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
import { getFirebaseDb } from "@/lib/firebase/client";
import { useMockAuth } from "@/lib/firebase/client";
import { stripUndefined } from "@/lib/firebase/sanitize";

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  if (useMockAuth()) return;
  const { uid, email, displayName, phone, country, companyName, provider, createdAt } =
    profile;
  const ref = doc(getFirebaseDb(), "users", uid);
  const existing = await getDoc(ref);
  const mutable = {
    displayName,
    phone,
    country,
    companyName,
    provider,
    isTest: isNonProductionEnv(),
  };
  await setDoc(
    ref,
    stripUndefined(existing.exists() ? mutable : { uid, email, createdAt, ...mutable }),
    { merge: true },
  );
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

  if (useMockAuth()) {
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
