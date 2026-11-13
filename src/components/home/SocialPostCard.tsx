// Home On social 게시물 카드 1개.
// - 4:5 썸네일 + 플랫폼 태그 + "플랫폼 · 카드 문구" 캡션(Figma Social Post Card)
// - 클릭하면 해당 게시물의 SNS Post Modal을 연다(onOpen). 이미지·캐러셀·영상 게시물 모두 같은 카드
import Image from "next/image";
import { SOCIAL_FEED_LABEL, socialPostKind, type SocialPost } from "@/lib/social/types";

/** Figma: 6 · SNS Content › Instagram/TikTok Post card. 288px wide, image 288×360 (4:5) radius 8. */
export function SocialPostCard({ post, onOpen }: { post: SocialPost; onOpen: (post: SocialPost) => void }) {
  const label = SOCIAL_FEED_LABEL[post.platform];
  return (
    <button
      type="button"
      onClick={() => onOpen(post)}
      aria-haspopup="dialog"
      aria-label={`Open ${label} ${socialPostKind(post)}${post.cardLabel ? `: ${post.cardLabel}` : ""}`}
      className="flex w-[240px] cursor-pointer flex-col gap-3.5 rounded-mdk-sm text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mdk-charcoal sm:w-[288px]"
    >
      <span className="relative flex aspect-[4/5] w-full items-start overflow-hidden rounded-mdk-sm bg-mdk-light-gray p-4">
        {/* Platform CDN URLs change and expire, so they bypass the Next.js optimizer. */}
        <Image src={post.thumbnailUrl} alt="" fill sizes="288px" unoptimized className="object-cover" />
        <span className="relative rounded-full bg-mdk-charcoal px-2.5 py-[5px] text-mdk-caption text-mdk-white">{label}</span>
      </span>
      <span className="w-full truncate text-[15px] leading-[25px] tracking-[-0.002em] text-mdk-charcoal-muted">
        {post.cardLabel ? `${label} · ${post.cardLabel}` : label}
      </span>
    </button>
  );
}
