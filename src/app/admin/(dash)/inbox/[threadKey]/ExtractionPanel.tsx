"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Message } from "@/lib/schemas/message";
import type { Thread } from "@/lib/schemas/thread";
import type { IntakeReview } from "@/lib/schemas/intake-review";
import type {
  Extraction,
  ConfidenceMap,
  ExtractionItem,
} from "@/lib/schemas/extraction";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  Ban,
  Check,
  X,
  FileCheck,
  User,
  Package,
  Calendar,
  Truck,
} from "lucide-react";

interface Props {
  anchorMessage: Message;
  threadKey: string;
  thread: Thread;
  intakeReview: IntakeReview | null;
}

export default function ExtractionPanel({
  anchorMessage,
  threadKey,
  thread: _thread,
  intakeReview: initialIntakeReview,
}: Props) {
  const router = useRouter();

  // 확정값(accepted) 우선, 없으면 모델 제안값(extraction)
  const initialSource: Extraction =
    (anchorMessage.accepted as Extraction) ??
    (anchorMessage.extraction as Extraction) ??
    {};

  const modelExtraction: Extraction =
    (anchorMessage.extraction as Extraction) ?? {};

  // 폼 상태
  const [formData, setFormData] = useState<Extraction>({
    buyer: {
      name: initialSource.buyer?.name ?? "",
      email: initialSource.buyer?.email ?? "",
      brandName: initialSource.buyer?.brandName ?? "",
      country: initialSource.buyer?.country ?? "",
    },
    items: initialSource.items ? [...initialSource.items] : [],
    certifications: {
      requiredCerts: initialSource.certifications?.requiredCerts ?? [],
    },
    timeline: {
      sampleTargetDate: initialSource.timeline?.sampleTargetDate ?? "",
      targetLaunchDate: initialSource.timeline?.targetLaunchDate ?? "",
    },
    shipping: {
      country: initialSource.shipping?.country ?? "",
      city: initialSource.shipping?.city ?? "",
    },
  });

  const [confidence, setConfidence] = useState<ConfidenceMap>(
    (anchorMessage.confidence as ConfidenceMap) ?? {},
  );
  const [intakeReview, setIntakeReview] = useState<IntakeReview | null>(
    initialIntakeReview,
  );
  const [parseStatus, setParseStatus] = useState<string>(
    anchorMessage.parseStatus,
  );
  const [isAccepted, setIsAccepted] = useState<boolean>(
    Boolean(anchorMessage.accepted),
  );

  // 작업 상태
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // 인증 문자열 입력 상태 (쉼표 구분)
  const [certsInput, setCertsInput] = useState<string>(
    (initialSource.certifications?.requiredCerts ?? []).join(", "),
  );

  // 정상 리드로 승인 모달 상태
  const [showApproveModal, setShowApproveModal] = useState<boolean>(false);
  const [approveReason, setApproveReason] = useState<string>(
    "메시지 분석 결과 정상적인 바이어 문의로 확인됨",
  );

  // 판정 상태 (qualified && !isTest)
  const isQualified = Boolean(
    intakeReview && intakeReview.status === "qualified" && !intakeReview.isTest,
  );

  // 확신도 뱃지 및 인풋 스타일 헬퍼
  function getConfidenceScore(path: string): number | null {
    if (!confidence) return null;
    const score = confidence[path];
    return typeof score === "number" ? score : null;
  }

  function renderConfidenceBadge(path: string) {
    const score = getConfidenceScore(path);
    if (score === null) return null;

    if (score < 0.7) {
      return (
        <span
          title={`확신도: ${(score * 100).toFixed(0)}% — 모델 확신도가 낮아 수기 검토를 권장합니다.`}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-950/80 border border-amber-600/80 text-amber-300 shadow-sm"
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          {(score * 100).toFixed(0)}% 검토권장
        </span>
      );
    }

    return (
      <span
        title={`확신도: ${(score * 100).toFixed(0)}%`}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-950/60 border border-emerald-700/60 text-emerald-300"
      >
        <Check className="w-2.5 h-2.5" />
        {(score * 100).toFixed(0)}%
      </span>
    );
  }

  function getInputClass(path: string): string {
    const score = getConfidenceScore(path);
    const base =
      "w-full rounded-lg px-2.5 py-1.5 text-xs text-neutral-100 transition-colors focus:outline-none";
    if (score !== null && score < 0.7) {
      return `${base} bg-amber-950/25 border border-amber-600/70 focus:border-amber-500`;
    }
    return `${base} bg-neutral-950 border border-neutral-800 focus:border-indigo-500`;
  }

  // 바이어 필드 핸들러
  function handleBuyerChange(field: string, value: string) {
    setFormData((prev) => ({
      ...prev,
      buyer: {
        ...prev.buyer,
        [field]: value,
      },
    }));
  }

  // 배송 필드 핸들러
  function handleShippingChange(field: string, value: string) {
    setFormData((prev) => ({
      ...prev,
      shipping: {
        ...prev.shipping,
        [field]: value,
      },
    }));
  }

  // 일정 필드 핸들러
  function handleTimelineChange(field: string, value: string) {
    setFormData((prev) => ({
      ...prev,
      timeline: {
        ...prev.timeline,
        [field]: value,
      },
    }));
  }

  // 제품 아이템 핸들러
  function handleItemChange(
    index: number,
    field: keyof ExtractionItem,
    value: unknown,
  ) {
    setFormData((prev) => {
      const items = [...(prev.items || [])];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  }

  function handleFormulaChange(index: number, field: string, value: string) {
    setFormData((prev) => {
      const items = [...(prev.items || [])];
      const formula = { ...(items[index]?.formula || {}), [field]: value };
      items[index] = { ...items[index], formula };
      return { ...prev, items };
    });
  }

  function handlePackagingChange(index: number, field: string, value: string) {
    setFormData((prev) => {
      const items = [...(prev.items || [])];
      const packaging = { ...(items[index]?.packaging || {}), [field]: value };
      items[index] = { ...items[index], packaging };
      return { ...prev, items };
    });
  }

  function addItem() {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...(prev.items || []),
        {
          productName: "",
          category: "",
          volume: "",
          expectedQty: "",
          formula: {},
          packaging: {},
        },
      ],
    }));
  }

  function removeItem(index: number) {
    setFormData((prev) => {
      const items = [...(prev.items || [])];
      items.splice(index, 1);
      return { ...prev, items };
    });
  }

  // 1. [제안 확정] Action
  async function handleAccept() {
    setLoadingAction("accept");
    setStatusMessage(null);

    try {
      // 인증 파싱
      const certList = certsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        ...formData,
        certifications:
          certList.length > 0 ? { requiredCerts: certList } : undefined,
      };

      const res = await fetch(
        `/api/admin/messages/${encodeURIComponent(anchorMessage.id)}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accepted: payload }),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "제안 확정 저장에 실패했습니다.");
      }

      setIsAccepted(true);
      setParseStatus("completed");
      setStatusMessage({
        type: "success",
        text: "제안 데이터가 확정 저장되었습니다.",
      });
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setLoadingAction(null);
    }
  }

  // 2. [다시 추출] Action
  async function handleExtract() {
    setLoadingAction("extract");
    setStatusMessage(null);

    try {
      const res = await fetch(
        `/api/admin/messages/${encodeURIComponent(anchorMessage.id)}/extract`,
        {
          method: "POST",
        },
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "재추출 수행에 실패했습니다.");
      }

      if (data.extraction) {
        setFormData(data.extraction);
        if (data.extraction.certifications?.requiredCerts) {
          setCertsInput(
            data.extraction.certifications.requiredCerts.join(", "),
          );
        }
      }
      if (data.confidence) {
        setConfidence(data.confidence);
      }
      setParseStatus("completed");
      setStatusMessage({
        type: "success",
        text: "메시지에서 딜 제안 정보를 새로 추출했습니다.",
      });
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setLoadingAction(null);
    }
  }

  // 3. [정상 리드로 승인] Action
  async function handleQualifyIntake() {
    if (!approveReason.trim()) {
      setStatusMessage({
        type: "error",
        text: "승인 사유를 반드시 입력해주세요.",
      });
      return;
    }

    setLoadingAction("qualify");
    setStatusMessage(null);

    try {
      const res = await fetch(
        `/api/admin/intake-reviews/message/${encodeURIComponent(threadKey)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceRef: `threads/${threadKey}`,
            status: "qualified",
            reason: approveReason.trim(),
            isTest: false,
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "인테이크 승인 처리에 실패했습니다.");
      }

      setIntakeReview(data.review);
      setShowApproveModal(false);
      setStatusMessage({
        type: "success",
        text: "정상 리드로 승인되었습니다. 이제 [딜 만들기]가 활성화되었습니다.",
      });
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setLoadingAction(null);
    }
  }

  // 4. [무시] Action
  async function handleIgnore() {
    const ok = window.confirm(
      "해당 스레드를 '무시(ignored)' 처리하고 메시지 파싱을 건너뛰시겠습니까?",
    );
    if (!ok) return;

    setLoadingAction("ignore");
    setStatusMessage(null);

    try {
      // 1) Thread triageState -> ignored
      const threadRes = await fetch(
        `/api/admin/threads/${encodeURIComponent(threadKey)}/state`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ triageState: "ignored" }),
        },
      );
      if (!threadRes.ok) {
        throw new Error("스레드 상태 변경에 실패했습니다.");
      }

      // 2) Message parseStatus -> skipped
      const msgRes = await fetch(
        `/api/admin/messages/${encodeURIComponent(anchorMessage.id)}/skip`,
        {
          method: "POST",
        },
      );
      if (!msgRes.ok) {
        throw new Error("메시지 파싱 상태 갱신에 실패했습니다.");
      }

      setParseStatus("skipped");
      setStatusMessage({
        type: "success",
        text: "스레드가 무시 처리되었으며 메시지 파싱이 건너뛰어졌습니다.",
      });
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-6 shadow-xl text-neutral-200">
      {/* 1. Header & Summary Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h2 className="font-bold text-sm text-neutral-100">
              AI 제안 검토 및 확정 (Extraction Review)
            </h2>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            최신 인바운드 메시지({anchorMessage.from})에서 자동 추출된 딜
            정보입니다.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isAccepted ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-950 border border-indigo-700 text-indigo-300">
              <FileCheck className="w-3.5 h-3.5" />
              제안 확정됨
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                parseStatus === "completed"
                  ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                  : parseStatus === "failed"
                    ? "bg-rose-950/60 border-rose-800 text-rose-300"
                    : parseStatus === "skipped"
                      ? "bg-neutral-800 border-neutral-700 text-neutral-400"
                      : "bg-amber-950/60 border-amber-800 text-amber-300"
              }`}
            >
              파싱 상태: {parseStatus}
            </span>
          )}

          {isQualified && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 border border-emerald-600 text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5" />
              정상 리드 승인됨
            </span>
          )}
        </div>
      </div>

      {/* Status Notice Banner */}
      {statusMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between gap-2 ${
            statusMessage.type === "success"
              ? "bg-emerald-950/60 border border-emerald-700 text-emerald-200"
              : "bg-rose-950/60 border border-rose-800 text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-neutral-400 hover:text-neutral-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-neutral-950/60 border border-neutral-800 rounded-xl">
        <div className="flex flex-wrap items-center gap-2">
          {/* [다시 추출] */}
          <button
            type="button"
            onClick={handleExtract}
            disabled={loadingAction !== null}
            className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 hover:bg-neutral-800 text-neutral-300 flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loadingAction === "extract" ? "animate-spin text-indigo-400" : ""}`}
            />
            {loadingAction === "extract" ? "추출 중…" : "다시 추출"}
          </button>

          {/* [무시] */}
          <button
            type="button"
            onClick={handleIgnore}
            disabled={loadingAction !== null}
            className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Ban className="w-3.5 h-3.5 text-neutral-500" />
            무시 (Skip)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* [정상 리드로 승인] */}
          {!isQualified ? (
            <button
              type="button"
              onClick={() => setShowApproveModal(true)}
              disabled={loadingAction !== null}
              className="text-xs px-3.5 py-1.5 rounded-lg border border-emerald-700 bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              정상 리드로 승인
            </button>
          ) : (
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 px-2 py-1 bg-emerald-950/30 rounded border border-emerald-800/40">
              <Check className="w-3.5 h-3.5" />
              승인 완료
            </span>
          )}

          {/* [제안 확정] */}
          <button
            type="button"
            onClick={handleAccept}
            disabled={loadingAction !== null}
            className="text-xs px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            <FileCheck className="w-3.5 h-3.5" />
            {loadingAction === "accept" ? "저장 중…" : "제안 확정"}
          </button>

          {/* [딜 만들기] */}
          {isQualified ? (
            <Link
              href={`/admin/deals?createFromMessage=${encodeURIComponent(anchorMessage.id)}`}
              className="text-xs px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer"
            >
              딜 만들기 (Create Deal)
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title="정상 리드로 승인된 경우 활성화됩니다."
              className="text-xs px-3.5 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-500 font-medium flex items-center gap-1.5 opacity-50 cursor-not-allowed"
            >
              딜 만들기
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Editable Form Sections */}
      <div className="space-y-6 text-xs">
        {/* Section A: 바이어 정보 */}
        <div className="bg-neutral-950/40 border border-neutral-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-neutral-200 font-semibold border-b border-neutral-800/60 pb-2">
            <User className="w-4 h-4 text-indigo-400" />
            <h3>바이어 기본 정보 (Buyer)</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-neutral-400">바이어 이름</label>
                {renderConfidenceBadge("buyer.name")}
              </div>
              <input
                type="text"
                value={formData.buyer?.name ?? ""}
                onChange={(e) => handleBuyerChange("name", e.target.value)}
                placeholder="예: Jane Doe"
                className={getInputClass("buyer.name")}
              />
              {modelExtraction.buyer?.name &&
                modelExtraction.buyer.name !== formData.buyer?.name && (
                  <p className="text-[10px] text-neutral-500 mt-1">
                    AI 제안: {modelExtraction.buyer.name}
                  </p>
                )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-neutral-400">바이어 이메일</label>
                {renderConfidenceBadge("buyer.email")}
              </div>
              <input
                type="email"
                value={formData.buyer?.email ?? ""}
                onChange={(e) => handleBuyerChange("email", e.target.value)}
                placeholder="buyer@example.com"
                className={getInputClass("buyer.email")}
              />
              {modelExtraction.buyer?.email &&
                modelExtraction.buyer.email !== formData.buyer?.email && (
                  <p className="text-[10px] text-neutral-500 mt-1">
                    AI 제안: {modelExtraction.buyer.email}
                  </p>
                )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-neutral-400">브랜드 / 회사명</label>
                {renderConfidenceBadge("buyer.brandName")}
              </div>
              <input
                type="text"
                value={formData.buyer?.brandName ?? ""}
                onChange={(e) => handleBuyerChange("brandName", e.target.value)}
                placeholder="예: GlowLab"
                className={getInputClass("buyer.brandName")}
              />
              {modelExtraction.buyer?.brandName &&
                modelExtraction.buyer.brandName !==
                  formData.buyer?.brandName && (
                  <p className="text-[10px] text-neutral-500 mt-1">
                    AI 제안: {modelExtraction.buyer.brandName}
                  </p>
                )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-neutral-400">국가</label>
                {renderConfidenceBadge("buyer.country")}
              </div>
              <input
                type="text"
                value={formData.buyer?.country ?? ""}
                onChange={(e) => handleBuyerChange("country", e.target.value)}
                placeholder="예: 미국 (USA)"
                className={getInputClass("buyer.country")}
              />
              {modelExtraction.buyer?.country &&
                modelExtraction.buyer.country !== formData.buyer?.country && (
                  <p className="text-[10px] text-neutral-500 mt-1">
                    AI 제안: {modelExtraction.buyer.country}
                  </p>
                )}
            </div>
          </div>
        </div>

        {/* Section B: 제품 목록 (Items) */}
        <div className="bg-neutral-950/40 border border-neutral-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-800/60 pb-2">
            <div className="flex items-center gap-2 text-neutral-200 font-semibold">
              <Package className="w-4 h-4 text-indigo-400" />
              <h3>제품 사양 목록 ({formData.items?.length || 0}건)</h3>
            </div>
            <button
              type="button"
              onClick={addItem}
              className="text-[11px] px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-indigo-300 font-medium flex items-center gap-1 transition"
            >
              <Plus className="w-3 h-3" />
              제품 추가
            </button>
          </div>

          {(!formData.items || formData.items.length === 0) && (
            <div className="text-center py-4 text-neutral-500 text-xs">
              추출된 제품 정보가 없습니다. &apos;+ 제품 추가&apos; 버튼으로 직접
              추가할 수 있습니다.
            </div>
          )}

          <div className="space-y-4">
            {formData.items?.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-lg space-y-3 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-300 text-xs flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-indigo-900 text-indigo-300 flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    제품 #{idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-neutral-500 hover:text-rose-400 p-1 transition"
                    title="제품 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 기본 제품 스펙 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-neutral-400">
                        품명
                      </label>
                      {renderConfidenceBadge(`items[${idx}].productName`)}
                    </div>
                    <input
                      type="text"
                      value={item.productName ?? ""}
                      onChange={(e) =>
                        handleItemChange(idx, "productName", e.target.value)
                      }
                      placeholder="예: Centella Calming Serum"
                      className={getInputClass(`items[${idx}].productName`)}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-neutral-400">
                        카테고리
                      </label>
                      {renderConfidenceBadge(`items[${idx}].category`)}
                    </div>
                    <input
                      type="text"
                      value={item.category ?? ""}
                      onChange={(e) =>
                        handleItemChange(idx, "category", e.target.value)
                      }
                      placeholder="예: Serum, Cream, Toner"
                      className={getInputClass(`items[${idx}].category`)}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-neutral-400">
                        용량
                      </label>
                      {renderConfidenceBadge(`items[${idx}].volume`)}
                    </div>
                    <input
                      type="text"
                      value={item.volume ?? ""}
                      onChange={(e) =>
                        handleItemChange(idx, "volume", e.target.value)
                      }
                      placeholder="예: 50ml, 100g"
                      className={getInputClass(`items[${idx}].volume`)}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-neutral-400">
                        수량 / MOQ
                      </label>
                      {renderConfidenceBadge(`items[${idx}].expectedQty`)}
                    </div>
                    <input
                      type="text"
                      value={item.expectedQty ?? ""}
                      onChange={(e) =>
                        handleItemChange(idx, "expectedQty", e.target.value)
                      }
                      placeholder="예: 5,000 pcs"
                      className={getInputClass(`items[${idx}].expectedQty`)}
                    />
                  </div>
                </div>

                {/* 제형 및 패키징 세부 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-neutral-800/60">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] text-neutral-400">
                      제형 (Formula: 성분, 제형 유형, 노트)
                    </label>
                    <input
                      type="text"
                      value={
                        item.formula?.formulaType ||
                        item.formula?.keyIngredients ||
                        item.formula?.notes ||
                        ""
                      }
                      onChange={(e) =>
                        handleFormulaChange(idx, "notes", e.target.value)
                      }
                      placeholder="예: Gel type, Niacinamide + Centella"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-100"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] text-neutral-400">
                      패키징 (Packaging: 용기 유형, 재질, 단상자)
                    </label>
                    <input
                      type="text"
                      value={
                        item.packaging?.containerType ||
                        item.packaging?.material ||
                        item.packaging?.notes ||
                        ""
                      }
                      onChange={(e) =>
                        handlePackagingChange(idx, "notes", e.target.value)
                      }
                      placeholder="예: Dropper bottle, Glass, FSC paper box"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-100"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section C: 일정 & 인증 & 배송 정보 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 일정 및 인증 */}
          <div className="bg-neutral-950/40 border border-neutral-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-neutral-200 font-semibold border-b border-neutral-800/60 pb-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <h3>일정 및 요구 인증 (Timeline & Certs)</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-neutral-400">목표 샘플일</label>
                  {renderConfidenceBadge("timeline.sampleTargetDate")}
                </div>
                <input
                  type="date"
                  value={formData.timeline?.sampleTargetDate ?? ""}
                  onChange={(e) =>
                    handleTimelineChange("sampleTargetDate", e.target.value)
                  }
                  className={getInputClass("timeline.sampleTargetDate")}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-neutral-400">목표 론칭일</label>
                  {renderConfidenceBadge("timeline.targetLaunchDate")}
                </div>
                <input
                  type="date"
                  value={formData.timeline?.targetLaunchDate ?? ""}
                  onChange={(e) =>
                    handleTimelineChange("targetLaunchDate", e.target.value)
                  }
                  className={getInputClass("timeline.targetLaunchDate")}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-neutral-400">
                  필요 인증 (쉼표로 구분)
                </label>
                {renderConfidenceBadge("certifications.requiredCerts")}
              </div>
              <input
                type="text"
                value={certsInput}
                onChange={(e) => setCertsInput(e.target.value)}
                placeholder="예: FDA, CPNP, ISO22716, Vegan"
                className={getInputClass("certifications.requiredCerts")}
              />
            </div>
          </div>

          {/* 배송지 정보 */}
          <div className="bg-neutral-950/40 border border-neutral-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-neutral-200 font-semibold border-b border-neutral-800/60 pb-2">
              <Truck className="w-4 h-4 text-indigo-400" />
              <h3>배송지 정보 (Shipping Info)</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-neutral-400">배송 국가</label>
                  {renderConfidenceBadge("shipping.country")}
                </div>
                <input
                  type="text"
                  value={formData.shipping?.country ?? ""}
                  onChange={(e) =>
                    handleShippingChange("country", e.target.value)
                  }
                  placeholder="예: 미국 (USA)"
                  className={getInputClass("shipping.country")}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-neutral-400">도시 (City)</label>
                  {renderConfidenceBadge("shipping.city")}
                </div>
                <input
                  type="text"
                  value={formData.shipping?.city ?? ""}
                  onChange={(e) => handleShippingChange("city", e.target.value)}
                  placeholder="예: Los Angeles, CA"
                  className={getInputClass("shipping.city")}
                />
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-400 leading-relaxed">
              💡 세부 주소, 수령인 및 Tax ID(브라질 등)는 [딜 만들기] 단계에서
              바이어와 최종 조율하며 입력할 수 있습니다.
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-neutral-800">
        <div className="text-[11px] text-neutral-500">
          검토 완료 후 [제안 확정]을 저장하고, [정상 리드로 승인]하여 딜을
          개설하세요.
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAccept}
            disabled={loadingAction !== null}
            className="text-xs px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
          >
            <FileCheck className="w-3.5 h-3.5" />
            {loadingAction === "accept" ? "저장 중…" : "제안 확정 저장"}
          </button>

          {isQualified ? (
            <Link
              href={`/admin/deals?createFromMessage=${encodeURIComponent(anchorMessage.id)}`}
              className="text-xs px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
            >
              딜 만들기
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title="정상 리드로 승인 후 딜 생성이 가능합니다."
              className="text-xs px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-500 font-medium flex items-center gap-1.5 opacity-50 cursor-not-allowed"
            >
              딜 만들기
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Modal: 정상 리드로 승인 */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="font-semibold text-sm text-neutral-100 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                정상 리드로 승인 (Qualify Intake)
              </h3>
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="text-neutral-400 hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-neutral-300">
                판정 사유 (Reason) <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={approveReason}
                onChange={(e) => setApproveReason(e.target.value)}
                rows={3}
                placeholder="승인 근거 및 사유를 입력하세요"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2.5 text-xs text-neutral-100 focus:outline-none focus:border-indigo-500 resize-none"
                required
              />
              <p className="text-[11px] text-neutral-400">
                승인 시 본 스레드는 공식 잠재 딜로 등록되며, [딜 만들기]를 통해
                원장 생성이 가능해집니다.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="text-xs px-3 py-1.5 rounded-lg text-neutral-400 hover:bg-neutral-800"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleQualifyIntake}
                disabled={loadingAction === "qualify" || !approveReason.trim()}
                className="text-xs px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50 transition"
              >
                {loadingAction === "qualify" ? "승인 처리 중…" : "승인 완료"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
