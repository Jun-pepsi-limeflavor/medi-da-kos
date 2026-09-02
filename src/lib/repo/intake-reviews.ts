import "server-only";
import { getAdminDb } from "@/lib/firebase-admin";
import type { AdminIdentity } from "@/lib/admin-auth";
import {
  intakeReviewId,
  intakeReviewInputSchema,
  type IntakeReview,
} from "@/lib/schemas/intake-review";

const COLLECTION = "intakeReviews";

export async function getIntakeReview(
  source: string,
  externalId: string,
): Promise<IntakeReview | null> {
  const doc = await getAdminDb().collection(COLLECTION).doc(intakeReviewId(source, externalId)).get();
  return doc.exists ? (doc.data() as IntakeReview) : null;
}

/** /admin/intakes가 원천 네 컬렉션과 한 번에 조인할 때 쓴다 — 문서마다 개별 조회하지 않는다. */
export async function listIntakeReviews(): Promise<Map<string, IntakeReview>> {
  const snap = await getAdminDb().collection(COLLECTION).get();
  return new Map(snap.docs.map((d) => [d.id, d.data() as IntakeReview]));
}

/**
 * URL의 source·externalId가 body 값보다 우선한다. 검증 실패 시 z.ZodError를 던진다 —
 * 호출자(route handler)가 이를 잡아 400으로 옮긴다.
 */
export async function setIntakeReview(
  source: string,
  externalId: string,
  input: unknown,
  actor: AdminIdentity,
): Promise<IntakeReview> {
  const body = typeof input === "object" && input !== null ? input : {};
  const parsed = intakeReviewInputSchema.parse({ ...body, source, externalId });
  const record: IntakeReview = {
    ...parsed,
    reviewedBy: actor.email,
    reviewedAt: new Date().toISOString(),
  };
  await getAdminDb()
    .collection(COLLECTION)
    .doc(intakeReviewId(source, externalId))
    .set(record, { merge: true });
  return record;
}

import { type DealItemInput } from "@/lib/schemas/deal";

export type QualifiedIntakeWithBuyer = {
  id: string;
  source: string;
  externalId: string;
  email?: string;
  companyName?: string;
  contactName?: string;
  phone?: string;
  country?: string;
  shippingInfo?: {
    recipientName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
    taxId?: string;
  };
  certifications?: string[];
  timeline?: {
    targetSampleDate?: string;
    targetDeliveryDate?: string;
  };
  additionalRequests?: string;
  items?: DealItemInput[];
  rawSummary?: string;
  rawDetails?: Record<string, unknown>;
  reviewedBy?: string;
  reviewedAt?: string;
};

function parseQuantity(val: unknown, defaultQty = 1000): number {
  if (typeof val === "number" && !isNaN(val) && val > 0) return Math.floor(val);
  if (typeof val === "string") {
    const num = parseInt(val.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(num) && num > 0) return num;
  }
  return defaultQty;
}

/**
 * 승인된(qualified) 인테이크 목록의 원천 문서(orders, sampleRequests, contact, koreaLeads, messages)와
 * users 컬렉션을 조회하여 문의자의 이메일, 바이어 정보, 그리고 요청 제품(items) 및 상세 내역을 파싱한다.
 */
