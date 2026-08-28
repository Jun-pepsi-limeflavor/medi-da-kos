"use client";

import React from "react";
import Link from "next/link";
import { X, ExternalLink, Package, User, MapPin, Calendar, Award, Sparkles } from "lucide-react";
import { type IntakeReview } from "@/lib/schemas/intake-review";
import IntakeActions from "./IntakeActions";

export type IntakeRowDetail = {
  id: string; // intakeReviewId
  source: string;
  externalId: string;
  sourceRef: string;
  createdAt: string;
  buyerLabel: string;
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  country?: string;
  review: IntakeReview | null;
  summaryText?: string;
  shippingAddress?: {
    recipientName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    stateOrProvince?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
  };
  briefSnapshot?: Record<string, unknown>;
  sampleProductName?: string;
  sampleQuantity?: number;
  message?: string;
  businessType?: string;
  expectedVolume?: string;
  expectedVolumeLabel?: string;
  positioningArm?: string;
  serviceType?: string;
};

const SOURCE_LABEL: Record<string, string> = {
  order: "주문 / ODM 브리프",
  sampleRequest: "샘플 요청",
  contact: "일반 문의 (Contact)",
  koreaLead: "콜드메일 랜딩 (/korea)",
  landingRequest: "랜딩 견적 요청",
  message: "이메일 / 채널톡 메시지",
};

interface Step1Data {
  selection?: string;
  category?: string;
}

interface Step2Selection {
  group?: string;
  items?: string[];
}

interface Step4Data {
  orderQuantity?: string;
  volume?: string;
  unit?: string;
  sampleRequestDate?: string;
  targetLaunchDate?: string;
}

interface Step5Data {
  textureNotes?: string;
  viscosity?: string;
  fragranceNotes?: string;
  unscented?: boolean;
  fragranceFree?: boolean;
  colorHex?: string;
  finishNotes?: string;
}

interface Step6Data {
  productName?: string;
  conceptIngredients?: string;
  restrictedIngredients?: string;
  internationalCertifications?: string[];
}

