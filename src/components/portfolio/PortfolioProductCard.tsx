// Portfolio 제품 카드(Figma Product Card 273:373).
// - 1:1 이미지(모서리 12, 회색 바탕) + 카테고리 · 제품명 · 원료 태그. 클릭·Hover 동작 없음(Figma 10/28 결정)
// - 이미지는 Figma 크롭(crop)이 있으면 그 박스 안에서 cover, 없으면 프레임을 그대로 채운다
import Image from "next/image";
import type { Ref } from "react";
import { PORTFOLIO_FILTERS, type PortfolioListItem } from "@/components/portfolio/products";

/** Rendered frame width: 384px at 1440 (3 columns), half / full width below lg. */
function imageSizes(scale: number) {
  const s = (n: number) => Math.round(n * scale);
  return `(min-width: 1440px) ${s(384)}px, (min-width: 1024px) ${s(31)}vw, (min-width: 640px) ${s(50)}vw, ${s(100)}vw`;
}

/** `eager`: first row (above the fold) loads immediately instead of lazily — it is the page's LCP image. */
export function PortfolioProductCard({
  product,
  eager = false,
  ref,
}: {
  product: PortfolioListItem;
  eager?: boolean;
  ref?: Ref<HTMLLIElement>;
}) {
  const { crop } = product;
  const categoryLabel = PORTFOLIO_FILTERS.find((filter) => filter.slug === product.category)?.cardLabel;

  return (
    <li
      ref={ref}
      tabIndex={-1}
      className="flex flex-col gap-5 rounded-mdk-md outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mdk-charcoal"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-mdk-md bg-mdk-light-gray">
        <div
          className="absolute"
          style={
            crop
              ? { left: `${crop.l}%`, top: `${crop.t}%`, width: `${crop.w}%`, height: `${crop.h}%` }
              : { inset: 0 }
          }
        >
          <Image
            src={product.image}
            alt={product.name}
            fill
            loading={eager ? "eager" : "lazy"}
            sizes={imageSizes((crop?.w ?? 100) / 100)}
            className="object-cover"
          />
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <p className="text-[14px] leading-5 font-medium tracking-[-0.003em] text-mdk-charcoal-muted">{categoryLabel}</p>
        <h3 className="text-[22px] leading-7 font-semibold tracking-[-0.015em] text-mdk-charcoal lg:text-[24px] lg:leading-[30px]">
          {product.name}
        </h3>
        <p className="flex flex-wrap gap-x-2 text-[15px] leading-[22px] tracking-[-0.002em] text-mdk-charcoal">
          {product.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </p>
      </div>
    </li>
  );
}
