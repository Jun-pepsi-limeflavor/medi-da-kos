"use client";

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import type { CMBrief, TrackingEntry, UserProfile } from "./types";
import { getFirebaseDb } from "./firebase";
import {
  mockGetBrief,
  mockSaveBrief,
  mockGetTracking,
  mockSaveTracking,
} from "./mock-store";
import { useMockAuth } from "./firebase";

function defaultBrief(uid: string): CMBrief {
  const now = new Date().toISOString();
  return {
    uid,
    currentStep: 1,
    requestType: "custom",
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

export async function loadCMBrief(uid: string): Promise<CMBrief> {
  if (useMockAuth()) {
    return mockGetBrief(uid) ?? defaultBrief(uid);
  }
  const ref = doc(getFirebaseDb(), "cmBriefs", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return defaultBrief(uid);
  return snap.data() as CMBrief;
}

export async function saveCMBrief(brief: CMBrief): Promise<void> {
  const payload = { ...brief, updatedAt: new Date().toISOString() };
  if (useMockAuth()) {
    mockSaveBrief(payload);
    return;
  }
  await setDoc(doc(getFirebaseDb(), "cmBriefs", brief.uid), {
    ...payload,
    serverUpdatedAt: serverTimestamp(),
  });
}

export async function saveSampleRequest(
  uid: string,
  partial: Pick<
    CMBrief,
    | "sampleProductId"
    | "sampleProductName"
    | "sampleQuantity"
    | "shippingAddress"
  >,
): Promise<void> {
  const existing = await loadCMBrief(uid);
  const now = new Date().toISOString();
  const brief: CMBrief = {
    ...existing,
    ...partial,
    uid,
    requestType: "sample",
    status: "submitted",
    currentStep: 1,
    updatedAt: now,
    createdAt: existing.createdAt || now,
  };
  await saveCMBrief(brief);
}

export async function loadTracking(uid: string): Promise<TrackingEntry[]> {
  if (useMockAuth()) return mockGetTracking(uid);
  const col = collection(getFirebaseDb(), "tracking", uid, "entries");
  const snap = await getDocs(col);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrackingEntry);
}

export async function saveTracking(
  uid: string,
  entries: TrackingEntry[],
): Promise<void> {
  if (useMockAuth()) {
    mockSaveTracking(uid, entries);
    return;
  }
  for (const entry of entries) {
    await setDoc(
      doc(getFirebaseDb(), "tracking", uid, "entries", entry.id),
      entry,
    );
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  if (useMockAuth()) return;
  await setDoc(doc(getFirebaseDb(), "users", profile.uid), profile);
}
