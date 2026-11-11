"use client";

// SNS Post Modal — Instagram·TikTok 공용(Figma 'Overlay · Instagram/TikTok Post Modal — Final Design' 335:779 · 335:847).
// - 미디어 비율 기반 크기(2026-11-11 확정): 게시물 비율 = 첫 미디어의 가로/세로(9:16 ~ 16:9로 제한). 캐러셀은 이 값으로 고정해
//   슬라이드를 바꿔도 모달 크기가 그대로이고, 다른 비율의 슬라이드는 그 안에 비율 그대로(contain) 표시
// - 데스크톱(lg 이상): [미디어 | 정보 440px(lg 380px)] 한 덩어리를 화면 가운데에. 미디어 높이 = min(680px, 화면 높이 − 32px),
//   너비 = 높이 × 비율(화면 폭을 넘으면 폭에 맞춰 줄임). 예) 1:1 → 680 + 440 = 1120, 9:16 → 383 + 440 = 823.
//   패널 높이는 미디어 높이(가로형이 너무 낮으면 최소 420px, 미디어는 가운데). 정보 영역: 계정 + X → 구분선 → Caption · 날짜
//   (이 안에서만 얇은 스크롤바로 스크롤) → 'View on … ↗'(새 탭) — 별도 게시물 제목·해시태그 영역 없음
// - 중간·모바일(lg 미만): 위에서 아래로 계정 + X(맨 위 고정) → 미디어 → Caption → 날짜 → 원본 링크. 모달 전체가 하나의 스크롤
//   (얇은 스크롤바)이라 긴 Caption·링크까지 모두 접근 가능. 미디어는 회색 바깥 박스 없이 좌우 여백을 뺀 폭을 다 쓰고(비율 유지, 잘림 없음),
//   세로가 긴 미디어는 미디어를 줄이는 대신 모달 폭을 줄인다: 모달 폭 = (화면 높이 − 168px) × 비율을 560px · 화면 폭 − 32px 이하,
//   320px 이상으로 제한(2026-11-11). 예) 1:1·4:5·16:9는 대개 560px, 9:16은 화면 높이에 맞춘 좁은 모달
//   좌우 여백(2026-11-11): 스크롤바 자리 26px를 양쪽에 같게 확보(scrollbar-gutter: stable both-edges)해 미디어가 가운데에 오고,
//   오른쪽 thumb(6px)는 카드 끝·미디어와 각각 10px 간격. 모달 폭 계산에 이 52px를 더해 세로형 미디어 높이는 그대로
// - 데스크톱 Caption 스크롤바는 위·아래 구분선의 오른쪽 끝 안쪽에 정렬(스크롤 영역 = 구분선 폭, thumb는 오른쪽 끝).
//   thumb 양끝은 같은 3px 반원 캡슐(투명 border 두께를 명시하고 모서리별 반경으로 보정, 2026-11-11)
// - 닫기: X · 배경 클릭 · ESC(Modal). 닫으면 연 카드로 포커스 복귀, Home 스크롤 위치·주소 그대로, 영상 정지
import type { CSSProperties } from "react";
import { useId } from "react";
import { SocialMediaViewer } from "@/components/home/SocialMediaViewer";
import { CloseButton } from "@/components/ui/CloseButton";
import { Modal } from "@/components/ui/Modal";
import { SOCIAL_FEED_LABEL, formatSocialDate, socialPostRatio, type SocialPost } from "@/lib/social/types";
import { cx } from "@/lib/utils/cx";

/**
 * Thin scrollbar like Contact Message: 6px mid-gray thumb, 5px from the edge, transparent track.
 * Transparent borders set the gaps (5px on the edge side, 3px top/bottom; the other side 0). Each corner radius
 * adds its borders back (side 3 + 5 = 8px, vertical 3 + 3 = 6px) so both ends of the visible 6px thumb are the
 * same 3px semicircle.
 */
const THIN_SCROLLBAR = cx(
  "[&::-webkit-scrollbar]:w-[11px] [&::-webkit-scrollbar-track]:my-1 [&::-webkit-scrollbar-track]:bg-transparent",
  "[&::-webkit-scrollbar-thumb]:rounded-l-[3px_6px] [&::-webkit-scrollbar-thumb]:rounded-r-[8px_6px] [&::-webkit-scrollbar-thumb]:border-y-[3px] [&::-webkit-scrollbar-thumb]:border-r-[5px] [&::-webkit-scrollbar-thumb]:border-l-0 [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-mdk-mid-gray [&::-webkit-scrollbar-thumb]:bg-clip-padding",
  "supports-[-moz-appearance:none]:[scrollbar-width:thin] supports-[-moz-appearance:none]:[scrollbar-color:var(--color-mdk-mid-gray)_transparent]",
);

export function SocialPostModal({ post, onClose }: { post: SocialPost | null; onClose: () => void }) {
  const titleId = useId();
  return (
    <Modal open={post !== null} onClose={onClose} labelledBy={titleId} className="rounded-2xl">
      {post ? <PostPanel key={`${post.platform}-${post.id}`} post={post} titleId={titleId} onClose={onClose} /> : null}
    </Modal>
  );
}

