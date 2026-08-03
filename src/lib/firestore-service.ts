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
  deleteField,
} from "firebase/firestore";
import type {
  CMBrief,
  ContactSubmission,
  Order,
  SampleRequest,
  ShippingAddress,
  TrackingEntry,
  UserProfile,
} from "./types";
import { getStep1Selection, odmCategory } from "./step1-utils";
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
import { stripUndefined } from "./firestore-sanitize";

export function createDefaultCMBrief(
  uid: string,
  preserveCreatedAt?: string,
): CMBrief {
  const now = new Date().toISOString();
  return {
    uid,
    currentStep: 1,
    requestType: "custom",
    status: "draft",
    createdAt: preserveCreatedAt ?? now,
    updatedAt: now,
  };
}

/** Strip large logo payload — keep filename for orders / archives */
export function briefSnapshotForStorage(brief: CMBrief): Record<string, unknown> {
  const { step3, ...rest } = brief;
  const snapshot: Record<string, unknown> = {
    ...rest,
    status: "submitted",
    updatedAt: new Date().toISOString(),
  };
  if (step3) {
    snapshot.step3 = {
      logoFileName: step3.logoFileName,
    };
  }
  return stripUndefined(snapshot);
}

/** Clear wizard fields in Firestore so a new order starts fresh (drops large step3 logo). */
export async function resetCMBriefDraft(
  uid: string,
  preserveCreatedAt?: string,
): Promise<CMBrief> {
  const fresh = createDefaultCMBrief(uid, preserveCreatedAt);
  if (useMockAuth()) {
    mockSaveBrief(fresh);
    return fresh;
  }

  await setDoc(
    doc(getFirebaseDb(), "cmBriefs", uid),
    {
      uid: fresh.uid,
      currentStep: 1,
      requestType: "custom",
      status: "draft",
      createdAt: fresh.createdAt,
      updatedAt: fresh.updatedAt,
      step1: deleteField(),
      step2: deleteField(),
      step3: deleteField(),
      step4: deleteField(),
      step5: deleteField(),
      step6: deleteField(),
      sampleProductId: deleteField(),
      sampleProductName: deleteField(),
      sampleQuantity: deleteField(),
      shippingAddress: deleteField(),
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return fresh;
}

export async function loadCMBrief(uid: string): Promise<CMBrief> {
  if (useMockAuth()) {
    const stored = mockGetBrief(uid);
    if (!stored) return createDefaultCMBrief(uid);
    if (stored.status === "submitted") {
      return resetCMBriefDraft(uid, stored.createdAt);
    }
    return migrateBrief(stored);
  }
  const ref = doc(getFirebaseDb(), "cmBriefs", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return createDefaultCMBrief(uid);
  const raw = snap.data() as CMBrief;
  if (raw.status === "submitted") {
    return resetCMBriefDraft(uid, raw.createdAt);
  }
  return migrateBrief(raw);
}

function migrateBrief(brief: CMBrief): CMBrief {
  if (brief.status === "submitted") {
    return createDefaultCMBrief(brief.uid, brief.createdAt);
  }

  let next = { ...brief };

  const legacy = next.step2 as { packaging?: string[] } | undefined;
  if (legacy?.packaging && !next.step2?.selections) {
    next = {
      ...next,
      step2: {
        selections: legacy.packaging.map((p) => ({
          group: p,
          items: [],
        })),
      },
    };
  }

  if (next.step1 && !next.step1.selection) {
    const cat = next.step1.category as string | undefined;
    const selection =
      cat === "makeup"
        ? "cosmetic"
        : cat === "skincare" || cat === "cosmetic"
          ? cat
          : undefined;
    if (selection) {
      next = {
        ...next,
        step1: { ...next.step1, selection: selection as "skincare" | "cosmetic" },
      };
    }
  }

  return next;
}

export async function saveCMBrief(brief: CMBrief): Promise<void> {
  const payload = stripUndefined({
    ...brief,
    updatedAt: new Date().toISOString(),
  });
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

  const ref = await addDoc(
    collection(getFirebaseDb(), "orders"),
    stripUndefined({
      ...order,
      createdAt: now,
      updatedAt: now,
      serverCreatedAt: serverTimestamp(),
    }),
  );

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
      stripUndefined({
        ...payload,
        serverCreatedAt: serverTimestamp(),
      }),
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

export async function submitCustomBrief(brief: CMBrief): Promise<Order> {
  if (!getStep1Selection(brief.step1)) {
    throw new Error("Complete Step 1 before submitting your brief.");
  }

  const submitted: CMBrief = {
    ...brief,
    requestType: "custom",
    status: "submitted",
    updatedAt: new Date().toISOString(),
  };

  const category = odmCategory(submitted.step1);
  const submissionRef = `custom-${brief.uid}-${Date.now()}`;

  const order = await createOrder({
    uid: brief.uid,
    type: "custom",
    status: "submitted",
    title: `Custom ODM — ${
      category === "cosmetic" ? "Cosmetic" : "Skin Care"
    }`,
    summary: buildCustomOrderSummary(submitted),
    referenceId: submissionRef,
    briefSnapshot: briefSnapshotForStorage(submitted),
  });

  await resetCMBriefDraft(brief.uid, brief.createdAt);

  return order;
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
  await setDoc(
    doc(getFirebaseDb(), "users", profile.uid),
    stripUndefined(profile),
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
};

export async function submitContactForm(
  data: ContactFormPayload,
): Promise<ContactSubmission> {
  const now = new Date().toISOString();
  const payload = {
    ...data,
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
