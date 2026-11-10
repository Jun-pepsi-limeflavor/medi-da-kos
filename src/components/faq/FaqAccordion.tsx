"use client";

// FAQ 2 · Topic Navigation & Accordion.
// - 왼쪽: 카테고리 6개 목록(lg 이상, sticky top 96px). 클릭 → 해당 그룹으로 이동(#getting-started 등), Scroll Spy로 현재 그룹 강조
// - 오른쪽: 카테고리별 질문 Accordion. 동시에 최대 1개 열림, 처음에는 모두 닫힘(Figma 10/28 결정)
//   · 질문 = button(aria-expanded·aria-controls), 답변 = region. 닫힌 답변은 inert로 포커스 제외
//   · 높이 전환 250ms(prefers-reduced-motion이면 즉시). 열고 닫을 때 페이지를 강제로 스크롤하지 않고 브라우저 기본
//     스크롤 앵커링에 맡긴다. 위 답변이 접히며 누른 질문이 Navbar 뒤로 가려진 경우에만 한 번 보이게 맞춘다
// - 딥링크 /faq#faq-001~039: 해당 질문으로 이동해 그 질문만 펼친다(scroll-margin 96px = Navbar 72 + 24)
// - lg 미만은 카테고리 목록 없이 그룹만 한 열로 표시
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FAQ_CATEGORIES, type FaqItem } from "@/components/faq/faq-data";
import { SECTION_CONTAINER } from "@/components/home/styles";
import { useScrollSpy } from "@/hooks/use-scroll-spy";
import { cx } from "@/lib/utils/cx";

const TOPIC_IDS = FAQ_CATEGORIES.map((category) => category.id);
const ITEM_IDS = new Set(FAQ_CATEGORIES.flatMap((category) => category.items.map((item) => item.id)));
/** Navbar 72 + 24px gap: Scroll Spy line, sticky top, and anchor scroll-margin. */
const TOPIC_OFFSET = 96;
/** Sticky Navbar height: a question whose top is above this line is hidden behind it. */
const NAVBAR_HEIGHT = 72;
const TRANSITION_MS = 250;

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

  // Deep link (/faq#faq-030): open that question and keep it aligned below the Navbar.
  useEffect(() => {
    // On client navigation (e.g. Services 'Related questions') Next.js may update the URL just after this page
    // mounts, so check the hash for a few frames (~0.5s) before giving up.
    const openFromHash = () => {
      let frames = 0;
      const check = () => {
        const id = decodeURIComponent(window.location.hash.slice(1));
        if (ITEM_IDS.has(id)) {
          setOpenId(id);
          document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "instant" });
        } else if (++frames < 30) {
          requestAnimationFrame(check);
        }
      };
      requestAnimationFrame(check);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

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
