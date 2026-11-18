"use client";

// 스크롤 위치에 따라 현재 보고 있는 섹션 id를 돌려주는 훅(Scroll Spy).
// - 섹션 상단이 기준선(offset px)을 지난 마지막 섹션을 활성으로 판단, 첫 섹션 이전에는 첫 id
// - 판정 요소는 기본 id 요소, find를 넘기면 이동 대상(id)과 다른 요소(예: 섹션 전체)로 판정
// - 클릭으로 이동하는 동안에는 lock(id)로 클릭한 항목을 잠시 유지해 깜빡임을 막는다
import { useCallback, useEffect, useRef, useState } from "react";

const byId = (id: string) => document.getElementById(id);

export function useScrollSpy(ids: readonly string[], offset: number, find: (id: string) => Element | null = byId) {
  const [active, setActive] = useState<string>(ids[0] ?? "");
  const lockedUntil = useRef(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (Date.now() < lockedUntil.current) return;
      let current = ids[0] ?? "";
      for (const id of ids) {
        const el = find(id);
        if (el && el.getBoundingClientRect().top - offset <= 1) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ids, offset, find]);

  /** Mark `id` active right away and ignore scroll updates while the smooth scroll runs. */
  const lock = useCallback((id: string, ms = 900) => {
    lockedUntil.current = Date.now() + ms;
    setActive(id);
  }, []);

  return { active, lock };
}
