// Home 5 · Product Categories.
// - 헤더(제목·소개·예시 이미지 안내·View all)와 카테고리 7개 + Portfolio 전체 보기 타일 모자이크
// - 타일 클릭 → /portfolio?category=<slug>, 'View all'·마지막 타일 → /portfolio(All, 필터·첫 제품 행부터 표시)
// - 모바일 1열은 모든 타일 4:5(Facial care는 세로형 원본이라 소폭 확대), sm~lg 2열은 Facial care만 와이드
// - lg 이상 Figma 4열 모자이크(비율 유지) + 카테고리별 Figma 이미지 Fill 크롭·확대율 그대로
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/Button";
import { PortfolioProductsLink } from "@/components/portfolio/PortfolioProductsLink";
import { portfolioCategoryHref, type ProductCategorySlug } from "@/lib/config/product-categories";
import { cx } from "@/lib/utils/cx";
import { DISPLAY_TITLE, EYEBROW, SECTION_CONTAINER } from "@/components/home/styles";

type Tile = {
  slug: ProductCategorySlug;
  label: string;
  /** lg+: image box aspect from the 1440 frame (tile height − 44px label row). */
  aspect: string;
  wide: boolean;
  /** Below lg: object-position focus derived from the Figma crop. */
  position: string;
  /**
   * lg+: Figma image fill crop — image layer box as % of the image frame (left, top, width, height).
   * Omitted where Figma fills the frame without extra zoom (cover).
   */
  crop?: { l: number; t: number; w: number; h: number };
  /** Rendered image width at 1440 (for `sizes`). */
  lgWidth: number;
  /** Extra classes for the tile in the 2-column (sm–lg) grid. */
  smSpan?: string;
};

/** Figma: 5 · Product Categories (234:5359). Category images are illustrative (Figma note), not client products. */
const TILES: readonly Tile[] = [
  { slug: "facial-care", label: "Facial care", aspect: "lg:aspect-[588/556]", wide: true, position: "object-[68%_45%] max-sm:scale-[1.15] sm:object-[68%_40%]", smSpan: "sm:col-span-2", crop: { l: -10.58, t: -42.63, w: 115.56, h: 205.22 }, lgWidth: 680 },
  { slug: "cleansing", label: "Cleansing", aspect: "lg:aspect-[282/556]", wide: false, position: "object-bottom", lgWidth: 420 },
  { slug: "mask-pad", label: "Mask / Pad", aspect: "lg:aspect-[282/556]", wide: false, position: "object-[78%_63%]", crop: { l: -39.36, t: -8.63, w: 150.35, h: 113.67 }, lgWidth: 424 },
  { slug: "sun-care", label: "Sun care", aspect: "lg:aspect-[282/436]", wide: false, position: "object-bottom", lgWidth: 300 },
  { slug: "body-care", label: "Body care", aspect: "lg:aspect-[588/436]", wide: true, position: "object-[50%_36%]", crop: { l: -23.42, t: -17.43, w: 146.83, h: 147.94 }, lgWidth: 864 },
  { slug: "hair-care", label: "Hair care", aspect: "lg:aspect-[282/436]", wide: false, position: "object-[36%_19%]", crop: { l: -16.67, t: -12.82, w: 146.1, h: 169.17 }, lgWidth: 412 },
  { slug: "makeup", label: "Makeup", aspect: "lg:aspect-[588/396]", wide: true, position: "object-[50%_22%]", crop: { l: -8.19, t: -29.04, w: 116.38, h: 231.31 }, lgWidth: 684 },
];

export function ProductCategories() {
  return (
    <section className="bg-mdk-white py-20 lg:py-40">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-12 lg:gap-[72px]`}>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:gap-9">
          <div className="flex flex-col gap-6 min-w-0 lg:flex-1">
            <p className={EYEBROW}>Product Categories</p>
            <h2 className={cx(DISPLAY_TITLE, "text-mdk-charcoal max-w-[648px]")}>Your next bestseller starts here</h2>
          </div>
          <div className="flex flex-col items-start gap-5 lg:w-[min(500px,50%)] lg:shrink-0">
            <p className="text-mdk-body text-mdk-charcoal">
              Our network of specialist partners handles product development and manufacturing, while we manage your
              project from start to finish.
            </p>
            <p className="flex items-center gap-2 rounded-full bg-mdk-off-white py-2 pr-4 pl-3 text-[13px] leading-[18px] text-mdk-charcoal-muted">
              <Image src="/icons/circle-info.svg" alt="" width={16} height={16} />
              Images are for illustrative purposes only.
            </p>
            <PortfolioProductsLink className={cx(buttonClassName("secondary", "s"), "h-[46px] px-6")}>View all →</PortfolioProductsLink>
          </div>
        </div>

        <ul className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-12">
          {TILES.map((tile) => (
            <li key={tile.slug} className={cx(tile.smSpan, tile.wide && "lg:col-span-2")}>
              <Link
                href={portfolioCategoryHref(tile.slug)}
                className="group flex flex-col gap-3.5 rounded-mdk-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mdk-charcoal"
              >
                <div
                  className={cx(
                    "relative w-full overflow-hidden rounded-mdk-md",
                    // 1-column mobile: same 4:5 frame as the other tiles; the wide 16:10 frame only in the 2-column grid.
                    tile.smSpan ? "aspect-[4/5] sm:aspect-[16/10]" : "aspect-[4/5]",
                    tile.aspect,
                  )}
                >
                  {/* lg+: the image layer takes the Figma crop box; below lg it covers the frame. */}
                  <div
                    className={cx(
                      "absolute inset-0",
                      tile.crop && "lg:inset-auto lg:top-(--crop-t) lg:left-(--crop-l) lg:h-(--crop-h) lg:w-(--crop-w)",
                    )}
                    style={
                      tile.crop
                        ? ({
                            "--crop-l": `${tile.crop.l}%`,
                            "--crop-t": `${tile.crop.t}%`,
                            "--crop-w": `${tile.crop.w}%`,
                            "--crop-h": `${tile.crop.h}%`,
                          } as CSSProperties)
                        : undefined
                    }
                  >
                    <Image
                      src={`/images/categories/${tile.slug}.png`}
                      alt=""
                      fill
                      sizes={`(min-width: 1024px) ${tile.lgWidth}px, ${tile.smSpan ? "100vw" : "(min-width: 640px) 50vw, 100vw"}`}
                      className={cx("object-cover", tile.position, tile.crop && "lg:object-center")}
                    />
                  </div>
                </div>
                <span className="flex items-center justify-between text-[20px] leading-[26px] font-medium tracking-[-0.015em] text-mdk-charcoal">
                  {tile.label}
                  <span aria-hidden="true" className="leading-[30px]">
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
          <li className="sm:col-span-2">
            <PortfolioProductsLink
              className="flex h-full min-h-[320px] flex-col items-start justify-between gap-10 rounded-mdk-md bg-mdk-charcoal p-6 sm:p-8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mdk-charcoal lg:min-h-0 lg:p-12"
            >
              <span className={cx(DISPLAY_TITLE, "max-w-[420px] text-mdk-white")}>
                See work by
                <br />
                category
              </span>
              <span className={buttonClassName("primary-inverse")}>Discover our work →</span>
            </PortfolioProductsLink>
          </li>
        </ul>
      </div>
    </section>
  );
}
