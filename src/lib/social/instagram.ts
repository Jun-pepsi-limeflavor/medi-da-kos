// Home On social의 Instagram 게시물 서버 조회(Meta Graph API, Unified Login 시스템 사용자 토큰).
// - 서버 전용: 토큰은 INSTAGRAM_ACCESS_TOKEN(서버 환경변수)에서만 읽고, 브라우저에는 변환된 SocialPost만 넘어간다
// - 환경별 값은 Next.js·Vercel 기본 방식 그대로(로컬 .env.local, Vercel staging/Production). 환경 분기 없음
// - 토큰·계정 ID가 없거나 API·네트워크 오류면 빈 목록 → SocialSection의 기존 빈 상태 화면
// - 15분 캐시(fetch revalidate 900초, 2026-11-16 1시간에서 단축). Instagram CDN 미디어 주소는 바뀌거나 만료될 수 있어 길게 두지 않는다
// - 계정 프로필 사진(profile_picture_url)도 같은 주기로 조회해 모달 상단에 쓴다. 실패해도 게시물은 그대로 표시
// - API는 미디어 크기를 주지 않아 비율은 기본값(이미지 4:5, 단독 영상 9:16). 모달은 비율 그대로(contain) 표시해 잘리지 않는다
import "server-only";
import type { SocialMedia, SocialPost } from "@/lib/social/types";

const GRAPH_API = "https://graph.facebook.com/v27.0";
export const INSTAGRAM_FEED_LIMIT = 12;
export const INSTAGRAM_REVALIDATE_SECONDS = 900;
const FIELDS =
  "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username,children{id,media_type,media_url,thumbnail_url}";

const IMAGE_SIZE = { width: 1080, height: 1350 } as const;
const VIDEO_SIZE = { width: 1080, height: 1920 } as const;

type InstagramMediaType = "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";

export type InstagramChild = {
  id?: string;
  media_type?: InstagramMediaType;
  media_url?: string;
  thumbnail_url?: string;
};

export type InstagramMediaItem = InstagramChild & {
  id: string;
  caption?: string;
  permalink?: string;
  timestamp?: string;
  username?: string;
  children?: { data?: InstagramChild[] };
};

/** Graph API timestamps look like 2026-10-22T09:37:05+0000; returns ISO 8601 or "" when unreadable. */
function toIsoDate(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/** One displayable media item. A video without a playable URL (e.g. licensed audio) falls back to its thumbnail. */
function toMedia(item: InstagramChild, standalone: boolean, alt: string): SocialMedia | null {
  if (item.media_type === "VIDEO") {
    const size = standalone ? VIDEO_SIZE : IMAGE_SIZE;
    if (item.media_url) return { type: "video", src: item.media_url, poster: item.thumbnail_url, alt, ...size };
    return item.thumbnail_url ? { type: "image", src: item.thumbnail_url, alt, ...size } : null;
  }
  return item.media_url ? { type: "image", src: item.media_url, alt, ...IMAGE_SIZE } : null;
}

/** Converts one Graph API media object; null when it has nothing to show or no public link. */
export function toSocialPost(item: InstagramMediaItem): SocialPost | null {
  if (!item.id || !item.permalink) return null;

  let media: SocialMedia[];
  if (item.media_type === "CAROUSEL_ALBUM" && item.children?.data?.length) {
    const children = item.children.data;
    media = children
      .map((child, i) => toMedia(child, false, `Instagram post image ${i + 1} of ${children.length}`))
      .filter((m): m is SocialMedia => m !== null);
  } else {
    const single = toMedia(item, true, "Instagram post image");
    media = single ? [single] : [];
  }
  if (media.length === 0) return null;

  const first = media[0];
  const thumbnailUrl = first.type === "video" ? first.poster : first.src;
  if (!thumbnailUrl) return null;

  const caption = item.caption ?? "";
  const cardLabel = caption
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  // Profile link only for a well-formed Instagram username (letters, digits, "." and "_", up to 30).
  const username = item.username && /^[A-Za-z0-9._]{1,30}$/.test(item.username) ? item.username : undefined;

  return {
    id: item.id,
    platform: "instagram",
    account: username
      ? { handle: `@${username}`, profileUrl: `https://www.instagram.com/${username}/` }
      : { handle: "Instagram" },
    caption,
    publishedAt: toIsoDate(item.timestamp),
    permalink: item.permalink,
    thumbnailUrl,
    media,
    ...(cardLabel ? { cardLabel } : {}),
  };
}

/** Graph API `/media` response → posts in API order (newest first), at most `limit`. `avatarUrl`: account profile picture. */
export function toSocialPosts(response: unknown, limit = INSTAGRAM_FEED_LIMIT, avatarUrl?: string): SocialPost[] {
  const data = (response as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => toSocialPost(item as InstagramMediaItem))
    .filter((post): post is SocialPost => post !== null)
    .slice(0, limit)
    .map((post) => (avatarUrl ? { ...post, account: { ...post.account, avatarUrl } } : post));
}

/** Profile picture of the account (IG User `profile_picture_url`), or undefined — the modal then keeps its gray circle. */
async function getProfilePictureUrl(userId: string, headers: HeadersInit): Promise<string | undefined> {
  try {
    const res = await fetch(`${GRAPH_API}/${encodeURIComponent(userId)}?fields=profile_picture_url`, {
      headers,
      next: { revalidate: INSTAGRAM_REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      console.error(`[instagram] profile request failed: HTTP ${res.status}`);
      return undefined;
    }
    const url = ((await res.json()) as { profile_picture_url?: unknown }).profile_picture_url;
    return typeof url === "string" && url.startsWith("https://") ? url : undefined;
  } catch (error) {
    console.error(`[instagram] profile request failed: ${error instanceof Error ? error.name : "unknown error"}`);
    return undefined;
  }
}

/** Latest posts of the configured account, or [] when not configured or the request fails. Never throws. */
export async function getInstagramPosts(limit = INSTAGRAM_FEED_LIMIT): Promise<SocialPost[]> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const userId = process.env.INSTAGRAM_USER_ID?.trim();
  if (!token || !userId) return [];

  const url = `${GRAPH_API}/${encodeURIComponent(userId)}/media?${new URLSearchParams({ fields: FIELDS, limit: String(limit) })}`;
  const headers = { Authorization: `Bearer ${token}` };
  try {
    const [res, avatarUrl] = await Promise.all([
      fetch(url, { headers, next: { revalidate: INSTAGRAM_REVALIDATE_SECONDS } }),
      getProfilePictureUrl(userId, headers),
    ]);
    if (!res.ok) {
      // Log the status and Graph error code only — never the token or the request URL with headers.
      const error = ((await res.json().catch(() => null)) as { error?: { code?: number; type?: string } } | null)?.error;
      console.error(`[instagram] feed request failed: HTTP ${res.status} code=${error?.code ?? "-"} type=${error?.type ?? "-"}`);
      return [];
    }
    return toSocialPosts(await res.json(), limit, avatarUrl);
  } catch (error) {
    console.error(`[instagram] feed request failed: ${error instanceof Error ? error.name : "unknown error"}`);
    return [];
  }
}
