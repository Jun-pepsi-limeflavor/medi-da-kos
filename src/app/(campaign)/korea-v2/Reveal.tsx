"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/**
 * 스크롤로 들어올 때 한 번만 나타나는 래퍼.
 *
 * 왜 IntersectionObserver인가 — CSS의 `animation-timeline: view()`가 더 짧지만
 * 파이어폭스가 아직 못 읽는다. 콜드메일 수신자의 브라우저를 고를 수 없으므로
 * 어디서나 같게 도는 쪽을 쓴다.
 *
 * 왜 한 번만인가 — 오갈 때마다 다시 재생되면 폼까지 내려갔다 되돌아온 사람에게
 * 페이지가 계속 움직인다. 읽으러 온 사람에게는 그게 소음이다.
 *
 * `prefers-reduced-motion`은 CSS 쪽에서 전환을 통째로 끈다. 여기서 분기하지
 * 않는 이유는 그래야 최종 상태(보이는 상태)가 항상 같아서다 — 애니메이션을
 * 끄는 것이지 내용을 감추는 게 아니다.
 */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  className = "",
  children,
}: {
  as?: ElementType;
  /** 같은 묶음 안에서 순서를 벌릴 때. 120ms를 넘기면 느리다는 인상이 된다. */
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // 이미 화면 안에 있는 첫 화면 요소는 관찰을 기다리지 않는다.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      // 아래에서 12% 올라온 시점. 요소가 화면에 닿자마자 시작하면
      // 이미 다 나타난 뒤에 눈이 도착해 움직임이 안 읽힌다.
      { rootMargin: "0px 0px -12% 0px", threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-reveal={shown ? "in" : "out"}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`reveal ${className}`}
    >
      {children}
    </Tag>
  );
}
