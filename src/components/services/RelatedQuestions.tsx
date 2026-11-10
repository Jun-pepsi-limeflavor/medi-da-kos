// Services 섹션 하단 'Related questions' 링크 줄.
// - FAQ 질문 고정 ID(/faq#faq-0NN)로 연결(Figma 주석). lg 미만은 세로로 쌓고, lg 이상은 가로 배치 후 넘치면 줄바꿈
import Link from "next/link";
import { ROUTES } from "@/lib/config/routes";

export type RelatedQuestion = { id: string; question: string };

export function RelatedQuestions({ items }: { items: readonly RelatedQuestion[] }) {
  return (
    <div className="flex flex-col gap-3 text-[15px] leading-5 font-medium tracking-[-0.003em] lg:flex-row lg:flex-wrap lg:items-center lg:gap-6">
      <p className="text-mdk-charcoal-muted">Related questions</p>
      <ul className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:gap-6">
        {items.map(({ id, question }) => (
          <li key={id}>
            <Link
              href={`${ROUTES.faq}#${id}`}
              className="text-mdk-charcoal underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-charcoal"
            >
              {question} →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