export default function IntakeDetailModal({
  intake,
  onClose,
}: {
  intake: IntakeRowDetail;
  onClose: () => void;
}) {
  const brief = (intake.briefSnapshot || {}) as {
    step1?: Step1Data;
    step2?: { selections?: Step2Selection[] };
    step4?: Step4Data;
    step5?: Step5Data;
    step6?: Step6Data;
  };
  const step1 = brief.step1 || {};
  const step2 = brief.step2 || {};
  const step4 = brief.step4 || {};
  const step5 = brief.step5 || {};
  const step6 = brief.step6 || {};

  const isQualified = intake.review?.status === "qualified" && !intake.review?.isTest;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl text-xs">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="bg-indigo-950 text-indigo-300 border border-indigo-800/80 px-2.5 py-1 rounded-lg font-semibold text-xs flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              {SOURCE_LABEL[intake.source] || intake.source}
            </span>
            <div>
              <h3 className="font-bold text-sm text-neutral-100">
                인테이크 상세 미리보기
              </h3>
              <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                ID: {intake.externalId} | {intake.createdAt ? new Date(intake.createdAt).toLocaleString("ko-KR") : "날짜 미상"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* 판정 상태 카드 */}
          <div className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-neutral-400">현재 판정 상태:</span>
              {intake.review ? (
                <span
                  className={`font-semibold px-2 py-0.5 rounded-full border text-[11px] ${
                    intake.review.isTest
                      ? "border-amber-800 text-amber-400 bg-amber-950/30"
                      : intake.review.status === "qualified"
                      ? "border-emerald-800 text-emerald-400 bg-emerald-950/30"
                      : "border-rose-800 text-rose-400 bg-rose-950/30"
                  }`}
                >
                  {intake.review.isTest
                    ? "내부 테스트"
                    : intake.review.status === "qualified"
                    ? "정상 리드 (Qualified)"
                    : "반려 (Rejected)"}
                </span>
              ) : (
                <span className="font-semibold px-2 py-0.5 rounded-full border border-neutral-700 text-neutral-400 bg-neutral-800/50">
                  미판정 (Raw)
                </span>
              )}
            </div>
            {intake.review?.reason && (
              <span className="text-neutral-400 text-[11px]">
                사유: {intake.review.reason}
              </span>
            )}
          </div>

          {/* 바이어 정보 카드 */}
          <div className="p-3.5 rounded-xl bg-neutral-950/50 border border-neutral-800 space-y-2.5">
            <div className="flex items-center gap-2 text-neutral-200 font-semibold border-b border-neutral-800/80 pb-1.5">
              <User className="w-4 h-4 text-indigo-400" />
              <span>바이어 / 문의자 정보</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
              <div>
                <span className="text-neutral-500 block">회사명 / 브랜드</span>
                <span className="text-neutral-200 font-medium">{intake.companyName || intake.buyerLabel || "—"}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">담당자명</span>
                <span className="text-neutral-200 font-medium">{intake.contactName || "—"}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">이메일</span>
                <span className="text-neutral-200 font-mono">{intake.email || "—"}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">국가</span>
                <span className="text-neutral-200">{intake.country || intake.shippingAddress?.country || "—"}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">연락처</span>
                <span className="text-neutral-200 font-mono">{intake.phone || intake.shippingAddress?.phone || "—"}</span>
              </div>
            </div>
          </div>

          {/* 상세 주문/브리프/문의 내용 (원천별) */}
          <div className="p-3.5 rounded-xl bg-neutral-950/50 border border-neutral-800 space-y-3">
            <div className="flex items-center gap-2 text-neutral-200 font-semibold border-b border-neutral-800/80 pb-1.5">
              <Package className="w-4 h-4 text-indigo-400" />
              <span>고객 요청 및 제품 기획 상세</span>
            </div>

            {/* 1. 주문/ODM 브리프인 경우 */}
            {intake.source === "order" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-neutral-900/80 p-2.5 rounded-lg border border-neutral-800/70">
                  <div>
                    <span className="text-neutral-500 text-[10px] block">카테고리</span>
                    <span className="text-neutral-200 font-medium">{step1.selection || step1.category || "화장품"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 text-[10px] block">목표 제품명</span>
                    <span className="text-neutral-200 font-medium">{step6.productName || "미지정"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 text-[10px] block">희망 수량</span>
                    <span className="text-neutral-200 font-mono font-medium">
                      {step4.orderQuantity ? `${parseInt(step4.orderQuantity, 10).toLocaleString()}개` : "협의/미정"}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 text-[10px] block">용량</span>
                    <span className="text-neutral-200 font-medium">
                      {step4.volume ? `${step4.volume}${step4.unit || "ml"}` : "—"}
                    </span>
                  </div>
                </div>

                {/* 제형 스펙 */}
                <div className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800/60 space-y-2">
                  <span className="text-indigo-300 font-semibold block text-[11px]">제형 스펙 (Formula)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-neutral-500">텍스처 / 점도:</span>{" "}
                      <span className="text-neutral-200">{step5.textureNotes || step5.viscosity || "—"}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500">조향 (Scent):</span>{" "}
                      <span className="text-neutral-200">
                        {step5.fragranceNotes || (step5.unscented ? "무향 (Unscented)" : step5.fragranceFree ? "향료 무첨가" : "기본")}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500">핵심 효능 성분:</span>{" "}
                      <span className="text-neutral-200">{step6.conceptIngredients || "—"}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500">배제 성분:</span>{" "}
                      <span className="text-neutral-200">{step6.restrictedIngredients || "—"}</span>
                    </div>
                    {step5.colorHex && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-neutral-500">제형 색상:</span>
                        <span className="w-3.5 h-3.5 rounded border border-neutral-600 inline-block" style={{ backgroundColor: step5.colorHex }} />
                        <span className="font-mono text-neutral-300">{step5.colorHex}</span>
                      </div>
                    )}
                    {step5.finishNotes && (
                      <div>
                        <span className="text-neutral-500">피니시:</span>{" "}
                        <span className="text-neutral-200">{step5.finishNotes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 용기 패키징 스펙 */}
                {step2.selections && Array.isArray(step2.selections) && step2.selections.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800/60 space-y-1.5">
                    <span className="text-indigo-300 font-semibold block text-[11px]">용기 및 패키징 (Packaging)</span>
                    <div className="flex flex-wrap gap-2">
                      {step2.selections.map((sel: Step2Selection, sIdx: number) => (
                        <div key={sIdx} className="p-1.5 px-2.5 rounded bg-neutral-950 border border-neutral-800 text-[11px]">
                          <span className="text-neutral-400 font-medium">{sel.group}:</span>{" "}
                          <span className="text-neutral-200">{Array.isArray(sel.items) ? sel.items.join(", ") : ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 인증 및 일정 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  {step6.internationalCertifications && step6.internationalCertifications.length > 0 && (
                    <div className="p-2 bg-neutral-900/40 border border-neutral-800/50 rounded-lg">
                      <span className="text-neutral-500 block mb-1 flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-indigo-400" />
                        요구 인증:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {step6.internationalCertifications.map((c: string) => (
                          <span key={c} className="bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded text-[10px] border border-indigo-800">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(step4.sampleRequestDate || step4.targetLaunchDate) && (
                    <div className="p-2 bg-neutral-900/40 border border-neutral-800/50 rounded-lg">
                      <span className="text-neutral-500 block mb-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        목표 일정:
                      </span>
                      <div className="space-y-0.5 text-neutral-300">
                        {step4.sampleRequestDate && <div>샘플 희망일: {step4.sampleRequestDate}</div>}
                        {step4.targetLaunchDate && <div>본품 론칭일: {step4.targetLaunchDate}</div>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. 샘플 요청인 경우 */}
            {intake.source === "sampleRequest" && (
              <div className="p-3 bg-neutral-900/80 rounded-lg border border-neutral-800 text-[11px] space-y-1.5">
                <div>
                  <span className="text-neutral-500">신청 샘플 제품:</span>{" "}
                  <span className="text-neutral-100 font-semibold">{intake.sampleProductName || "샘플"}</span>
                </div>
                <div>
                  <span className="text-neutral-500">신청 수량:</span>{" "}
                  <span className="text-neutral-100 font-mono font-medium">{intake.sampleQuantity || 1}개</span>
                </div>
              </div>
            )}

            {/* 3. 콜드메일 / 일반 문의 / 랜딩인 경우 */}
            {(intake.source === "koreaLead" || intake.source === "contact" || intake.source === "landingRequest" || intake.message) && (
              <div className="space-y-2">
                {intake.expectedVolume && (
                  <div className="p-2 bg-neutral-900/80 rounded-lg border border-neutral-800 text-[11px]">
                    <span className="text-neutral-500">희망 생산 볼륨:</span>{" "}
                    <span className="text-neutral-100 font-mono font-semibold">{intake.expectedVolumeLabel || intake.expectedVolume}</span>
                  </div>
                )}
                {intake.businessType && (
                  <div className="p-2 bg-neutral-900/80 rounded-lg border border-neutral-800 text-[11px]">
                    <span className="text-neutral-500">비즈니스 형태:</span>{" "}
                    <span className="text-neutral-100 font-semibold">{intake.businessType}</span>
                  </div>
                )}
                {intake.message && (
                  <div className="p-3 bg-neutral-900/80 rounded-lg border border-neutral-800 text-[11px]">
                    <span className="text-neutral-500 block mb-1 font-medium">문의 / 요청 메시지 원문:</span>
                    <p className="text-neutral-200 whitespace-pre-wrap leading-relaxed">{intake.message}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 배송지 정보 (있는 경우) */}
          {intake.shippingAddress && (
            <div className="p-3.5 rounded-xl bg-neutral-950/50 border border-neutral-800 space-y-2">
              <div className="flex items-center gap-2 text-neutral-200 font-semibold border-b border-neutral-800/80 pb-1.5">
                <MapPin className="w-4 h-4 text-indigo-400" />
                <span>배송지 주소</span>
              </div>
              <div className="text-[11px] text-neutral-300 space-y-0.5">
                <div>수령인: {intake.shippingAddress.recipientName || "—"}</div>
                <div>
                  주소: {intake.shippingAddress.addressLine1}{" "}
                  {intake.shippingAddress.addressLine2 || ""}
                </div>
                <div>
                  도시/국가: {intake.shippingAddress.city}, {intake.shippingAddress.stateOrProvince || ""} {intake.shippingAddress.country} ({intake.shippingAddress.postalCode})
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-neutral-800 flex items-center justify-between gap-3 bg-neutral-950/60">
          <div className="flex items-center gap-2">
            <IntakeActions
              source={intake.source}
              externalId={intake.externalId}
              sourceRef={intake.sourceRef}
            />
          </div>

          <div className="flex items-center gap-2">
            {isQualified && (
              <Link
                href={`/admin/deals?createFromIntake=${encodeURIComponent(intake.id)}`}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center gap-1.5 transition text-xs shadow-sm"
              >
                <span>이 인테이크로 딜 개설</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs transition"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
