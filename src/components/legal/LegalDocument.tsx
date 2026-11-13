// Privacy Policy·Terms of Service 공통 문서 틀(Figma 'Privacy Policy — Final Design' 548:1012 · 'Terms of Service — Final Design' 549:1057).
// - 1 · Header: 제목(MDK/Display L)과 시행일·최종 수정일, 하단 전체 폭 1px light-gray 구분선
// - 2 · Body: lg 이상 왼쪽 목차(LegalContents, sticky) + 오른쪽 본문(텍스트 폭 720px), lg 미만은 목차 없이 본문 1열(FAQ와 같은 기준)
// - 목차·본문 참조 링크(Section 2.3 등)는 공용 SamePageHashUrl로 해시 없이 이동, 해시로 들어오면 이동 후 주소창 정리
// - 본문 블록: 문단 · H3(2.1 등) · 소제목(① 등) · 글머리 목록 · 굵은 라벨 행(Legal Entity Name: 등). 문구는 각 데이터 파일 원문 그대로
// - 섹션 간 48px, 섹션 안 16px, 목록 항목 사이 간격 0px(Figma 프레임 실측·주석 확정)
// - 목록 글머리: Figma와 같은 왼쪽 끝 약 2px 점, 텍스트 시작 15px(브라우저 기본 원형 글머리·24px 들여쓰기 대신)
import Link from "next/link";
import type { ReactNode } from "react";
import { DISPLAY_TITLE, SECTION_CONTAINER } from "@/components/home/styles";
import { SamePageHashUrl } from "@/components/layout/SamePageHashUrl";
import { LegalContents } from "@/components/legal/LegalContents";
import { cx } from "@/lib/utils/cx";

/** Text with optional links: a plain string, or parts where a link is `{ text, href }`. */
export type LegalText = string | readonly (string | { text: string; href: string })[];

export type LegalBlock =
  | { type: "p"; text: LegalText }
  | { type: "h3"; text: string; id?: string }
  | { type: "subheading"; text: string }
  | { type: "list"; items: readonly LegalText[] }
  | { type: "field"; label: string; value: LegalText };

export type LegalSection = { id: string; title: string; blocks: readonly LegalBlock[] };

export type LegalDocumentData = {
  title: string;
  effectiveDate: string;
  lastUpdated: string;
  sections: readonly LegalSection[];
};

const LINK = "underline underline-offset-2 hover:text-mdk-charcoal-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-charcoal";

function Text({ text }: { text: LegalText }) {
  if (typeof text === "string") return text;
  return text.map((part, i) => {
    if (typeof part === "string") return part;
    if (part.href.startsWith("/")) {
      return <Link key={i} href={part.href} className={LINK}>{part.text}</Link>;
    }
    return <a key={i} href={part.href} className={LINK}>{part.text}</a>;
  });
}

function Block({ block }: { block: LegalBlock }): ReactNode {
  switch (block.type) {
    case "p":
      return <p><Text text={block.text} /></p>;
    case "h3":
      return (
        <h3 id={block.id} className="scroll-mt-24 text-lg leading-[26px] font-medium tracking-normal text-mdk-charcoal">
          {block.text}
        </h3>
      );
    case "subheading":
      return <h4 className="font-semibold">{block.text}</h4>;
    case "list":
      return (
        // Figma list: ~2px dot at the left edge, text from 15px. role="list" keeps list semantics with list-style none.
        <ul role="list" className="list-none">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="relative pl-[15px] before:absolute before:top-[10px] before:left-0 before:size-[2px] before:bg-current before:content-['']"
            >
              <Text text={item} />
            </li>
          ))}
        </ul>
      );
    case "field":
      return (
        <p>
          <strong className="font-semibold">{block.label}</strong> <Text text={block.value} />
        </p>
      );
  }
}

/** Figma: 1 · Header + 2 · Body (Contents + Sections). */
export function LegalDocument({ data }: { data: LegalDocumentData }) {
  const toc = data.sections.map(({ id, title }) => ({ id, title }));

  return (
    <>
      <header className="border-b border-mdk-light-gray bg-mdk-white pt-12 pb-10 lg:pt-24 lg:pb-16">
        <div className={cx(SECTION_CONTAINER, "flex flex-col gap-4 lg:gap-6")}>
          <h1 className={cx(DISPLAY_TITLE, "text-mdk-charcoal")}>{data.title}</h1>
          <p className="flex flex-wrap gap-x-8 gap-y-1 text-mdk-label text-mdk-charcoal-muted">
            <span>Effective Date: {data.effectiveDate}</span>
            <span>Last Updated: {data.lastUpdated}</span>
          </p>
        </div>
      </header>

      <div className="bg-mdk-white pt-8 pb-20 lg:pt-16 lg:pb-40">
        <div className={cx(SECTION_CONTAINER, "flex flex-col lg:flex-row lg:items-start lg:gap-16 xl:gap-24")}>
          <LegalContents items={toc} />

          <div className="flex min-w-0 flex-1 flex-col">
            {data.sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-title`}
                className={cx(
                  "flex max-w-[720px] flex-col gap-4 text-mdk-body text-mdk-charcoal [overflow-wrap:anywhere]",
                  index === 0 ? "scroll-mt-24" : "scroll-mt-12 pt-12",
                )}
              >
                <h2 id={`${section.id}-title`} className="text-mdk-title text-mdk-charcoal">
                  {section.title}
                </h2>
                {section.blocks.map((block, i) => (
                  <Block key={i} block={block} />
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
      <SamePageHashUrl />
    </>
  );
}