export async function resolveQualifiedIntakeDetails(
  qualified: Array<{
    id: string;
    source: string;
    externalId: string;
    reviewedBy?: string;
    reviewedAt?: string;
  }>,
): Promise<QualifiedIntakeWithBuyer[]> {
  if (qualified.length === 0) return [];

  const db = getAdminDb();
  const docRefs: FirebaseFirestore.DocumentReference[] = [];
  const sourceKeyMap = new Map<string, { source: string; externalId: string }>();
  const messageThreadKeys: string[] = [];

  for (const item of qualified) {
    if (item.source === "order") {
      const ref = db.collection("orders").doc(item.externalId);
      docRefs.push(ref);
      sourceKeyMap.set(ref.path, { source: item.source, externalId: item.externalId });
    } else if (item.source === "sampleRequest") {
      const ref = db.collection("sampleRequests").doc(item.externalId);
      docRefs.push(ref);
      sourceKeyMap.set(ref.path, { source: item.source, externalId: item.externalId });
    } else if (item.source === "contact") {
      const ref = db.collection("contact").doc(item.externalId);
      docRefs.push(ref);
      sourceKeyMap.set(ref.path, { source: item.source, externalId: item.externalId });
    } else if (item.source === "koreaLead") {
      const ref = db.collection("koreaLeads").doc(item.externalId);
      docRefs.push(ref);
      sourceKeyMap.set(ref.path, { source: item.source, externalId: item.externalId });
    } else if (item.source === "landingRequest") {
      const ref = db.collection("landingRequests").doc(item.externalId);
      docRefs.push(ref);
      sourceKeyMap.set(ref.path, { source: item.source, externalId: item.externalId });
    } else if (item.source === "message") {
      messageThreadKeys.push(item.externalId);
    }
  }

  const sourceDocs = docRefs.length > 0 ? await db.getAll(...docRefs) : [];
  const dataBySourceKey = new Map<string, FirebaseFirestore.DocumentData>();
  const uids = new Set<string>();

  for (const doc of sourceDocs) {
    if (doc.exists) {
      const info = sourceKeyMap.get(doc.ref.path);
      if (info) {
        const data = doc.data()!;
        dataBySourceKey.set(`${info.source}:${info.externalId}`, data);
        if (data.uid && typeof data.uid === "string") {
          uids.add(data.uid);
        }
      }
    }
  }

  const userDocs = uids.size > 0
    ? await db.getAll(...[...uids].map((uid) => db.collection("users").doc(uid)))
    : [];
  const userByUid = new Map<string, FirebaseFirestore.DocumentData>();
  for (const doc of userDocs) {
    if (doc.exists) {
      userByUid.set(doc.id, doc.data()!);
    }
  }

  const messageDataByKey = new Map<string, {
    email?: string;
    buyerName?: string;
    brandName?: string;
    country?: string;
    shippingInfo?: QualifiedIntakeWithBuyer["shippingInfo"];
    certifications?: string[];
    timeline?: QualifiedIntakeWithBuyer["timeline"];
    items?: DealItemInput[];
    rawSummary?: string;
    rawDetails?: Record<string, unknown>;
  }>();

interface ExtractedItem {
  productName?: string;
  category?: string;
  variantName?: string;
  volume?: string;
  expectedQty?: number | string;
  formula?: { texture?: string; formulaType?: string; keyIngredients?: string; notes?: string };
  packaging?: { containerType?: string; material?: string; outerBox?: string; notes?: string };
}

interface MessageDocData {
  id?: string;
  sentAt?: string;
  direction?: string;
  from?: string;
  to?: string[];
  fromName?: string;
  bodyText?: string;
  snippet?: string;
  accepted?: {
    buyer?: { email?: string; name?: string; brandName?: string; companyName?: string; country?: string };
    shipping?: { recipientName?: string; addressLine1?: string; city?: string; country?: string; postalCode?: string };
    timeline?: { sampleTargetDate?: string; targetLaunchDate?: string };
    certifications?: { requiredCerts?: string[] };
    items?: ExtractedItem[];
  };
  extraction?: {
    buyer?: { email?: string; name?: string; brandName?: string; companyName?: string; country?: string };
    shipping?: { recipientName?: string; addressLine1?: string; city?: string; country?: string; postalCode?: string };
    timeline?: { sampleTargetDate?: string; targetLaunchDate?: string };
    certifications?: { requiredCerts?: string[] };
    items?: ExtractedItem[];
  };
}

interface BriefPkgSelection {
  group?: string;
  items?: string[];
}

  if (messageThreadKeys.length > 0) {
    await Promise.all(
      messageThreadKeys.map(async (threadKey) => {
        try {
          const msgSnap = await db
            .collection("messages")
            .where("threadKey", "==", threadKey)
            .get();
          if (!msgSnap.empty) {
            const msgs = msgSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as MessageDocData);
            msgs.sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));
            // accepted 또는 extraction이 있는 메시지 우선 탐색, 없으면 인바운드 앵커 메시지, 없으면 최신 메시지
            const m =
              msgs.find((msg) => msg.accepted && Object.keys(msg.accepted).length > 0) ||
              msgs.find((msg) => msg.extraction && Object.keys(msg.extraction).length > 0) ||
              msgs.find((msg) => msg.direction === "in") ||
              msgs[0];
            const ext = m.accepted || m.extraction || {};
            const buyer = ext.buyer || {};
            const shipping = ext.shipping || {};
            const timeline = ext.timeline || {};
            const certs = ext.certifications?.requiredCerts || [];

            const parsedItems: DealItemInput[] = (ext.items || []).map((it) => ({
              productType: it.productName || it.category || "화장품",
              variantName: it.variantName || "",
              volume: it.volume || "",
              quantity: parseQuantity(it.expectedQty, 1000),
              formulaSpec: {
                targetTexture: it.formula?.texture || it.formula?.formulaType || "",
                keyIngredients: it.formula?.keyIngredients || "",
                notes: it.formula?.notes || "",
              },
              packagingSpec: {
                containerType: it.packaging?.containerType || "",
                material: it.packaging?.material || "",
                closure: it.packaging?.outerBox || "",
                notes: it.packaging?.notes || "",
              },
            }));

            const inboundMsg = msgs.find((msg) => msg.direction === "in");
            const email =
              buyer.email ||
              (m.direction === "in" ? m.from : (inboundMsg?.from || m.to?.[0])) ||
              "";

            messageDataByKey.set(threadKey, {
              email: email.trim(),
              buyerName: buyer.name || m.fromName || inboundMsg?.fromName,
              brandName: buyer.brandName || buyer.companyName,
              country: buyer.country || shipping.country,
              shippingInfo: shipping.country ? {
                recipientName: shipping.recipientName || buyer.name || m.fromName || inboundMsg?.fromName,
                addressLine1: shipping.addressLine1 || "본사 확인 대기",
                city: shipping.city || "",
                country: shipping.country || "미국 (USA)",
                postalCode: shipping.postalCode || "",
              } : undefined,
              certifications: certs.length > 0 ? certs : undefined,
              timeline: timeline.sampleTargetDate || timeline.targetLaunchDate ? {
                targetSampleDate: timeline.sampleTargetDate,
                targetDeliveryDate: timeline.targetLaunchDate,
              } : undefined,
              items: parsedItems.length > 0 ? parsedItems : undefined,
              rawSummary: m.bodyText || m.snippet || "",
              rawDetails: { message: m, extraction: ext },
            });
            return;
          }

          const threadDoc = await db.collection("threads").doc(threadKey).get();
          if (threadDoc.exists) {
            const tData = threadDoc.data();
            if (tData?.buyerId && typeof tData.buyerId === "string" && tData.buyerId.includes("@")) {
              messageDataByKey.set(threadKey, { email: tData.buyerId, rawDetails: tData });
            }
          }
        } catch {
          // ignore error and proceed
        }
      }),
    );
  }

  return qualified.map((item) => {
    let email: string | undefined;
    let companyName: string | undefined;
    let contactName: string | undefined;
    let phone: string | undefined;
    let country: string | undefined;
    let shippingInfo: QualifiedIntakeWithBuyer["shippingInfo"] = undefined;
    let certifications: string[] | undefined = undefined;
    let timeline: QualifiedIntakeWithBuyer["timeline"] = undefined;
    let additionalRequests: string | undefined = undefined;
    let items: DealItemInput[] = [];
    let rawSummary: string | undefined = undefined;
    let rawDetails: Record<string, unknown> | undefined = undefined;

    if (item.source === "order" || item.source === "sampleRequest") {
      const data = dataBySourceKey.get(`${item.source}:${item.externalId}`);
      if (data) {
        rawDetails = data;
        const user = data.uid ? userByUid.get(data.uid) : undefined;
        email = (user?.email as string) || (data.email as string) || (data.buyerEmail as string) || undefined;
        companyName = (user?.companyName as string) || (data.companyName as string) || undefined;
        contactName =
          (user?.displayName as string) ||
          (data.shippingAddress?.recipientName as string) ||
          (data.recipientName as string) ||
          undefined;
        phone = (user?.phone as string) || (data.shippingAddress?.phone as string) || (data.phone as string) || undefined;
        country = (user?.country as string) || (data.shippingAddress?.country as string) || undefined;

        if (data.shippingAddress) {
          shippingInfo = {
            recipientName: data.shippingAddress.recipientName || contactName,
            addressLine1: data.shippingAddress.addressLine1 || "본사 확인 대기",
            addressLine2: data.shippingAddress.addressLine2 || "",
            city: data.shippingAddress.city || "",
            state: data.shippingAddress.stateOrProvince || "",
            postalCode: data.shippingAddress.postalCode || "",
            country: data.shippingAddress.country || country || "미국 (USA)",
            phone: data.shippingAddress.phone || phone,
          };
        }

        if (item.source === "order") {
          const brief = (data.briefSnapshot || {}) as {
            step1?: { selection?: string; category?: string };
            step2?: { selections?: BriefPkgSelection[] };
            step4?: { volume?: string; unit?: string; orderQuantity?: string; moq?: string; sampleRequestDate?: string; targetLaunchDate?: string };
            step5?: { textureNotes?: string; viscosity?: string; fragranceNotes?: string; unscented?: boolean; fragranceFree?: boolean; colorHex?: string; finishNotes?: string };
            step6?: { productName?: string; conceptIngredients?: string; vegan?: boolean; internationalCertifications?: string[] };
          };
          const step1 = brief.step1 || {};
          const step2 = brief.step2 || {};
          const step4 = brief.step4 || {};
          const step5 = brief.step5 || {};
          const step6 = brief.step6 || {};

          const pType = step6.productName || step1.selection || step1.category || data.title || "스킨케어 화장품";
          const vName = step6.productName || "";
          const vol = step4.volume ? `${step4.volume}${step4.unit || "ml"}` : "";
          const qty = parseQuantity(step4.orderQuantity || step4.moq, 1000);

          const pkgSelections = Array.isArray(step2.selections) ? step2.selections : [];
          const containerType = pkgSelections[0]?.group || (pkgSelections[0]?.items?.join(", ")) || "";
          const pkgNotes = pkgSelections.map((s: BriefPkgSelection) => `${s.group}: ${Array.isArray(s.items) ? s.items.join(", ") : ""}`).join("; ");

          const texture = step5.textureNotes || (step5.viscosity ? `점도: ${step5.viscosity}` : "");
          const scent = step5.fragranceNotes || (step5.unscented ? "무향 (Unscented)" : "") || (step5.fragranceFree ? "향료 무첨가" : "");
          const formulaNotes = [step5.finishNotes, step6.vegan ? "비건 (Vegan)" : ""].filter(Boolean).join(" / ");

          items.push({
            productType: pType,
            variantName: vName,
            volume: vol,
            quantity: qty,
            formulaSpec: {
              targetTexture: texture || undefined,
              keyIngredients: step6.conceptIngredients || undefined,
              scent: scent || undefined,
              color: step5.colorHex || undefined,
              notes: formulaNotes || undefined,
            },
            packagingSpec: {
              containerType: containerType || undefined,
              notes: pkgNotes || undefined,
            },
          });

          if (step6.internationalCertifications && Array.isArray(step6.internationalCertifications)) {
            certifications = step6.internationalCertifications;
          }

          if (step4.sampleRequestDate || step4.targetLaunchDate) {
            timeline = {
              targetSampleDate: step4.sampleRequestDate || undefined,
              targetDeliveryDate: step4.targetLaunchDate || undefined,
            };
          }

          rawSummary = data.summary || `[${step1.selection || "ODM"}] ${pType} ${qty.toLocaleString()}개 의뢰`;
        } else if (item.source === "sampleRequest") {
          const sName = data.sampleProductName || "샘플 요청 제품";
          const sQty = parseQuantity(data.sampleQuantity, 5);
          items.push({
            productType: sName,
            variantName: "샘플",
            volume: "샘플 규격",
            quantity: sQty,
            formulaSpec: {},
            packagingSpec: {},
          });
          rawSummary = `샘플 요청: ${sName} (${sQty}개)`;
        }
      }
    } else if (item.source === "contact" || item.source === "koreaLead" || item.source === "landingRequest") {
      const data = dataBySourceKey.get(`${item.source}:${item.externalId}`);
      if (data) {
        rawDetails = data;
        email = (data.email as string) || undefined;
        companyName = (data.companyName as string) || undefined;
        contactName = (data.name as string) || (data.contactName as string) || undefined;
        phone = (data.phone as string) || undefined;
        country = (data.country as string) || "미국 (USA)";

        let pType = "문의 제품";
        let qty = 1000;
        if (item.source === "koreaLead") {
          pType = "콜드메일 유입 제품 의뢰";
          qty = parseQuantity(data.expectedVolume, 3000);
          additionalRequests = `[포지셔닝: ${data.positioningArm || "arm-a"}] ${data.message || ""}`.trim();
          rawSummary = `[KoreaLead] 희망볼륨: ${data.expectedVolume || "미정"} | 메시지: ${data.message || ""}`;
        } else if (item.source === "contact") {
          pType = data.businessType ? `[${data.businessType}] 의뢰 제품` : "Contact 문의 제품";
          additionalRequests = data.message || "";
          rawSummary = `[Contact] ${data.businessType || ""} | ${data.message || ""}`;
        } else if (item.source === "landingRequest") {
          pType = data.serviceType || "랜딩 견적 요청 제품";
          additionalRequests = data.message || "";
          rawSummary = `[Landing] ${data.message || ""}`;
        }

        items.push({
          productType: pType,
          variantName: "",
          volume: "",
          quantity: qty,
          formulaSpec: {
            notes: (data.message as string) || undefined,
          },
          packagingSpec: {},
        });
      }
    } else if (item.source === "message") {
      const mInfo = messageDataByKey.get(item.externalId);
      if (mInfo) {
        email = mInfo.email;
        contactName = mInfo.buyerName;
        companyName = mInfo.brandName;
        country = mInfo.country;
        shippingInfo = mInfo.shippingInfo;
        certifications = mInfo.certifications;
        timeline = mInfo.timeline;
        if (mInfo.items && mInfo.items.length > 0) {
          items = mInfo.items;
        }
        rawSummary = mInfo.rawSummary;
        rawDetails = mInfo.rawDetails;
      }
    }

    // 기본 제품 1개 보장
    if (items.length === 0) {
      items.push({
        productType: "화장품 제품",
        variantName: "",
        volume: "",
        quantity: 1000,
        formulaSpec: {},
        packagingSpec: {},
      });
    }

    return {
      ...item,
      email: email?.trim() || undefined,
      companyName: companyName?.trim() || undefined,
      contactName: contactName?.trim() || undefined,
      phone: phone?.trim() || undefined,
      country: country?.trim() || undefined,
      shippingInfo,
      certifications,
      timeline,
      additionalRequests: additionalRequests?.trim() || undefined,
      items,
      rawSummary: rawSummary?.trim() || undefined,
      rawDetails,
    };
  });
}
