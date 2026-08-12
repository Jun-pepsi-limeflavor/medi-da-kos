"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { trackFormulaView } from "../korea/analytics";
import { defineScrollCarousel } from "./scroll-carousel";

export type Formula = {
  name: string;
  kicker: string;
  body: string;
  /** public/korea-v2/ 아래 텍스처 사진. 성분마다 제형이 다르게 보이는 컷으로. */
  image: string;
  /** 스크린리더용. 성분 설명이 아니라 사진에 보이는 것만 적는다. */
  alt: string;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "scroll-carousel": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}

/**
 * 성분 카드 가로 캐러셀.
 *
 * 화살표·점을 두지 않는다 — 컨테이너 오른쪽 여백을 먹어서(bleed) 다음 카드가
 * 잘린 채 보이면 "더 있다"가 컨트롤 없이 전달된다. 참고한 dyou.co가 그 방식이고,
 * 컨트롤이 없으면 모바일에서 탭 표적이 줄어드는 이득도 같이 온다.
 *
 * 카드 폭을 고정하는 게 핵심이다. 유동 폭으로 두면 넓은 화면에서 다섯 장이
 * 전부 들어와 잘리는 카드가 사라지고, 그 순간 가로 캐러셀일 이유가 없어진다.
 */
export function FormulaCarousel({ formulas }: { formulas: readonly Formula[] }) {
  const trackRef = useRef<HTMLElement>(null);

  useEffect(() => {
    defineScrollCarousel();
  }, []);

  // 어느 성분까지 넘겼는지 + 카드 사진을 그 시점에 제자리로 돌린다.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const counted = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const card = entry.target as HTMLElement;
          if (!entry.isIntersecting) continue;

          // 사진 확대 해제는 카드마다 한 번. 관찰은 계속 두지 않는다.
          card.dataset.reveal = "in";

          const id = card.dataset.formula;
          if (!id || counted.has(id)) {
            observer.unobserve(card);
            continue;
          }
          counted.add(id);
          trackFormulaView(id);
          observer.unobserve(card);
        }
      },
      // 가로 스크롤이라 root는 트랙 자신이다. 뷰포트를 기준으로 잡으면
      // 옆으로 밀려난 카드가 계속 "보이는 중"으로 남는다.
      { root: track, threshold: 0.5 },
    );

    track
      .querySelectorAll<HTMLElement>("[data-formula]")
      .forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="carousel-shell">
      {/*
       * -mr-*와 안쪽 pr-*가 짝이다. 컨테이너 오른쪽 패딩을 상쇄해 카드가 화면
       * 끝까지 흐르게 하고, 마지막 카드 뒤에 같은 폭의 여백을 되돌려준다.
       * scroll-snap·스크롤바 숨김·잡아끌기는 korea-v2.css의 요소 선택자에 있다.
       */}
      <scroll-carousel
        ref={trackRef}
        className="scroll-area bleed -mr-4 block pb-2 sm:-mr-6 lg:-mr-8"
      >
        <div className="grid grid-flow-col auto-cols-[82vw] gap-2 pr-4 sm:auto-cols-[380px] sm:pr-6 lg:auto-cols-[418px] lg:pr-8">
          {formulas.map((formula, index) => (
            <article
              key={formula.name}
              data-formula={formula.name}
              data-reveal="out"
              className="reveal-media group snap-start scroll-ml-4 overflow-hidden rounded-[4px] bg-[#F5F7FF] sm:scroll-ml-6 lg:scroll-ml-8"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={formula.image}
                  alt={formula.alt}
                  fill
                  // 카드 폭은 고정이고 뷰포트에 비례하지 않는다. 모바일만 82vw.
                  sizes="(min-width: 1024px) 418px, (min-width: 640px) 380px, 82vw"
                  className="object-cover"
                  priority={index === 0}
                />
              </div>

              <div className="p-7">
                <p className="font-body-alt text-sm text-[#2A6DCB]">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-4 font-display text-[32px] leading-none tracking-[-0.05em] text-[#2A6DCB]">
                  {formula.name}
                </h3>
                <p className="font-body-alt mt-3 text-sm text-[#68809A]">
                  {formula.kicker}
                </p>
                <p className="font-body-alt mt-6 text-base leading-relaxed text-[#68809A]">
                  {formula.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </scroll-carousel>
    </div>
  );
}
