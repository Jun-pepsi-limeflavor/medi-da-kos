"use client";

import React, { useState, useEffect, useMemo, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
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
  Link2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
} from "lucide-react";

// 빠른 선택을 위한 글로벌 화장품 표준 인증 프리셋
const COMMON_CERT_PRESETS = [
  "CPNP",
  "FDA",
  "Vegan",
  "ISO 22716",
  "HALAL",
  "EWG Green",
  "MoCRA",
  "TGA",
];

interface Props {
  anchorMessage: Message;
  threadKey: string;
  thread: Thread;
  intakeReview: IntakeReview | null;
  linkedDeal?: { id: string; reference?: string } | null;
}

export default function ExtractionPanel({
  anchorMessage,
  threadKey,
  thread,
  intakeReview: initialIntakeReview,
  linkedDeal,
}: Props) {
  const router = useRouter();

  // 연결된 활성 딜 식별
  const activeDealId =
    thread.dealId || initialIntakeReview?.dealId || linkedDeal?.id || null;
  const dealReference =
    linkedDeal?.reference || (activeDealId ? activeDealId.slice(0, 8) : null);

  // 활성 탭 (바이어·배송 / 제품 사양 / 일정·인증)
  const [activeTab, setActiveTab] = useState<"buyer" | "items" | "timeline">(
    "items",
  );

  // 확정값(accepted) 우선, 없으면 모델 제안값(extraction)
  const initialSource: Extraction = useMemo(
    () =>
      (anchorMessage.accepted as Extraction) ??
      (anchorMessage.extraction as Extraction) ??
      {},
    [anchorMessage],
  );

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

  // 작업 상태
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // 인증 스마트 칩 상태
  const [selectedCerts, setSelectedCerts] = useState<string[]>(
    initialSource.certifications?.requiredCerts ?? [],
  );
  const [customCertInput, setCustomCertInput] = useState<string>("");

  // 제품 아코디언 펼침 상태 (품목별 인덱스)
  const [expandedItemIndex, setExpandedItemIndex] = useState<number | null>(0);

  // 정상 리드로 승인 모달 상태
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [showApproveModal, setShowApproveModal] = useState<boolean>(false);
  const [approveReason, setApproveReason] = useState<string>(
    "메시지 분석 결과 정상적인 바이어 문의로 확인됨",
  );

  // 판정 상태 (qualified && !isTest)
  const isQualified = Boolean(
    intakeReview && intakeReview.status === "qualified" && !intakeReview.isTest,
  );

  // 평균 확신도 점수 계산 (종합 신뢰도 게이지용)
  const overallConfidence = useMemo(() => {
    const scores = Object.values(confidence).filter((v) => typeof v === "number");
    if (scores.length === 0) return 92;
    const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    return Math.round(avg * 100);
  }, [confidence]);

  // 1. [제안 확정] 저장 Action
  const handleAccept = useCallback(async () => {
    setLoadingAction("accept");
    setStatusMessage(null);

    try {
      const payload: Extraction = {
        ...formData,
        certifications:
          selectedCerts.length > 0 ? { requiredCerts: selectedCerts } : undefined,
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

      const successMsg = data.syncedDealId
        ? `제안이 확정되었으며, 연결된 딜(${data.syncedDealReference || "원장"})에 제품·바이어·일정 정보가 동기화되었습니다.`
        : "제안 데이터가 확정 저장되었습니다.";

      setStatusMessage({
        type: "success",
        text: successMsg,
      });
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setLoadingAction(null);
    }
  }, [anchorMessage.id, formData, selectedCerts, router]);

  // 단축키 지원 (Cmd+S / Ctrl+S)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleAccept();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleAccept]);

  // 재추출 드롭다운 메뉴 상태
  const [extractMenuOpen, setExtractMenuOpen] = useState<boolean>(false);

  // 2-1. [스레드 전체 대화 종합 분석] Action
  async function handleExtractThread() {
    setLoadingAction("extract_thread");
    setStatusMessage(null);

    try {
      const res = await fetch(
        `/api/admin/threads/${encodeURIComponent(threadKey)}/extract`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "스레드 종합 추출에 실패했습니다.");
      }

      if (data.extraction) {
        setFormData(data.extraction);
        if (data.extraction.certifications?.requiredCerts) {
          setSelectedCerts(data.extraction.certifications.requiredCerts);
        }
      }
      if (data.confidence) {
        setConfidence(data.confidence);
      }
      setStatusMessage({
        type: "success",
        text: `전체 대화 맥락(${data.messageCount || "전체"}개 메시지)을 종합 분석하여 딜 제안을 갱신했습니다.`,
      });
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setLoadingAction(null);
    }
  }

  // 2-2. [현재 메시지만 분석] Action
  async function handleExtractSingleMessage() {
    setLoadingAction("extract_single");
    setStatusMessage(null);

    try {
      const res = await fetch(
        `/api/admin/messages/${encodeURIComponent(anchorMessage.id)}/extract`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "단일 메시지 AI 재추출에 실패했습니다.");
      }

      if (data.extraction) {
        setFormData(data.extraction);
        if (data.extraction.certifications?.requiredCerts) {
          setSelectedCerts(data.extraction.certifications.requiredCerts);
        }
      }
      if (data.confidence) {
        setConfidence(data.confidence);
      }
      setStatusMessage({
        type: "success",
        text: "현재 메시지 본문에서 딜 제안 정보를 새로 추출했습니다.",
      });
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setLoadingAction(null);
    }
  }

  // 2-3. [초기값 리셋] Action
  function handleResetToOriginal() {
    setFormData(initialSource);
    setSelectedCerts(initialSource.certifications?.requiredCerts ?? []);
    setConfidence((anchorMessage.confidence as ConfidenceMap) ?? {});
    setStatusMessage({
      type: "success",
      text: "저장되지 않은 변경사항을 취소하고 초기 제안값으로 리셋했습니다.",
    });
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
        text: "정상 리드로 승인되었습니다. 이제 딜 전환이 가능합니다.",
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
      const reviewRes = await fetch(
        `/api/admin/intake-reviews/message/${encodeURIComponent(threadKey)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceRef: `threads/${threadKey}`,
            status: "ignored",
            reason: "운영자에 의해 수동 무시 처리됨",
            isTest: false,
          }),
        },
      );
      if (!reviewRes.ok) {
        throw new Error("인테이크 상태 갱신에 실패했습니다.");
      }

      const msgRes = await fetch(
        `/api/admin/messages/${encodeURIComponent(anchorMessage.id)}/skip`,
        { method: "POST" },
      );
      if (!msgRes.ok) {
        throw new Error("메시지 파싱 상태 갱신에 실패했습니다.");
      }

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

  // 품목 추가/삭제/수정 헬퍼
  function handleAddItem() {
    const newItem: ExtractionItem = {
      productName: "",
      category: "",
      volume: "",
      expectedQty: "1000",
      formula: { notes: "", keyIngredients: "" },
      packaging: { containerType: "", material: "" },
    };
    const newItems = [...(formData.items ?? []), newItem];
    setFormData((prev) => ({ ...prev, items: newItems }));
    setExpandedItemIndex(newItems.length - 1);
  }

  function handleRemoveItem(index: number) {
    const updated = (formData.items ?? []).filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, items: updated }));
    if (expandedItemIndex === index) {
      setExpandedItemIndex(updated.length > 0 ? 0 : null);
    }
  }

  function handleUpdateItem(
    index: number,
    field: string,
    val: string | number | undefined,
  ) {
    const items = [...(formData.items ?? [])];
    const item = { ...items[index] };

    if (field.startsWith("formula.")) {
      const sub = field.split(".")[1];
      item.formula = {
        ...item.formula,
        [sub]: val,
      };
    } else if (field.startsWith("packaging.")) {
      const sub = field.split(".")[1];
      item.packaging = {
        ...item.packaging,
        [sub]: val,
      };
    } else {
      (item as Record<string, unknown>)[field] = val;
    }

    items[index] = item;
    setFormData((prev) => ({ ...prev, items }));
  }

  // 인증 토글 및 직접 추가
  function toggleCert(certName: string) {
    if (selectedCerts.includes(certName)) {
      setSelectedCerts(selectedCerts.filter((c) => c !== certName));
    } else {
      setSelectedCerts([...selectedCerts, certName]);
    }
  }

  function handleAddCustomCert(e: React.KeyboardEvent | React.MouseEvent) {
    if (e.type === "keydown" && (e as React.KeyboardEvent).key !== "Enter") {
      return;
    }
    e.preventDefault();
    const trimmed = customCertInput.trim().toUpperCase();
    if (trimmed && !selectedCerts.includes(trimmed)) {
      setSelectedCerts([...selectedCerts, trimmed]);
      setCustomCertInput("");
    }
  }

  return (
    <div className="relative rounded-2xl border border-neutral-800/90 bg-neutral-900/90 shadow-2xl backdrop-blur-xl text-neutral-200 overflow-hidden flex flex-col font-sans transition-all">
      {/* ─────────────────────────────────────────────────────────────
          1. Header Zone: Title, Confidence Gauge, Utility Actions
      ───────────────────────────────────────────────────────────── */}
      <div className="border-b border-neutral-800/80 bg-neutral-950/60 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                AI 제안 검토 및 확정 (Extraction Review)
              </h2>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              {anchorMessage.from}의 최신 인바운드 메일에서 자동 추출된 딜 사양입니다.
            </p>
          </div>

          {/* 우측 메타 배지 & 서브 액션 */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* AI 신뢰도 게이지 */}
            <div className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/90 px-2.5 py-1 text-xs shadow-inner">
              <Zap className="h-3 w-3 text-amber-400" />
              <span className="font-mono text-[11px] font-semibold text-neutral-300">
                {overallConfidence}% 신뢰도
              </span>
            </div>

            {/* 스마트 재추출 스플릿 드롭다운 버튼 */}
            <div className="relative inline-flex items-stretch rounded-lg shadow-sm">
              <button
                type="button"
                onClick={handleExtractThread}
                disabled={loadingAction !== null}
                className="inline-flex items-center gap-1.5 rounded-l-lg border border-neutral-700/80 bg-neutral-800/90 px-2.5 py-1 text-xs font-semibold text-indigo-200 hover:bg-neutral-800 hover:text-white transition disabled:opacity-50"
                title="스레드 전체 대화 맥락을 종합 분석하여 딜 사양을 추출합니다"
              >
                {loadingAction === "extract_thread" ? (
                  <RefreshCw className="h-3 w-3 animate-spin text-indigo-400" />
                ) : (
                  <Sparkles className="h-3 w-3 text-indigo-400" />
                )}
                <span>전체 대화 종합 분석</span>
              </button>
              <button
                type="button"
                onClick={() => setExtractMenuOpen((prev) => !prev)}
                disabled={loadingAction !== null}
                className="inline-flex items-center justify-center rounded-r-lg border-y border-r border-neutral-700/80 bg-neutral-800/90 px-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white transition disabled:opacity-50"
                title="추출 옵션 더보기"
              >
                <ChevronDown className="h-3 w-3" />
              </button>

              {/* 드롭다운 메뉴 레이어 */}
              {extractMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setExtractMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-60 rounded-xl border border-neutral-800 bg-neutral-900/95 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        setExtractMenuOpen(false);
                        handleExtractThread();
                      }}
                      className="flex w-full items-start gap-2.5 rounded-lg p-2 text-left text-xs text-neutral-200 hover:bg-indigo-950/60 hover:text-indigo-200 transition"
                    >
                      <Sparkles className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="font-semibold text-white">전체 대화 종합 분석 (권장)</div>
                        <div className="text-[11px] text-neutral-400">모든 메시지 누적 맥락 취합</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExtractMenuOpen(false);
                        handleExtractSingleMessage();
                      }}
                      className="flex w-full items-start gap-2.5 rounded-lg p-2 text-left text-xs text-neutral-200 hover:bg-neutral-800/80 hover:text-white transition"
                    >
                      <RefreshCw className="h-4 w-4 text-neutral-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="font-medium">현재 메시지만 분석</div>
                        <div className="text-[11px] text-neutral-400">선택된 단일 메일 본문만 대상</div>
                      </div>
                    </button>
                    <div className="my-1 border-t border-neutral-800" />
                    <button
                      type="button"
                      onClick={() => {
                        setExtractMenuOpen(false);
                        handleResetToOriginal();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200 transition"
                    >
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>초기 제안값으로 리셋</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* 무시 (Skip) */}
            <button
              type="button"
              onClick={handleIgnore}
              disabled={loadingAction !== null}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/50 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition disabled:opacity-50"
              title="이 스레드 파싱 스킵"
            >
              <Ban className="h-3 w-3 text-neutral-500" />
              무시
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            2. Segmented Navigation Tabs (제품 사양 / 바이어·배송 / 일정·인증)
        ───────────────────────────────────────────────────────────── */}
        <div className="mt-4 flex items-center gap-1 rounded-xl bg-neutral-950 p-1 border border-neutral-800/70">
          <button
            type="button"
            onClick={() => setActiveTab("items")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-1.5 text-xs font-semibold transition-all ${
              activeTab === "items"
                ? "bg-neutral-800 text-white shadow-sm border border-neutral-700"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60"
            }`}
          >
            <Package className="h-3.5 w-3.5 text-indigo-400" />
            <span>제품 사양 (Items)</span>
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-950 px-1 text-[10px] font-bold text-indigo-300 border border-indigo-800/60">
              {formData.items?.length ?? 0}
            </span>
          </button>

            <button
              type="button"
              onClick={() => setActiveTab("buyer")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                activeTab === "buyer"
                  ? "bg-neutral-800 text-white shadow-sm border border-neutral-700"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60"
              }`}
            >
              <User className="h-3.5 w-3.5 text-sky-400" />
              <span>바이어 & 배송지</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("timeline")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                activeTab === "timeline"
                  ? "bg-neutral-800 text-white shadow-sm border border-neutral-700"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60"
              }`}
            >
              <Calendar className="h-3.5 w-3.5 text-emerald-400" />
              <span>일정 & 필수 인증</span>
              {selectedCerts.length > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-950 px-1 text-[10px] font-bold text-emerald-300 border border-emerald-800/60">
                  {selectedCerts.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 상태 피드백 알림 배너 */}
        {statusMessage && (
        <div
          className={`mx-5 mt-4 rounded-xl border p-3 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-200 ${
            statusMessage.type === "success"
              ? "bg-emerald-950/40 border-emerald-800/80 text-emerald-300"
              : "bg-rose-950/40 border-rose-800/80 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-neutral-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. Tab Content Area
      ───────────────────────────────────────────────────────────── */}
      <div className="p-5 flex-1 min-h-[380px] overflow-y-auto space-y-5">
        {/* TAB 1: 제품 사양 (Items) */}
        {activeTab === "items" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  추출된 제품 목록 ({formData.items?.length ?? 0}개 품목)
                </h3>
                <span className="text-[11px] text-neutral-500">
                  다품목 문의 시 개별 카드로 분리 관리됩니다.
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-800/70 bg-indigo-950/50 px-2.5 py-1 text-xs font-semibold text-indigo-300 hover:bg-indigo-900/60 transition shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                제품 추가
              </button>
            </div>

            {(!formData.items || formData.items.length === 0) && (
              <div className="rounded-xl border border-dashed border-neutral-800 p-8 text-center text-xs text-neutral-500">
                추출된 제품 정보가 없습니다. [제품 추가]를 눌러 등록하세요.
              </div>
            )}

            <div className="space-y-3">
              {formData.items?.map((item, idx) => {
                const isExpanded = expandedItemIndex === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-neutral-800 bg-neutral-950/70 transition-all overflow-hidden"
                  >
                    {/* 카드 헤더 요약 바 (클릭 시 아코디언 토글) */}
                    <div
                      onClick={() =>
                        setExpandedItemIndex(isExpanded ? null : idx)
                      }
                      className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-neutral-900/60 transition select-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-neutral-800 text-[11px] font-bold text-neutral-300">
                          #{idx + 1}
                        </span>
                        <span className="font-semibold text-xs text-white truncate max-w-[200px] sm:max-w-[260px]">
                          {item.productName || item.category || "(제품명 미입력)"}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.category && (
                            <span className="rounded bg-sky-950/70 border border-sky-800/50 px-1.5 py-0.5 text-[10px] text-sky-300 font-medium">
                              {item.category}
                            </span>
                          )}
                          {item.volume && (
                            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300 font-mono">
                              {item.volume}
                            </span>
                          )}
                          <span className="rounded bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 text-[10px] text-emerald-300 font-bold font-mono">
                            {item.expectedQty ? `${item.expectedQty} pcs` : "1,000 pcs"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveItem(idx);
                          }}
                          className="text-neutral-500 hover:text-rose-400 p-1 transition"
                          title="품목 삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-neutral-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-neutral-400" />
                        )}
                      </div>
                    </div>

                    {/* 카드 본문 폼 (펼쳤을 때 상세 2열 그리드) */}
                    {isExpanded && (
                      <div className="p-4 border-t border-neutral-800/80 bg-neutral-950/40 space-y-4 animate-in fade-in duration-150">
                        {/* 1열: 제품 기본 규격 */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                              제품명 (Product Name)
                            </label>
                            <input
                              type="text"
                              value={item.productName ?? ""}
                              onChange={(e) =>
                                handleUpdateItem(idx, "productName", e.target.value)
                              }
                              placeholder="예: Niacinamide Calming Serum"
                              className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                              카테고리 / 제형
                            </label>
                            <input
                              type="text"
                              value={item.category ?? ""}
                              onChange={(e) =>
                                handleUpdateItem(idx, "category", e.target.value)
                              }
                              placeholder="Serum, Cream, Toner 등"
                              className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                              용량 (Volume)
                            </label>
                            <input
                              type="text"
                              value={item.volume ?? ""}
                              onChange={(e) =>
                                handleUpdateItem(idx, "volume", e.target.value)
                              }
                              placeholder="예: 50ml"
                              className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                              예상 수량 (Target Qty)
                            </label>
                            <input
                              type="text"
                              value={item.expectedQty ?? ""}
                              onChange={(e) =>
                                handleUpdateItem(idx, "expectedQty", e.target.value)
                              }
                              placeholder="예: 5000"
                              className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* 2열: 제형 & 용기 상세 사양 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-800/60">
                          {/* 제형 사양 */}
                          <div className="rounded-lg bg-neutral-900/60 border border-neutral-800 p-3 space-y-2">
                            <span className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
                              🧪 제형 사양 (Formula Spec)
                            </span>
                            <div>
                              <input
                                type="text"
                                value={item.formula?.keyIngredients ?? ""}
                                onChange={(e) =>
                                  handleUpdateItem(
                                    idx,
                                    "formula.keyIngredients",
                                    e.target.value,
                                  )
                                }
                                placeholder="핵심 성분 (예: Niacinamide 10%, Zinc 1%)"
                                className="w-full bg-neutral-950 border border-neutral-700/80 rounded px-2 py-1 text-[11px] text-neutral-200 focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <input
                                type="text"
                                value={item.formula?.notes ?? ""}
                                onChange={(e) =>
                                  handleUpdateItem(
                                    idx,
                                    "formula.notes",
                                    e.target.value,
                                  )
                                }
                                placeholder="제형 질감/타입 (예: Watery gel, 무향)"
                                className="w-full bg-neutral-950 border border-neutral-700/80 rounded px-2 py-1 text-[11px] text-neutral-200 focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* 용기 사양 */}
                          <div className="rounded-lg bg-neutral-900/60 border border-neutral-800 p-3 space-y-2">
                            <span className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
                              🧴 용기 및 부자재 (Packaging)
                            </span>
                            <div>
                              <input
                                type="text"
                                value={item.packaging?.containerType ?? ""}
                                onChange={(e) =>
                                  handleUpdateItem(
                                    idx,
                                    "packaging.containerType",
                                    e.target.value,
                                  )
                                }
                                placeholder="용기 종류 (예: 유리 스포이드 병, 펌프 튜브)"
                                className="w-full bg-neutral-950 border border-neutral-700/80 rounded px-2 py-1 text-[11px] text-neutral-200 focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <input
                                type="text"
                                value={item.packaging?.material ?? ""}
                                onChange={(e) =>
                                  handleUpdateItem(
                                    idx,
                                    "packaging.material",
                                    e.target.value,
                                  )
                                }
                                placeholder="재질/마감 (예: Frosted Glass, 단상자 포함)"
                                className="w-full bg-neutral-950 border border-neutral-700/80 rounded px-2 py-1 text-[11px] text-neutral-200 focus:border-indigo-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: 바이어 & 배송지 */}
        {activeTab === "buyer" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-sky-400" />
              바이어 프로필 & 배송처 정보
            </h3>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    회사/브랜드명 (Brand / Company)
                  </label>
                  <input
                    type="text"
                    value={formData.buyer?.brandName ?? ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        buyer: { ...p.buyer, brandName: e.target.value },
                      }))
                    }
                    placeholder="예: Aussie Beauty Group"
                    className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    담당자명 (Contact Name)
                  </label>
                  <input
                    type="text"
                    value={formData.buyer?.name ?? ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        buyer: { ...p.buyer, name: e.target.value },
                      }))
                    }
                    placeholder="예: Jade Davis"
                    className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    담당자 이메일
                  </label>
                  <input
                    type="email"
                    value={formData.buyer?.email ?? ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        buyer: { ...p.buyer, email: e.target.value },
                      }))
                    }
                    placeholder="jade@example.com"
                    className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    바이어 국가 (Country)
                  </label>
                  <input
                    type="text"
                    value={formData.buyer?.country ?? ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        buyer: { ...p.buyer, country: e.target.value },
                      }))
                    }
                    placeholder="예: 호주 (Australia)"
                    className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 space-y-3">
              <span className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-sky-400" />
                목적지 배송 정보 (Shipping Destination)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    도착 국가
                  </label>
                  <input
                    type="text"
                    value={formData.shipping?.country ?? ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        shipping: { ...p.shipping, country: e.target.value },
                      }))
                    }
                    placeholder="예: 미국 (USA)"
                    className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    도시 (City)
                  </label>
                  <input
                    type="text"
                    value={formData.shipping?.city ?? ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        shipping: { ...p.shipping, city: e.target.value },
                      }))
                    }
                    placeholder="예: Schaumburg"
                    className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    상세 주소 (Address Line)
                  </label>
                  <input
                    type="text"
                    value={formData.shipping?.addressLine1 ?? ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        shipping: { ...p.shipping, addressLine1: e.target.value },
                      }))
                    }
                    placeholder="예: 233 Desmond Dr"
                    className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    우편번호 (Postal Code)
                  </label>
                  <input
                    type="text"
                    value={formData.shipping?.postalCode ?? ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        shipping: { ...p.shipping, postalCode: e.target.value },
                      }))
                    }
                    placeholder="예: 60193"
                    className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: 일정 & 스마트 인증 */}
        {activeTab === "timeline" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* 인증 스마트 칩 클라우드 */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  필수 인증 및 규격 (Certifications)
                </span>
                <span className="text-[11px] text-neutral-500">
                  클릭하여 토글하거나 직접 추가
                </span>
              </div>

              {/* 프리셋 스마트 칩 */}
              <div className="flex flex-wrap items-center gap-1.5">
                {COMMON_CERT_PRESETS.map((preset) => {
                  const active = selectedCerts.includes(preset);
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => toggleCert(preset)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        active
                          ? "bg-emerald-950 border border-emerald-700 text-emerald-300 shadow-sm"
                          : "bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
                      }`}
                    >
                      {active ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Plus className="h-3 w-3 text-neutral-500" />
                      )}
                      {preset}
                    </button>
                  );
                })}

                {/* 사용자가 직접 추가한 태그들 */}
                {selectedCerts
                  .filter((c) => !COMMON_CERT_PRESETS.includes(c))
                  .map((customCert) => (
                    <span
                      key={customCert}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-700 text-indigo-300 text-xs font-semibold"
                    >
                      <Check className="h-3 w-3 text-indigo-400" />
                      {customCert}
                      <button
                        type="button"
                        onClick={() => toggleCert(customCert)}
                        className="hover:text-rose-300"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
              </div>

              {/* 커스텀 인증 입력창 */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={customCertInput}
                  onChange={(e) => setCustomCertInput(e.target.value)}
                  onKeyDown={handleAddCustomCert}
                  placeholder="기타 인증 규격 직접 입력 (엔터)"
                  className="flex-1 bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddCustomCert}
                  className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200"
                >
                  추가
                </button>
              </div>
            </div>

            {/* 일정 (Timeline) */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 space-y-3">
              <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-emerald-400" />
                목표 일정 (Project Milestones)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    샘플 완료 목표일
                  </label>
                  <input
                    type="date"
                    value={formData.timeline?.sampleTargetDate ?? ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        timeline: {
                          ...p.timeline,
                          sampleTargetDate: e.target.value,
                        },
                      }))
                    }
                    className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    완제품 납기 / 런칭 목표일
                  </label>
                  <input
                    type="date"
                    value={formData.timeline?.targetLaunchDate ?? ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        timeline: {
                          ...p.timeline,
                          targetLaunchDate: e.target.value,
                        },
                      }))
                    }
                    className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. Bottom Floating Action Dock: Clear Hierarchy CTAs
      ───────────────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 z-20 border-t border-neutral-800/90 bg-neutral-950/95 backdrop-blur-md px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Deal Status Indicator */}
        <div className="flex items-center gap-2">
          {activeDealId ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-amber-300 font-medium bg-amber-950/70 border border-amber-800/80 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm">
                <Link2 className="h-3.5 w-3.5 text-amber-400" />
                이미 딜 개설됨 ({dealReference})
              </span>
              <Link
                href={`/admin/deals/${encodeURIComponent(activeDealId)}`}
                className="text-xs px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold flex items-center gap-1 transition"
              >
                딜 바로가기
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : isQualified ? (
            <Link
              href={`/admin/deals?createFromMessage=${encodeURIComponent(anchorMessage.id)}`}
              className="text-xs px-3.5 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-700 text-emerald-300 hover:bg-emerald-900/60 font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
            >
              딜 만들기 (Create Deal)
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setShowApproveModal(true)}
              disabled={loadingAction !== null}
              className="text-xs px-3.5 py-1.5 rounded-lg border border-emerald-700/80 bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              정상 리드로 승인
            </button>
          )}
        </div>

        {/* Right: Primary Save/Accept Button (Highlighted CTA with Cmd+S) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAccept}
            disabled={loadingAction !== null}
            className="text-xs px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold flex items-center gap-2 shadow-lg shadow-indigo-950/50 transition disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <FileCheck className="h-4 w-4" />
            {loadingAction === "accept" ? "동기화 저장 중…" : "제안 확정 저장"}
            <span className="hidden sm:inline-block ml-1 rounded bg-indigo-950/80 border border-indigo-700/60 px-1.5 py-0.5 text-[10px] font-mono text-indigo-300">
              ⌘S
            </span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. Modal: 정상 리드로 승인 (createPortal 뷰포트 정중앙 렌더링)
      ───────────────────────────────────────────────────────────── */}
      {showApproveModal &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-neutral-200">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  정상 리드로 승인 (Qualify Intake)
                </h3>
                <button
                  type="button"
                  onClick={() => setShowApproveModal(false)}
                  className="text-neutral-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <label className="block font-medium text-neutral-300">
                  승인 사유 (Reason) <span className="text-rose-400">*</span>
                </label>
                <textarea
                  value={approveReason}
                  onChange={(e) => setApproveReason(e.target.value)}
                  rows={3}
                  placeholder="승인 근거 및 사유를 입력하세요"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                  required
                  autoFocus
                />
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  승인 시 본 스레드는 공식 잠재 딜로 등록되며, [딜 만들기] 및 딜 연동이
                  활성화됩니다.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowApproveModal(false)}
                  className="text-xs px-3.5 py-1.5 rounded-lg text-neutral-400 hover:bg-neutral-800"
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
          </div>,
          document.body,
        )}
    </div>
  );
}
