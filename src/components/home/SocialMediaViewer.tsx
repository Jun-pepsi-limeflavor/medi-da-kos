"use client";

// SNS Post Modal 미디어 영역 — 플랫폼과 관계없이 각 미디어의 type(image·video)으로 표시한다.
// - 이미지: 영역 안에 비율 그대로(object-contain, 왜곡·잘림 없음), 배경 light-gray(Figma Instagram 미디어 #E5E5E5)
// - 영상: 비율 그대로 가운데, 배경 차콜(Figma TikTok 세로 영상). 자동 재생 없음 — 흰 원형 Play 버튼·영상 클릭으로 재생/일시정지,
//   소리 켜짐(사용자가 직접 재생), poster 사용. 현재 슬라이드만 렌더링하므로 슬라이드를 바꾸거나 모달을 닫으면 영상이 멈추고 처음부터
// - 여러 미디어: 이전·다음 버튼(40px 흰 원형, 처음·끝에서는 비활성 — 순환 없음), 아래 점(현재 위치), ←/→ 키, 좌우 스와이프.
//   1개면 버튼·점 숨김. 영역 크기가 고정이라 슬라이드가 바뀌어도 모달 레이아웃은 그대로
import Image from "next/image";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { SocialMedia, SocialVideo } from "@/lib/social/types";
import { cx } from "@/lib/utils/cx";

const NAV_BUTTON =
  "absolute top-1/2 z-10 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-mdk-white text-mdk-charcoal disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-white";
const SWIPE_PX = 40;

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d={direction === "left" ? "M12.5 5l-5 5 5 5" : "M7.5 5l5 5-5 5"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VideoSlide({ media }: { media: SocialVideo }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setPlaying(false));
    else video.pause();
  };
  return (
    <>
      <video
        ref={ref}
        src={media.src}
        poster={media.poster}
        playsInline
        preload="metadata"
        aria-label={media.alt}
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="size-full cursor-pointer object-contain"
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause video" : "Play video"}
        className={cx(
          "absolute top-1/2 left-1/2 flex size-14 -translate-1/2 cursor-pointer items-center justify-center rounded-full bg-mdk-white text-mdk-charcoal transition-opacity motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-white",
          playing && "pointer-events-none opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100",
        )}
      >
        {playing ? (
          <svg width="20" height="22" viewBox="0 0 20 22" fill="currentColor" aria-hidden="true">
            <rect x="4" y="3" width="4" height="16" rx="1" />
            <rect x="12" y="3" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="20" height="22" viewBox="0 0 20 22" fill="currentColor" aria-hidden="true" className="ml-1">
            <path d="M4 3.6v14.8a1 1 0 0 0 1.5.86l12.3-7.4a1 1 0 0 0 0-1.72L5.5 2.74A1 1 0 0 0 4 3.6z" />
          </svg>
        )}
      </button>
    </>
  );
}

export function SocialMediaViewer({ media, className }: { media: readonly SocialMedia[]; className?: string }) {
  const [index, setIndex] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const current = media[Math.min(index, media.length - 1)];
  const many = media.length > 1;
  const go = (next: number) => setIndex(Math.max(0, Math.min(media.length - 1, next)));

  const onKeyDown = (event: KeyboardEvent) => {
    if (!many) return;
    if (event.key === "ArrowLeft") go(index - 1);
    else if (event.key === "ArrowRight") go(index + 1);
    else return;
    event.preventDefault();
  };
  const onPointerDown = (event: PointerEvent) => {
    start.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: PointerEvent) => {
    const from = start.current;
    start.current = null;
    if (!many || !from) return;
    const dx = event.clientX - from.x;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(event.clientY - from.y)) go(index + (dx < 0 ? 1 : -1));
  };

  if (!current) return <div className={cx("bg-mdk-light-gray", className)} />;

  return (
    <div
      role={many ? "region" : undefined}
      aria-roledescription={many ? "carousel" : undefined}
      aria-label={many ? "Post media" : undefined}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      className={cx("relative touch-pan-y overflow-hidden select-none", current.type === "video" ? "bg-mdk-charcoal" : "bg-mdk-light-gray", className)}
    >
      <div
        key={index}
        role={many ? "group" : undefined}
        aria-roledescription={many ? "slide" : undefined}
        aria-label={many ? `${index + 1} of ${media.length}` : undefined}
        className="absolute inset-0"
      >
        {current.type === "image" ? (
          // Platform CDN URLs change and expire, so they bypass the Next.js optimizer.
          <Image src={current.src} alt={current.alt} fill sizes="(max-width: 1023px) 100vw, 680px" unoptimized draggable={false} className="object-contain" />
        ) : (
          <VideoSlide media={current} />
        )}
      </div>

      {many ? (
        <>
          <button type="button" aria-label="Previous slide" disabled={index === 0} onClick={() => go(index - 1)} className={cx(NAV_BUTTON, "left-3 sm:left-5")}>
            <Chevron direction="left" />
          </button>
          <button type="button" aria-label="Next slide" disabled={index === media.length - 1} onClick={() => go(index + 1)} className={cx(NAV_BUTTON, "right-3 sm:right-5")}>
            <Chevron direction="right" />
          </button>
          <div className="absolute bottom-[26px] left-1/2 z-10 flex -translate-x-1/2 gap-1.5" aria-hidden="true">
            {media.map((item, i) => (
              <span key={i} className={cx("size-1.5 rounded-full", i === index ? "bg-mdk-charcoal" : "bg-mdk-white")} />
            ))}
          </div>
          <p className="sr-only" aria-live="polite">
            Slide {index + 1} of {media.length}
          </p>
        </>
      ) : null}
    </div>
  );
}