function PostPanel({ post, titleId, onClose }: { post: SocialPost; titleId: string; onClose: () => void }) {
  const platform = SOCIAL_FEED_LABEL[post.platform];
  const date = formatSocialDate(post.publishedAt);
  const ratio = socialPostRatio(post);
  const darkMedia = post.media[0]?.type === "video";
  // --mh: media height budget; --mw (set per breakpoint below): media width = height × ratio, capped by the viewport.
  const style = { "--r": ratio, "--mh": "min(680px, calc(100dvh - 32px))" } as CSSProperties;

  return (
    <div
      style={style}
      className={cx(
        "flex max-h-[calc(100dvh-32px)] flex-col overflow-y-auto overscroll-contain rounded-2xl bg-mdk-white",
        // Below lg the media spans the modal width, so a tall post narrows the modal instead of leaving side bars.
        "max-lg:w-[clamp(min(320px,calc(100vw-32px)),calc((100dvh-168px)*var(--r)+52px),min(560px,calc(100vw-32px)))]",
        THIN_SCROLLBAR,
        // Below lg: a 26px gutter on both sides (stable both-edges) keeps the media centred; the 6px thumb sits in
        // the middle of the right one, 10px from the card edge and 10px from the media.
        "max-lg:[scrollbar-gutter:stable_both-edges] max-lg:[&::-webkit-scrollbar]:w-[26px] max-lg:[&::-webkit-scrollbar-track]:my-3",
        "max-lg:[&::-webkit-scrollbar-thumb]:border-l-[10px] max-lg:[&::-webkit-scrollbar-thumb]:border-r-[10px] max-lg:[&::-webkit-scrollbar-thumb]:rounded-l-[13px_6px] max-lg:[&::-webkit-scrollbar-thumb]:rounded-r-[13px_6px]",
        "lg:grid lg:overflow-hidden lg:grid-rows-[auto_minmax(0,1fr)_auto]",
        "lg:[--mw:min(calc(var(--mh)*var(--r)),calc(100vw-32px-380px))] lg:grid-cols-[var(--mw)_380px]",
        "xl:[--mw:min(calc(var(--mh)*var(--r)),calc(100vw-32px-440px))] xl:grid-cols-[var(--mw)_440px]",
        "lg:h-[max(calc(var(--mw)/var(--r)),min(420px,var(--mh)))]",
      )}
    >
      {/* Account + X: top of the modal on mobile (stays visible while it scrolls); top of the info panel on desktop. */}
      <div className="sticky top-0 z-20 shrink-0 bg-mdk-white pt-3 pb-3 sm:px-1.5 lg:static lg:px-8 lg:col-start-2 lg:row-start-1 lg:pt-7 lg:pb-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {post.account.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- platform CDN avatar, not optimizable
              <img src={post.account.avatarUrl} alt="" width={28} height={28} className="size-7 shrink-0 rounded-full object-cover" />
            ) : (
              <span aria-hidden="true" className="size-7 shrink-0 rounded-full bg-mdk-light-gray" />
            )}
            <h2 id={titleId} className="truncate text-mdk-label text-mdk-charcoal">
              {platform} · {post.account.handle}
            </h2>
          </div>
          <CloseButton onClick={onClose} label="Close post" variant="bordered" />
        </div>
        <div className="mt-5 hidden h-px bg-mdk-light-gray lg:block" />
      </div>

      <div
        className={cx(
          "flex shrink-0 justify-center lg:col-start-1 lg:row-span-3 lg:row-start-1 lg:h-full lg:items-center",
          // Desktop only: fills the rest of the column when a landscape post is shorter than the 420px minimum.
          darkMedia ? "lg:bg-mdk-charcoal" : "lg:bg-mdk-light-gray",
        )}
      >
        <SocialMediaViewer
          media={post.media}
          className="w-full [aspect-ratio:var(--r)] lg:max-h-full"
        />
      </div>

      <div
        className={cx(
          "flex flex-col gap-[13px] pt-4 sm:px-1.5 lg:col-start-2 lg:row-start-2 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pt-5 lg:pb-5",
          THIN_SCROLLBAR,
          // Desktop: the scroll area spans the dividers (32px in from both panel edges) and the thumb sits at its right end.
          "lg:mx-8 lg:pr-3 lg:pl-0 lg:[&::-webkit-scrollbar-thumb]:border-r-0 lg:[&::-webkit-scrollbar-thumb]:border-l-[5px]",
          // Border moves to the left: mirror the cap radii.
          "lg:[&::-webkit-scrollbar-thumb]:rounded-l-[8px_6px] lg:[&::-webkit-scrollbar-thumb]:rounded-r-[3px_6px]",
        )}
      >
        <p className="text-mdk-body whitespace-pre-line text-mdk-charcoal-muted [overflow-wrap:anywhere]">{post.caption}</p>
        {date ? (
          <time dateTime={post.publishedAt} className="text-mdk-caption text-mdk-charcoal-muted">
            {date}
          </time>
        ) : null}
      </div>

      <div className="shrink-0 pt-5 pb-5 sm:px-1.5 lg:col-start-2 lg:px-8 lg:row-start-3 lg:pt-0 lg:pb-8">
        <div className="border-t border-mdk-light-gray pt-5">
          <a
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-mdk-label text-mdk-charcoal underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-charcoal"
          >
            View on {platform} ↗<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
    </div>
  );
}
