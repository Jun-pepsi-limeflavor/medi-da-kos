"use client";

import { useEffect } from "react";
import { trackLandingEvent } from "@/lib/landing/analytics";
import type { LandingVariant } from "@/lib/landing/types";

/** korea `KoreaPageSignals`와 같은 기준. 값을 바꾸면 랜딩 간 비교가 깨진다. */
const CTA_DWELL_MS = 3000;
const ENGAGED_MS = 15000;

/**
 * catalog·dashboard의 `cta_view`·`engaged_15s`. korea `KoreaPageSignals`와 같은 조건으로 센다.
 *
 * 페이지 최상단에 둔다 — 상담 폼으로 화면이 바뀌어도 언마운트되지 않아야 15초 누적이 이어진다.
 * CTA는 브리프 로딩 뒤에 그려지기도 해서 새로 생긴 `[data-cta]`도 관찰한다.
 * `scroll_depth`·`section_view`는 두지 않는다 — 탭·스텝·폼 전환으로 문서 길이가 바뀌어 korea와 같은 뜻이 안 된다.
 */
export function LandingSignals({ variant }: { variant: Exclude<LandingVariant, "korea"> }) {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const seen = new Set<string>();
    const watched = new WeakSet<Element>();
    const timers = new Map<Element, number>();

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
              trackLandingEvent("cta_view", variant, { cta_id: id });
            }, CTA_DWELL_MS),
          );
        }
      },
      { threshold: 0.5 },
    );

    const watchNew = () => {
      document.querySelectorAll<HTMLElement>("[data-cta]").forEach((target) => {
        if (watched.has(target)) return;
        watched.add(target);
        observer.observe(target);
      });
    };

    watchNew();
    const mutations = new MutationObserver(watchNew);
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      mutations.disconnect();
      observer.disconnect();
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [variant]);

  // 탭이 보이는 동안만 센다
  useEffect(() => {
    let elapsed = 0;
    let since = document.visibilityState === "visible" ? Date.now() : null;
    let timer: number | undefined;
    let fired = false;

    const fire = () => {
      if (fired) return;
      fired = true;
      trackLandingEvent("engaged_15s", variant);
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
  }, [variant]);

  return null;
}
