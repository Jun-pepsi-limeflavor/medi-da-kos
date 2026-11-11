// Home On social 게시물의 공통 데이터 형식(카드 + SNS Post Modal).
// - 플랫폼과 미디어 유형을 분리: Instagram·TikTok 모두 이미지·영상·혼합 캐러셀을 가질 수 있고, 표시 방식은 각 미디어의 type으로 정한다
// - 실제 게시물은 추후 Instagram·TikTok 연동(서버)에서 이 형식으로 변환해 SocialSection에 넘긴다. 개발용 테스트 게시물은 test-posts.ts
// - 모달은 계정·Caption(해시태그·멘션·줄바꿈 그대로)·게시 날짜·원본 링크만 표시 — 별도 제목(Post title)은 없다
// - 모달 미디어 영역 비율은 socialPostRatio(첫 미디어 비율, 9:16~16:9)
import type { SocialPlatform as SiteSocialPlatform } from "@/lib/config/site";

/** Platforms shown in the Home "On social" tabs. */
export type SocialFeedPlatform = Extract<SiteSocialPlatform, "instagram" | "tiktok">;

export type SocialImage = { type: "image"; src: string; alt: string; width: number; height: number };
export type SocialVideo = { type: "video"; src: string; poster?: string; width: number; height: number; alt?: string };
export type SocialMedia = SocialImage | SocialVideo;

export type SocialAccount = { handle: string; avatarUrl?: string };

export type SocialPost = {
  /** Platform post ID (unique per platform). Cards and the modal are keyed by platform + id. */
  id: string;
  platform: SocialFeedPlatform;
  account: SocialAccount;
  /** Post caption as published (hashtags, mentions and line breaks kept). */
  caption: string;
  /** ISO 8601 publish time, newest first. */
  publishedAt: string;
  /** Public post URL on the platform ("View on …"). */
  permalink: string;
  /** Card cover: the photo, the first card, or the video thumbnail. */
  thumbnailUrl: string;
  /** One or more media items in display order (single photo, carousel, video, or mixed). */
  media: readonly SocialMedia[];
  /** Short line under the card only (e.g. first line of the caption). Not shown in the modal. */
  cardLabel?: string;
  /** Development fixture, never a real Medidakos post. */
  isTestContent?: boolean;
};

export const SOCIAL_FEED_PLATFORMS: readonly SocialFeedPlatform[] = ["instagram", "tiktok"];

export const SOCIAL_FEED_LABEL: Record<SocialFeedPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
};

export function socialPostKey(post: Pick<SocialPost, "platform" | "id">): string {
  return `${post.platform}-${post.id}`;
}

/** "video" when any media item is a video, otherwise "post" — for card labels. */
export function socialPostKind(post: Pick<SocialPost, "media">): "video" | "post" {
  return post.media.some((item) => item.type === "video") ? "video" : "post";
}

/** Media aspect ratios the modal frame accepts (9:16 portrait to 16:9 landscape). */
export const SOCIAL_RATIO_RANGE = { min: 9 / 16, max: 16 / 9 } as const;

/**
 * Width / height of the post's media frame: the first item's ratio, clamped to 9:16–16:9. One value per post, so a
 * carousel keeps its size while slides change; other slides fit inside it without cropping.
 */
export function socialPostRatio(post: Pick<SocialPost, "media">): number {
  const first = post.media[0];
  if (!first || first.width <= 0 || first.height <= 0) return 1;
  return Math.min(SOCIAL_RATIO_RANGE.max, Math.max(SOCIAL_RATIO_RANGE.min, first.width / first.height));
}

/** Publish date as shown in the modal, e.g. "November 3, 2026" (UTC, so server and client agree). */
export function formatSocialDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}
