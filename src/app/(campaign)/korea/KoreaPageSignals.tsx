"use client";

import { useEffect } from "react";
import {
  setKoreaArm,
  setKoreaVariant,
  trackCtaView,
  trackEngaged15s,
  trackScrollDepth,
  trackSectionView,
  type KoreaCtaId,
  type KoreaSectionId,
  type KoreaVariant,
} from "./analytics";

const DEPTHS = [25, 50, 75, 100] as const;

/** CTA가 이만큼 머물러야 "봤다"로 친다. 스쳐 지나간 노출을 세지 않기 위함. */
const CTA_DWELL_MS = 3000;

/** 사람만 남기는 자체 참여 기준. GA4 기본 10초는 봇이 통과한다. */
const ENGAGED_MS = 15000;

/**
 * 화면에 아무것도 그리지 않는 계측 전용 컴포넌트.
 *
 * 스크롤 도달률을 직접 잰다 — GA4 향상된 측정의 `scroll`은 90% 도달 1회뿐이라
 * "어디까지 읽고 떠났나"를 못 본다. 주차마다 카피 순서가 바뀌는 페이지에서는
 * 그 분포가 판정 근거라서 25/50/75/100을 따로 쏜다.
 *
 * 구간 노출은 IntersectionObserver로 잡는다. `data-section` 속성이 붙은
 * 요소를 자동으로 찾으므로 섹션이 늘어도 이 파일은 안 고친다.
 */
export function KoreaPageSignals({
  arm,
  variant = "v1",
}: {
  arm: string;
  variant?: KoreaVariant;
}) {
  // 다른 이벤트보다 먼저 세션 값을 세운다 — 첫 section_view가 이미 여기 의존한다.
  useEffect(() => {
    setKoreaVariant(variant);
  }, [variant]);

  useEffect(() => {
    setKoreaArm(arm);
  }, [arm]);

  useEffect(() => {
    const fired = new Set<number>();

    const measure = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      // 화면보다 짧은 문서는 도달률을 물을 수 없다.
      if (scrollable <= 0) return;

      const reached = ((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100;
      for (const depth of DEPTHS) {
        if (reached >= depth && !fired.has(depth)) {
          fired.add(depth);
          trackScrollDepth(depth);
        }
      }
    };

    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        measure();
      });
    };

    measure(); // 첫 화면에서 이미 25%를 넘겼을 수 있다
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const seen = new Set<string>();
    const targets = document.querySelectorAll<HTMLElement>("[data-section]");
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-section");
          if (!id || seen.has(id) || !entry.isIntersecting) continue;
          seen.add(id);
          trackSectionView(id as KoreaSectionId);
          observer.unobserve(entry.target);
        }
      },
      // 화면 높이의 절반을 넘겨야 "봤다"로 친다. 스쳐 지나간 구간을 세지 않기 위함.
      { threshold: 0, rootMargin: "-50% 0px -50% 0px" },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  // CTA 가시성 — 화면에 CTA_DWELL_MS 이상 머문 것만 1회씩
  useEffect(() => {
    const seen = new Set<string>();
    const timers = new Map<Element, number>();
    const targets = document.querySelectorAll<HTMLElement>("[data-cta]");
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-cta");
          if (!id) continue;

          if (!entry.isIntersecting) {
            const pending = timers.get(entry.target);
            if (pending !== undefined) {
              window.clearTimeout(pending);
              timers.delete(entry.target);
            }
            continue;
          }

          if (seen.has(id) || timers.has(entry.target)) continue;
          timers.set(
            entry.target,
            window.setTimeout(() => {
              timers.delete(entry.target);
              if (seen.has(id)) return;
              seen.add(id);
              trackCtaView(id as KoreaCtaId);
            }, CTA_DWELL_MS),
          );
        }
      },
      { threshold: 0.5 },
    );

    targets.forEach((target) => observer.observe(target));
    return () => {
      observer.disconnect();
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  // 참여 15초 — 탭이 보이는 동안만 시간을 센다
  useEffect(() => {
    let elapsed = 0;
    let since = document.visibilityState === "visible" ? Date.now() : null;
    let timer: number | undefined;
    let fired = false;

    const fire = () => {
      if (fired) return;
      fired = true;
      trackEngaged15s();
    };

    const schedule = () => {
      if (fired || since === null) return;
      timer = window.setTimeout(fire, ENGAGED_MS - elapsed);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        since = Date.now();
        schedule();
        return;
      }
      if (since !== null) elapsed += Date.now() - since;
      since = null;
      if (timer !== undefined) window.clearTimeout(timer);
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
