"use client";

// Home 6 · SNS Content (On social).
// - 전달받은 게시물(posts)을 Instagram·TikTok 탭(기본 Instagram)별로 가로 캐러셀에 표시
// - 진행 막대는 가로 스크롤 위치와 연동, 이전(←)은 처음·다음(→)은 끝으로 이동(순환 없음)
// - 게시물이 화면에 모두 들어가면 화살표·진행 막대를 숨기고(높이 유지), 탭을 바꾸면 처음으로 돌아간다
// - 해당 플랫폼 게시물이 없으면 가짜 카드 없이 짧은 안내 문구 + 공식 계정 버튼(Secondary S)만 표시하고
//   캐러셀 진행 막대·화살표는 렌더링하지 않는다
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { buttonClassName } from "@/components/ui/Button";
import { SocialPostCard } from "@/components/home/SocialPostCard";
import { DISPLAY_TITLE, EYEBROW } from "@/components/home/styles";
import { SOCIAL_LINKS } from "@/lib/config/site";
import { SOCIAL_FEED_LABEL, SOCIAL_FEED_PLATFORMS, type SocialFeedPlatform, type SocialPost } from "@/lib/social/types";
import { cx } from "@/lib/utils/cx";

/** Figma tab widths stay equal between selected and default states so tabs don't shift. */
const TAB_WIDTH: Record<SocialFeedPlatform, string> = { instagram: "w-[108px]", tiktok: "w-[85px]" };

type ScrollState = { overflow: boolean; atStart: boolean; atEnd: boolean; left: number; size: number };

const INITIAL_SCROLL: ScrollState = { overflow: false, atStart: true, atEnd: false, left: 0, size: 1 };

/** Figma: 6 · SNS Content (secondary) (234:5388). `posts` come from the server-side feed, newest first. */
export function SocialSection({ posts }: { posts: readonly SocialPost[] }) {
  const [platform, setPlatform] = useState<SocialFeedPlatform>("instagram");
  const [scroll, setScroll] = useState<ScrollState>(INITIAL_SCROLL);
  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const visible = posts.filter((post) => post.platform === platform);
  const accountHref = SOCIAL_LINKS.find((link) => link.platform === platform)?.href;

  const measure = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setScroll({
      overflow: max > 1,
      atStart: el.scrollLeft <= 1,
      atEnd: el.scrollLeft >= max - 1,
      left: el.scrollWidth ? el.scrollLeft / el.scrollWidth : 0,
      size: el.scrollWidth ? el.clientWidth / el.scrollWidth : 1,
    });
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(measure);
    if (viewportRef.current) observer.observe(viewportRef.current);
    if (listRef.current) observer.observe(listRef.current);
    return () => observer.disconnect();
  }, [measure]);

  function selectPlatform(next: SocialFeedPlatform) {
    if (next === platform) return;
    setPlatform(next);
    viewportRef.current?.scrollTo({ left: 0 });
  }

  function scrollToEdge(edge: "start" | "end") {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ left: edge === "start" ? 0 : el.scrollWidth, behavior: "smooth" });
  }

  const panelId = `social-panel-${platform}`;

  return (
    <section className="bg-mdk-off-white py-20 lg:py-40">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 pl-6 lg:gap-12 xl:pl-[120px]">
        <div className="flex flex-col gap-6 pr-6 xl:pr-[120px]">
          <div className="flex flex-col gap-6">
            <p className={EYEBROW}>On social</p>
            <h2 className={cx(DISPLAY_TITLE, "max-w-[577px] text-mdk-charcoal")}>Stay in the loop on beauty insights!</h2>
          </div>
          <div role="tablist" aria-label="Social platform" className="flex gap-2">
            {SOCIAL_FEED_PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                id={`social-tab-${p}`}
                aria-selected={p === platform}
                aria-controls={`social-panel-${p}`}
                onClick={() => selectPlatform(p)}
                className={cx(buttonClassName(p === platform ? "primary" : "secondary", "s"), TAB_WIDTH[p], "px-0")}
              >
                {SOCIAL_FEED_LABEL[p]}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={viewportRef}
          onScroll={measure}
          className="overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div
            ref={listRef}
            id={panelId}
            role="tabpanel"
            aria-labelledby={`social-tab-${platform}`}
            className={visible.length > 0 ? "w-max pr-6" : "w-full pr-6 xl:pr-[120px]"}
          >
            {visible.length > 0 ? (
              <ul className="flex gap-5">
                {visible.map((post) => (
                  <li key={`${post.platform}-${post.id}`}>
                    <SocialPostCard post={post} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-start gap-5 border-t border-mdk-light-gray pt-8 sm:flex-row sm:items-center sm:gap-6">
                <p className="text-mdk-body text-mdk-charcoal-muted">
                  Latest {SOCIAL_FEED_LABEL[platform]} posts will appear here soon.
                </p>
                {accountHref ? (
                  <a
                    href={accountHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClassName("secondary", "s")}
                  >
                    Visit our {SOCIAL_FEED_LABEL[platform]} ↗
                  </a>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Hidden (height kept) when every post fits — Figma annotation. Not rendered for the empty state. */}
        {visible.length > 0 ? (
          <div className={cx("flex items-center gap-10 pr-6 xl:pr-[120px]", !scroll.overflow && "invisible")}>
            <div className="relative h-0.5 min-w-0 flex-1 overflow-hidden bg-mdk-light-gray" aria-hidden="true">
              <div
                className="absolute top-0 h-0.5 bg-mdk-charcoal"
                style={{ left: `${scroll.left * 100}%`, width: `${scroll.size * 100}%` }}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Previous posts"
                aria-controls={panelId}
                disabled={scroll.atStart}
                onClick={() => scrollToEdge("start")}
                className="flex size-12 cursor-pointer items-center justify-center rounded-full bg-mdk-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-charcoal"
              >
                <Image src="/icons/chevron-left.svg" alt="" width={20} height={20} />
              </button>
              <button
                type="button"
                aria-label="Next posts"
                aria-controls={panelId}
                disabled={scroll.atEnd}
                onClick={() => scrollToEdge("end")}
                className="flex size-12 cursor-pointer items-center justify-center rounded-full bg-mdk-charcoal disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-charcoal"
              >
                <Image src="/icons/chevron-right.svg" alt="" width={20} height={20} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
