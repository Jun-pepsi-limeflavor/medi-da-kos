// DO NOT SEED — UI FIXTURE ONLY
import type { CrmMessage } from "./crm-types";

export interface MockDealFixture {
  id: string;
  title: string;
  buyerId: string;
  buyerName: string;
  buyerCountry: string;
  supplierId?: string;
  supplierName?: string;
  pmName: string;
  stageBrand: number;
  priority: "hot" | "warm" | "cold";
  buyerUnitPrice: number;
  buyerTotalQty: number;
  buyerTotalValue: number;
  productSpec: {
    productType: string;
    volumeMl: number;
    containerType: string;
    keyIngredients: string[];
    regulatoryNotes?: string;
    sampleStatus: string;
  };
  inquiryDate: string;
  sampleSentDate?: string;
  poDate?: string;
  expectedCloseDate?: string;
  updatedAt: string;
}

export const MOCK_DEALS: MockDealFixture[] = [
  {
    id: "deal-bala-spf15",
    title: "Bala - Rice Ceramide Lip SPF 15",
    buyerId: "buyer-bala",
    buyerName: "House of Seoul (Bala)",
    buyerCountry: "🇮🇳 India",
    supplierId: "supp-greencos",
    supplierName: "그린코스 (Greencos)",
    pmName: "이기욱 (Thomas)",
    stageBrand: 6,
    priority: "hot",
    buyerUnitPrice: 2.5,
    buyerTotalQty: 5000,
    buyerTotalValue: 12500,
    productSpec: {
      productType: "Lip Treatment",
      volumeMl: 10,
      containerType: "D19 Squeeze Tube",
      keyIngredients: ["Rice Ceramide", "SPF 15 Filters"],
      regulatoryNotes: "인도 전용 배송 — OTC 절차 미적용 확인 완료",
      sampleStatus: "approved",
    },
    inquiryDate: "2026-08-10",
    sampleSentDate: "2026-08-14",
    poDate: "2026-08-21",
    expectedCloseDate: "2026-09-30",
    updatedAt: "2026-08-21 14:30",
  },
  {
    id: "deal-div20-ghkcu",
    title: "Division Twenty - GHK-Cu Serum 30ml",
    buyerId: "buyer-div20",
    buyerName: "Division Twenty",
    buyerCountry: "🇺🇸 USA",
    supplierId: "supp-pfnature",
    supplierName: "피에프네이처",
    pmName: "송준하 (COO)",
    stageBrand: 2,
    priority: "hot",
    buyerUnitPrice: 4.8,
    buyerTotalQty: 5000,
    buyerTotalValue: 24000,
    productSpec: {
      productType: "Serum",
      volumeMl: 30,
      containerType: "Glass Dropper Bottle",
      keyIngredients: ["GHK-Cu Peptide 1%", "Hyaluronic Acid"],
      regulatoryNotes: "미국 MoCRA Facility 등록 상태 확인 완료",
      sampleStatus: "revision_needed",
    },
    inquiryDate: "2026-08-12",
    sampleSentDate: "2026-08-18",
    expectedCloseDate: "2026-10-15",
    updatedAt: "2026-08-21 09:00",
  },
  {
    id: "deal-charity-perfume",
    title: "Charity - Oud & Bergamot EDP 50ml",
    buyerId: "buyer-charity",
    buyerName: "Charity Fragrance Co.",
    buyerCountry: "🇬🇧 UK",
    supplierId: "supp-greencos",
    supplierName: "그린코스 (Greencos)",
    pmName: "이기욱 (Thomas)",
    stageBrand: 3,
    priority: "warm",
    buyerUnitPrice: 6.2,
    buyerTotalQty: 3000,
    buyerTotalValue: 18600,
    productSpec: {
      productType: "Eau de Parfum",
      volumeMl: 50,
      containerType: "Heavy-base Glass with Magnetic Cap",
      keyIngredients: ["Oud Accord", "Bergamot Calabrian", "Cedarwood"],
      regulatoryNotes: "UK IFRA 51th amendment 준수 증명서 발급 필요",
      sampleStatus: "in_formulation",
    },
    inquiryDate: "2026-08-15",
    expectedCloseDate: "2026-10-31",
    updatedAt: "2026-08-20 17:15",
  },
];

export const MOCK_MESSAGES: Record<string, CrmMessage[]> = {
  "deal-bala-spf15": [
    {
      id: "m1",
      dealId: "deal-bala-spf15",
      senderType: "buyer",
      senderName: "Bala S. Pinnamaneni",
      senderEmail: "balupinnamaneni@gmail.com",
      content:
        "Hello Medidakos team, we are looking to develop a 10ml Lip Treatment with SPF 15 and Rice Ceramide. Target MOQ is 5,000 units. Please review our formula target.",
      timestamp: "2026-08-10 11:20",
    },
    {
      id: "m2",
      dealId: "deal-bala-spf15",
      senderType: "pm",
      senderName: "이기욱 (Thomas)",
      content:
        "Hi Bala, received! We matched your formulation with Greencos factory. Free samples (5 units) will be produced and shipped via DHL within 7 business days.",
      timestamp: "2026-08-11 09:15",
    },
    {
      id: "m3",
      dealId: "deal-bala-spf15",
      senderType: "supplier",
      senderName: "양우덕 PM (그린코스)",
      content:
        "기욱 PM님, 립 SPF 15 10ml 튜브 내용물 샘플 준비 완료되었습니다. DHL 발송용 파우치 패킹 마쳤습니다.",
      timestamp: "2026-08-14 14:00",
      aiSummary: "그린코스 샘플 제조 완료 및 배송 준비 보고",
    },
    {
      id: "m4",
      dealId: "deal-bala-spf15",
      senderType: "buyer",
      senderName: "Bala S. Pinnamaneni",
      senderEmail: "balupinnamaneni@gmail.com",
      content:
        "Great news. We also accept the direct assignment agreement with Medidakos & Greencos. What is the DHL tracking number once dispatched?",
      timestamp: "2026-08-21 14:30",
      actionRequired: true,
      aiSummary: "계약 구조 수락 및 DHL 추적번호 요청 (회신 필요)",
    },
  ],
  "deal-div20-ghkcu": [
    {
      id: "m21",
      dealId: "deal-div20-ghkcu",
      senderType: "buyer",
      senderName: "Alex Turner",
      senderEmail: "alex@divisiontwenty.com",
      content:
        "Here is our target GHK-Cu 1% formulation file. Can you match this exactly at 5,000 MOQ?",
      timestamp: "2026-08-12 10:00",
    },
    {
      id: "m22",
      dealId: "deal-div20-ghkcu",
      senderType: "pm",
      senderName: "송준하 (COO)",
      content:
        "Alex, PF Nature factory verified the formulation. Quoted at $4.80/unit for 5,000 units. Official Quotation attached.",
      timestamp: "2026-08-18 16:30",
    },
    {
      id: "m23",
      dealId: "deal-div20-ghkcu",
      senderType: "system",
      senderName: "CRM System",
      content: "⚠️ Follow-up Alert: 4 days since Quotation sent without buyer reply.",
      timestamp: "2026-08-21 09:00",
      actionRequired: true,
    },
  ],
};
