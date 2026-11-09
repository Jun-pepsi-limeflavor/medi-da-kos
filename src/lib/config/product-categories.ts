// 제품 카테고리 7개와 Portfolio 필터 링크.
// - Home Product Categories 타일과 Portfolio 필터 칩이 같은 slug를 쓴다(Figma 주석: 1:1 대응)
import { ROUTES } from "@/lib/config/routes";

export const PRODUCT_CATEGORY_SLUGS = [
  "facial-care",
  "cleansing",
  "mask-pad",
  "sun-care",
  "makeup",
  "body-care",
  "hair-care",
] as const;

export type ProductCategorySlug = (typeof PRODUCT_CATEGORY_SLUGS)[number];

/** /portfolio?category=<slug> — the Portfolio page selects the matching filter chip on entry. */
export function portfolioCategoryHref(slug: ProductCategorySlug): string {
  return `${ROUTES.portfolio}?category=${slug}`;
}
