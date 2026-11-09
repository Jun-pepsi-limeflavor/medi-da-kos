// Home On social 게시물 카드 1개.
// - 4:5 썸네일 + 플랫폼 태그 + "플랫폼 · 제목" 캡션(Figma Social Post Card)
// - 이미지·카드뉴스·영상 게시물을 같은 카드로 표시하고, 클릭하면 원본 게시물을 새 탭으로 연다
//   (상세 모달은 추후 작업에서 이 링크 동작을 대체)
import Image from "next/image";
import { SOCIAL_FEED_LABEL, type SocialPost } from "@/lib/social/types";

const MEDIA_LABEL: Record<SocialPost["mediaType"], string> = {
  image: "post",
  carousel: "post",
  video: "video",
};

/** Figma: 6 · SNS Content › Instagram/TikTok Post card. 288px wide, image 288×360 (4:5) radius 8. */
export function SocialPostCard({ post }: { post: SocialPost }) {
  const label = SOCIAL_FEED_LABEL[post.platform];
  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} ${MEDIA_LABEL[post.mediaType]}${post.title ? `: ${post.title}` : ""} (opens in a new tab)`}
      className="flex w-[240px] flex-col gap-3.5 rounded-mdk-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mdk-charcoal sm:w-[288px]"
    >
      <span className="relative flex aspect-[4/5] w-full items-start overflow-hidden rounded-mdk-sm bg-mdk-light-gray p-4">
        {/* Platform CDN URLs change and expire, so they bypass the Next.js optimizer. */}
        <Image src={post.thumbnailUrl} alt="" fill sizes="288px" unoptimized className="object-cover" />
        <span className="relative rounded-full bg-mdk-charcoal px-2.5 py-[5px] text-mdk-caption text-mdk-white">{label}</span>
      </span>
      <span className="truncate text-[15px] leading-[25px] tracking-[-0.002em] text-mdk-charcoal-muted">
        {post.title ? `${label} · ${post.title}` : label}
      </span>
    </a>
  );
}
