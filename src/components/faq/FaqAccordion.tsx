"use client";

// FAQ 2 · Topic Navigation & Accordion.
// - 왼쪽: 카테고리 6개 목록(lg 이상, sticky top 96px). 클릭 → 해당 그룹으로 이동(#getting-started 등), Scroll Spy로 현재 그룹 강조
// - 오른쪽: 카테고리별 질문 Accordion. 동시에 최대 1개 열림, 처음에는 모두 닫힘(Figma 10/28 결정)
//   · 질문 = button(aria-expanded·aria-controls), 답변 = region. 닫힌 답변은 inert로 포커스 제외
//   · 높이 전환 250ms(prefers-reduced-motion이면 즉시). 열고 닫을 때 페이지를 강제로 스크롤하지 않고 브라우저 기본
//     스크롤 앵커링에 맡긴다. 위 답변이 접히며 누른 질문이 Navbar 뒤로 가려진 경우에만 한 번 보이게 맞춘다
// - 진입 방식별 처리(주소창 해시만 믿지 않음 — Next 16.2.6이 이전 딥링크 해시를 /faq 이동에 다시 붙이는 문제 대응,
//   lib/utils/navigation-intent가 실제로 누른 링크를 기록):
//   · 일반 /faq 링크(Navbar·Footer·CTA 등): 맨 위, 모든 질문 닫힘, 붙어 온 해시는 지움
//   · 질문 딥링크(/faq#faq-001~039, Services 'Related questions' 등): 누른 링크의 해시로 그 질문만 열고 이동
//     (scroll-margin 96px = Navbar 72 + 24), 이동 후 주소창 해시를 지워 /faq만 남긴다
//   · 해시가 있는 주소로 직접 접속: 기존과 같이 그 질문을 연다 / 해시 없는 /faq 새로고침: 맨 위, 모두 닫힘
//   · 브라우저 뒤로·앞으로: 이 방문 기록(history.state)에 저장해 둔 열린 질문·스크롤 위치를 복원
// - 열린 질문·스크롤 위치는 현재 방문 기록에만 저장(replaceState, URL 변경·기록 추가 없음): 스크롤 200ms 디바운스 +
//   링크 클릭(다음 기록이 push되기 전)·pagehide 때 즉시
// - 카테고리 목록 클릭: 공용 SamePageHashUrl이 해시 없이 해당 그룹으로 스크롤(주소창은 /faq 유지)
// - lg 미만은 카테고리 목록 없이 그룹만 한 열로 표시
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FAQ_CATEGORIES, type FaqItem } from "@/components/faq/faq-data";
import { SECTION_CONTAINER } from "@/components/home/styles";
import { clearHashAfterLoad } from "@/components/layout/SamePageHashUrl";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
import { ROUTES } from "@/lib/config/routes";
import { cx } from "@/lib/utils/cx";
import { pageEntry } from "@/lib/utils/navigation-intent";

const TOPIC_IDS = FAQ_CATEGORIES.map((category) => category.id);
const ITEM_IDS = new Set(FAQ_CATEGORIES.flatMap((category) => category.items.map((item) => item.id)));
/** Navbar 72 + 24px gap: Scroll Spy line, sticky top, and anchor scroll-margin. */
const TOPIC_OFFSET = 96;
/** Sticky Navbar height: a question whose top is above this line is hidden behind it. */
const NAVBAR_HEIGHT = 72;
const TRANSITION_MS = 250;

/** Open question and scroll offset kept on the FAQ history entry (history.state), for back/forward only. */
type SavedFaqState = { openId: string | null; y: number };
const STATE_KEY = "mdkFaq";

function readSavedFaqState(): SavedFaqState | null {
  const saved = (window.history.state as Record<string, unknown> | null)?.[STATE_KEY] as SavedFaqState | undefined;
  return saved && typeof saved.y === "number" ? saved : null;
}

function writeSavedFaqState(saved: SavedFaqState) {
  if (window.location.pathname !== ROUTES.faq) return; // never write onto the next page's entry
  // Spread keeps Next's own keys (__NA…), so its patched replaceState passes this straight through; URL unchanged.
  window.history.replaceState({ ...(window.history.state ?? {}), [STATE_KEY]: saved }, "");
}

/**
 * After the height transition: only if the clicked question ended up hidden behind the sticky Navbar
 * (a long answer above it collapsed in a browser without scroll anchoring), bring it back into view once.
 * Otherwise the page is left alone — answers open and close with the natural layout shift.
 */
