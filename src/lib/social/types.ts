// Home On social 게시물의 공통 데이터 형식.
// - Instagram(이미지·카드뉴스)과 TikTok(영상) 응답을 서버에서 이 형식으로 변환해 SocialSection에 넘긴다
import type { SocialPlatform as SiteSocialPlatform } from "@/lib/config/site";

/** Platforms shown in the Home "On social" tabs. */
export type SocialFeedPlatform = Extract<SiteSocialPlatform, "instagram" | "tiktok">;

/** image = single photo, carousel = card news (multiple images), video = Reels / TikTok video. */
export type SocialMediaType = "image" | "carousel" | "video";

export type SocialPost = {
  /** Platform post ID (unique per platform). */
  id: string;
  platform: SocialFeedPlatform;
  mediaType: SocialMediaType;
  /** Cover image: the photo, the first card, or the video thumbnail. Served from the platform CDN or our cache. */
  thumbnailUrl: string;
  /** Public post URL on the platform. */
  permalink: string;
  /** Short title shown under the card (e.g. first line of the caption). */
  title?: string;
  /** ISO 8601 publish time, newest first. */
  publishedAt?: string;
};

export const SOCIAL_FEED_PLATFORMS: readonly SocialFeedPlatform[] = ["instagram", "tiktok"];

export const SOCIAL_FEED_LABEL: Record<SocialFeedPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
};
