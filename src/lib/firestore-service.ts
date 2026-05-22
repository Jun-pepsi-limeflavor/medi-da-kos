"use client";

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import type {
  CMBrief,
  Order,
  SampleRequest,
  ShippingAddress,
  TrackingEntry,
  UserProfile,
} from "./types";
import { getFirebaseDb } from "./firebase";
import {
  mockGetBrief,
  mockSaveBrief,
  mockGetTracking,
  mockSaveTracking,
  mockAddSampleRequest,
  mockGetOrders,
  mockAddOrder,
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
  const data = snap.data() as CMBrief;
  return migrateBrief(data);
}

function migrateBrief(brief: CMBrief): CMBrief {
  const legacy = brief.step2 as { packaging?: string[] } | undefined;
  if (legacy?.packaging && !brief.step2?.selections) {
    return {
      ...brief,
      step2: {
        selections: legacy.packaging.map((p) => ({
          group: p,
          items: [],
        })),
      },
    };
  }
  const cat = brief.step1?.category as string | undefined;
  if (cat === "makeup") {
    return { ...brief, step1: { category: "cosmetic" } };
  }
  return brief;
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

export async function createOrder(
  order: Omit<Order, "id" | "createdAt" | "updatedAt">,
): Promise<Order> {
  const now = new Date().toISOString();
  const full: Order = {
    ...order,
    id: "",
    createdAt: now,
    updatedAt: now,
  };

  if (useMockAuth()) {
    return mockAddOrder(full);
  }

  const ref = await addDoc(collection(getFirebaseDb(), "orders"), {
    ...order,
    createdAt: now,
    updatedAt: now,
    serverCreatedAt: serverTimestamp(),
  });

  return { ...full, id: ref.id };
}

export async function loadOrders(uid: string): Promise<Order[]> {
  if (useMockAuth()) {
    return mockGetOrders(uid);
  }

  const q = query(
    collection(getFirebaseDb(), "orders"),
    where("uid", "==", uid),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Order)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export async function saveSampleRequest(
  uid: string,
  data: {
    sampleProductId: string;
    sampleProductName: string;
    sampleQuantity: number;
    shippingAddress: ShippingAddress;
  },
): Promise<SampleRequest> {
  const now = new Date().toISOString();
  const payload = {
    uid,
    ...data,
    status: "submitted" as const,
    createdAt: now,
  };

  let sampleRequest: SampleRequest;

  if (useMockAuth()) {
    sampleRequest = mockAddSampleRequest(payload);
  } else {
    const ref = await addDoc(
      collection(getFirebaseDb(), "sampleRequests"),
      {
        ...payload,
        serverCreatedAt: serverTimestamp(),
      },
    );
    sampleRequest = { id: ref.id, ...payload };
  }

  await createOrder({
    uid,
    type: "sample",
    status: "submitted",
    title: data.sampleProductName,
    summary: `Sample qty: ${data.sampleQuantity}`,
    referenceId: sampleRequest.id,
  });

  return sampleRequest;
}

export async function submitCustomBrief(brief: CMBrief): Promise<void> {
  const submitted: CMBrief = {
    ...brief,
    requestType: "custom",
    status: "submitted",
    updatedAt: new Date().toISOString(),
  };
  await saveCMBrief(submitted);

  await createOrder({
    uid: brief.uid,
    type: "custom",
    status: "submitted",
    title: `Custom ODM — ${submitted.step1?.category === "cosmetic" ? "Cosmetic" : "Skin Care"}`,
    summary: buildCustomOrderSummary(submitted),
    referenceId: brief.uid,
  });
}

function buildCustomOrderSummary(brief: CMBrief): string {
  const parts: string[] = [];
  if (brief.step4?.moq) parts.push(`MOQ: ${brief.step4.moq}`);
  if (brief.step4?.volume)
    parts.push(`Volume: ${brief.step4.volume} ${brief.step4.unit}`);
  if (brief.step2?.selections?.length) {
    parts.push(
      `Packaging: ${brief.step2.selections.map((s) => s.group).join(", ")}`,
    );
  }
  return parts.join(" · ") || "Custom manufacturing brief submitted";
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
