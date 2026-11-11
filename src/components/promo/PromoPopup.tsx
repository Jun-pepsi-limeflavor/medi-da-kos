"use client";

// Promotion 팝업(Figma 'Overlay · Promotion Popup — Final Design (1440 · desktop · Home new external visit)' 335:911). Home에만 둔다.
// - 560×614 차콜 패널(radius 16): 상단 이미지 200px + X → Eyebrow · 10% off · your production quote · 마감일 · 안내 → Ask about the offer · Continue to site
//   문구는 Final Design 그대로(Prototype 전용 복제본의 'eligible costs' 등 예전 문구는 쓰지 않음)
// - 이미지 구도(2026-11-11): Figma Visual Band(335:946) Crop 그대로 — 폭에 맞춘 이미지의 세로 25.6%~89.1% 구간.
//   패널 폭과 무관하게 560:200 비율이라 object-cover + object-position 세로 70.1%(0.2561 ÷ (1 − 0.6346))로 같은 구도
// - 자동 노출: 새 방문의 첫 페이지가 Home일 때 첫 화면 후 약 1초 뒤 방문당 1회(lib/promo/visit). 그 사이 다른 모달이 열려 있으면 띄우지 않음
// - 닫기: X · Continue to site · 배경 클릭 · ESC — Home 스크롤 위치 유지, 쿠키 동의 기록에는 영향 없음
// - Ask about the offer → /contact(일반 Contact와 같은 초기 상태)
// - 작은 화면: 좌우 16px 여백, 화면 높이를 넘으면 패널 안에서 스크롤
import Image from "next/image";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CloseButton } from "@/components/ui/CloseButton";
import { Modal } from "@/components/ui/Modal";
import { isYearEndPromoActive } from "@/lib/config/promo";
import { ROUTES } from "@/lib/config/routes";
import { getVisit, isBotVisitor, markPromoSeen, promoBarClicked, readSeenVisit, shouldAutoOpenPromo } from "@/lib/promo/visit";

/** Figma: "첫 화면 렌더 후 약 1초 지연 (Hero 메시지 먼저 노출)". */
const OPEN_DELAY_MS = 1000;

export function PromoPopup() {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const visit = getVisit();
    const eligible = shouldAutoOpenPromo({
      visit,
      pathname: window.location.pathname,
      promoActive: isYearEndPromoActive(),
      barClicked: promoBarClicked(),
      seenVisitId: readSeenVisit(),
      isBot: isBotVisitor(),
    });
    if (!eligible) return;
    const timer = window.setTimeout(() => {
      // Another overlay (e.g. Cookie Settings, a post) is already open, or the bar was clicked meanwhile: skip this time.
      if (document.querySelector("dialog[open]") || promoBarClicked() || !isYearEndPromoActive()) return;
      markPromoSeen(visit);
      setOpen(true);
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const close = () => setOpen(false);

  return (
    <Modal open={open} onClose={close} labelledBy={titleId} className="w-[560px] rounded-2xl">
      <div data-promo-popup="" className="max-h-[calc(100dvh-32px)] overflow-y-auto overscroll-contain rounded-2xl bg-mdk-charcoal text-mdk-white">
        <div className="relative aspect-[560/200] w-full overflow-hidden">
          <Image src="/images/promo/year-end-visual.jpg" alt="" fill sizes="(max-width: 592px) 100vw, 560px" className="object-cover object-[50%_70.1%]" priority />
          <CloseButton onClick={close} label="Close" variant="on-image" className="absolute top-4 right-4" />
        </div>
        <div className="flex flex-col px-6 pt-8 pb-7 sm:px-10 sm:pt-9 sm:pb-8">
          <p className="text-[14px] leading-5 font-semibold">Year-end offer</p>
          <div className="flex flex-col gap-1.5 py-5">
            {/* 88px on the heading itself so the line box is exactly 80px (Figma), not 80px + the inherited strut. */}
            <h2 id={titleId} className="text-[88px] leading-[80px] font-semibold tracking-[-0.04em]">
              <span>10%</span>
              <span className="text-[46px] leading-none font-medium tracking-[-0.02em]"> off</span>
            </h2>
            <p className="text-mdk-label text-mdk-mid-gray">your production quote</p>
          </div>
          <p className="text-[20px] leading-[30px] font-medium tracking-[-0.005em]">Sign your project contract by December 31, 2026.</p>
          <p className="pt-2.5 text-[14px] leading-5 font-medium text-mdk-mid-gray">Planning your next beauty launch? Get in touch early.</p>
          <div className="flex flex-col items-center gap-4 pt-7">
            <Button href={ROUTES.contact} variant="primary-inverse" onClick={close} className="w-full">
              Ask about the offer
            </Button>
            <button
              type="button"
              onClick={close}
              className="cursor-pointer text-mdk-label text-mdk-white underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-white"
            >
              Continue to site
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