function revealIfHidden(el: HTMLElement) {
  if (el.getBoundingClientRect().top < NAVBAR_HEIGHT) return; // was not visible when clicked: leave the page alone
  window.setTimeout(() => {
    if (el.getBoundingClientRect().top >= NAVBAR_HEIGHT) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "start", behavior: reduce ? "instant" : "smooth" });
  }, TRANSITION_MS + 50);
}

/** Figma: 2 · Topic Navigation & Accordion (290:573). */
export function FaqAccordion() {
  const [openId, setOpenId] = useState<string | null>(null);
  const { active, lock } = useScrollSpy(TOPIC_IDS, TOPIC_OFFSET);

  /** Until this time a back/forward restore is in progress: saving now would overwrite the offset being restored. */
  const restoringUntil = useRef(0);

  // Entry: decide from how the page was reached, not from the address bar alone (Next can carry an old hash —
  // see lib/utils/navigation-intent). Runs once per mount; in-page toggles and topic clicks never reset anything.
  useEffect(() => {
    const timers: number[] = [];
    let cleanupHash: (() => void) | undefined;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // After Next.js has applied its own scroll for the navigation (a frame, then a tick).
    const afterRouterScroll = (fn: () => void) => requestAnimationFrame(() => timers.push(window.setTimeout(fn)));
    const clearHash = () => {
      cleanupHash?.();
      cleanupHash = clearHashAfterLoad();
    };
    const openItem = (id: string) => {
      setOpenId(id);
      afterRouterScroll(() => {
        document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "instant" });
        clearHash();
      });
    };
    const goToTop = () =>
      afterRouterScroll(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
        if (location.hash) clearHash();
      });
    const restore = (saved: SavedFaqState) => {
      const delay = reduce ? 0 : TRANSITION_MS + 50;
      restoringUntil.current = Date.now() + delay + 100;
      setOpenId(saved.openId && ITEM_IDS.has(saved.openId) ? saved.openId : null);
      // Wait for the answer's height transition so the saved offset lands where it was.
      timers.push(window.setTimeout(() => window.scrollTo({ top: saved.y, behavior: "instant" }), delay));
    };
    // Hash written in the address bar (direct visit with a hash, or a hash change inside the page).
    const openFromHash = () => {
      let frames = 0;
      const check = () => {
        const id = decodeURIComponent(window.location.hash.slice(1));
        if (ITEM_IDS.has(id)) openItem(id);
        else if (TOPIC_IDS.includes(id)) clearHash();
        else if (++frames < 30) requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    };

    const entry = pageEntry(ROUTES.faq);
    const saved = readSavedFaqState();
    if (entry.kind === "link") {
      // Use the clicked link's own hash: a plain /faq link opens the page fresh even if Next added an old hash.
      const id = decodeURIComponent(entry.hash.slice(1));
      if (ITEM_IDS.has(id)) openItem(id);
      else if (TOPIC_IDS.includes(id)) afterRouterScroll(() => {
        document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "instant" });
        clearHash();
      });
      else if (location.hash) goToTop();
    } else if (entry.kind === "traversal") {
      if (saved) restore(saved);
    } else if (location.hash) {
      openFromHash();
    } else if (entry.type === "back_forward" && saved) {
      restore(saved);
    } else if (entry.type === "reload") {
      // A plain /faq reload starts fresh: closed and at the top, even if the browser restored the old offset.
      timers.push(window.setTimeout(() => window.scrollTo({ top: 0, behavior: "instant" })));
      window.addEventListener("load", () => window.scrollTo({ top: 0, behavior: "instant" }), { once: true });
    }

    window.addEventListener("hashchange", openFromHash);
    return () => {
      window.removeEventListener("hashchange", openFromHash);
      timers.forEach((t) => window.clearTimeout(t));
      cleanupHash?.();
    };
  }, []);

  // Keep the open question and scroll offset on this history entry, so browser back/forward can restore them.
  useEffect(() => {
    let timer = 0;
    const saveNow = () => {
      window.clearTimeout(timer);
      if (Date.now() < restoringUntil.current) {
        timer = window.setTimeout(saveNow, restoringUntil.current - Date.now());
        return;
      }
      writeSavedFaqState({ openId, y: Math.round(window.scrollY) });
    };
    const save = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(saveNow, 200);
    };
    save();
    window.addEventListener("scroll", save, { passive: true });
    // Also save right before leaving (a link click runs before Next pushes the next entry), so no scroll is lost.
    document.addEventListener("click", saveNow, true);
    window.addEventListener("pagehide", saveNow);
    return () => {
      window.removeEventListener("scroll", save);
      document.removeEventListener("click", saveNow, true);
      window.removeEventListener("pagehide", saveNow);
      window.clearTimeout(timer);
    };
  }, [openId]);

  const toggle = (id: string) => {
    const el = document.getElementById(id);
    setOpenId((current) => (current === id ? null : id));
    if (el) revealIfHidden(el);
  };

  return (
    <section className="bg-mdk-white pt-10 pb-20 lg:pt-[72px] lg:pb-40">
      <div className={`${SECTION_CONTAINER} flex items-start gap-[104px]`}>
        <nav aria-label="FAQ topics" className="hidden w-[280px] shrink-0 self-start lg:sticky lg:top-24 lg:block">
          <ul>
            {FAQ_CATEGORIES.map(({ id, title }) => {
              const current = id === active;
              return (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    onClick={() => lock(id)}
                    aria-current={current ? "true" : undefined}
                    className={cx(
                      "flex h-12 items-center border-l-2 pl-[18px] text-[15px] leading-5 tracking-[-0.003em] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mdk-charcoal",
                      current
                        ? "border-mdk-charcoal font-semibold text-mdk-charcoal"
                        : "border-mdk-light-gray font-medium text-mdk-charcoal-muted hover:text-mdk-charcoal",
                    )}
                  >
                    {title}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-14 lg:gap-[88px]">
          {FAQ_CATEGORIES.map((category) => (
            <div key={category.id} id={category.id} className="flex scroll-mt-24 flex-col gap-7">
              <h2 className="border-b border-mdk-charcoal pb-5 text-[26px] leading-8 font-semibold tracking-[-0.015em] text-mdk-charcoal lg:text-[32px] lg:leading-[38px]">
                {category.title}
              </h2>
              <ul className="flex flex-col gap-2">
                {category.items.map((item) => (
                  <AccordionItem key={item.id} item={item} open={openId === item.id} onToggle={() => toggle(item.id)} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Figma: Design System › Accordion Item (227:61) — Closed: white + light-gray border, Open: off-white + minus. */
function AccordionItem({ item, open, onToggle }: { item: FaqItem; open: boolean; onToggle: () => void }) {
  const questionId = `${item.id}-question`;
  const answerId = `${item.id}-answer`;
  return (
    <li
      id={item.id}
      className={cx(
        // 1px border as in Figma's closed card (88px); open card hides it with the background color.
        "scroll-mt-24 rounded-[4px] border transition-colors motion-reduce:transition-none",
        open ? "border-mdk-off-white bg-mdk-off-white" : "border-mdk-light-gray bg-mdk-white",
      )}
    >
      <h3>
        <button
          type="button"
          id={questionId}
          aria-expanded={open}
          aria-controls={answerId}
          onClick={onToggle}
          className={cx(
            "flex w-full cursor-pointer items-center gap-6 rounded-[4px] px-5 pt-5 text-left text-[19px] leading-[27px] font-medium tracking-[-0.015em] text-mdk-charcoal transition-[padding] duration-[250ms] ease-out motion-reduce:transition-none sm:px-8 sm:pt-7 lg:text-[22px] lg:leading-[30px]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-charcoal",
            open ? "pb-3 sm:pb-4" : "pb-5 sm:pb-7",
          )}
        >
          <span className="min-w-0 flex-1">{item.question}</span>
          <Image src={open ? "/icons/minus.svg" : "/icons/plus.svg"} alt="" width={24} height={24} className="shrink-0" />
        </button>
      </h3>
      <div
        id={answerId}
        role="region"
        aria-labelledby={questionId}
        inert={!open}
        className={cx(
          "grid transition-[grid-template-rows] duration-[250ms] ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col items-start gap-4 px-5 pb-5 text-[17px] leading-[27px] tracking-[-0.002em] text-mdk-charcoal sm:px-8 sm:pb-7">
            {item.answer.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {item.link ? (
              <Link
                href={item.link.href}
                className="font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-charcoal"
              >
                {item.link.label}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
