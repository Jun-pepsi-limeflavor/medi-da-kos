// Portfolio 카테고리·제품 정적 데이터와 필터 계산.
// - 필터 칩 8개(All + 7개 카테고리, Figma 순서·표기). slug는 Home 카테고리 타일과 같다(product-categories.ts)
// - PORTFOLIO_PRODUCTS: 카테고리별 확정 제품만 등록. 현재 확정 데이터는 Facial care 15개(Figma 'Portfolio — Facial care')
//   다른 카테고리는 빈 배열 — 제품을 배열에 추가하면 해당 카테고리와 All에 자동 표시된다(UI 수정 불필요)
// - All = 카테고리 순서대로 이어 붙인 목록(같은 id는 한 번만)
import { PRODUCT_CATEGORY_SLUGS, type ProductCategorySlug } from "@/lib/config/product-categories";

export type PortfolioCategory = ProductCategorySlug | "all";

/**
 * One product card.
 * - `id`: stable, unique across all categories (kebab-case of the product name).
 * - `image`: file under /public, square frame (1:1).
 * - `crop`: optional Figma image-fill crop — image box as % of the square frame (left, top, width, height).
 *   Omit it when the image simply fills the frame (object-fit: cover).
 * - `tags`: key ingredient / benefit tags shown under the name, without the leading "#".
 */
export type PortfolioProduct = {
  id: string;
  name: string;
  image: string;
  crop?: { l: number; t: number; w: number; h: number };
  tags: readonly string[];
};

/** Figma: Category Filter (All + 7) chip labels, in order. `cardLabel` is the category line on each product card. */
export const PORTFOLIO_FILTERS: readonly { slug: PortfolioCategory; label: string; cardLabel: string }[] = [
  { slug: "all", label: "All", cardLabel: "" },
  { slug: "facial-care", label: "Facial Care", cardLabel: "Facial care" },
  { slug: "cleansing", label: "Cleansing", cardLabel: "Cleansing" },
  { slug: "mask-pad", label: "Mask / Pad", cardLabel: "Mask / Pad" },
  { slug: "sun-care", label: "Sun Care", cardLabel: "Sun care" },
  { slug: "makeup", label: "Makeup", cardLabel: "Makeup" },
  { slug: "body-care", label: "Body Care", cardLabel: "Body care" },
  { slug: "hair-care", label: "Hair Care", cardLabel: "Hair care" },
];

const FACIAL_CARE = "/images/portfolio/facial-care";

/** Confirmed products per category, in display order. Add products here (and their images under /public/images/portfolio/<slug>/). */
export const PORTFOLIO_PRODUCTS: Record<ProductCategorySlug, readonly PortfolioProduct[]> = {
  /** Figma: Portfolio — Facial care (772:3270) › Product Grid, rows 1–5. */
  "facial-care": [
    { id: "ghk-cu-copper-peptide-serum", name: "GHK- Cu Copper Peptide Serum", image: `${FACIAL_CARE}/ghk-cu-copper-peptide-serum.jpg`, crop: { l: -8.85, t: -9.11, w: 117.97, h: 117.97 }, tags: ["CopperPeptide", "SkinElasticity", "Anti-Aging"] },
    { id: "pdrn-radiance-serum", name: "PDRN Radiance Serum", image: `${FACIAL_CARE}/pdrn-radiance-serum.jpg`, crop: { l: -1.37, t: -11.2, w: 101.44, h: 134.64 }, tags: ["PDRN", "ElasticityCare", "RadiantSkinGlow"] },
    { id: "7-peptide-skin-moisturiser", name: "7-Peptide Skin Moisturiser", image: `${FACIAL_CARE}/7-peptide-skin-moisturiser.jpg`, crop: { l: -41.15, t: -43.19, w: 182.55, h: 182.55 }, tags: ["PeptideComplex", "ElasticityCare", "BarrierRepair"] },
    { id: "liposomal-retinol-eye-cream", name: "Liposomal Retinol Eye Cream", image: `${FACIAL_CARE}/liposomal-retinol-eye-cream.jpg`, crop: { l: -11.2, t: -16.67, w: 143.23, h: 143.23 }, tags: ["Retinol", "FineLineCare", "SkinRenewal"] },
    { id: "retinal-facial-cream", name: "Retinal Facial Cream", image: `${FACIAL_CARE}/retinal-facial-cream.jpg`, crop: { l: -3.91, t: -2.86, w: 107.81, h: 107.81 }, tags: ["Retinal", "WrinkleCare", "FirmingCare"] },
    { id: "vitamin-c-brightening-serum", name: "Vitamin C Brightening Serum", image: `${FACIAL_CARE}/vitamin-c-brightening-serum.jpg`, crop: { l: -1.04, t: 0, w: 101.04, h: 101.04 }, tags: ["VitaminC", "BrighteningCare", "DarkSpotCare"] },
    { id: "tranexamic-acid-cream", name: "TRANEXAMIC ACID CREAM", image: `${FACIAL_CARE}/tranexamic-acid-cream.jpg`, crop: { l: -8.33, t: -8.85, w: 116.93, h: 116.93 }, tags: ["TranexamicAcid", "Brightening", "EvenSkinTone"] },
    { id: "hyaluronic-acid-serum", name: "Hyaluronic Acid Serum", image: `${FACIAL_CARE}/hyaluronic-acid-serum.jpg`, crop: { l: -4.95, t: -6.51, w: 110.16, h: 110.16 }, tags: ["HyaluronicAcid", "DeepHydration", "MoistureBoost"] },
    { id: "barrier-calming-serum", name: "Barrier Calming Serum", image: `${FACIAL_CARE}/barrier-calming-serum.jpg`, crop: { l: -2.86, t: -2.86, w: 105.73, h: 105.73 }, tags: ["CentellaAsiatica", "Soothing", "BarrierCare"] },
    { id: "brightening-complex-serum", name: "Brightening Complex Serum", image: `${FACIAL_CARE}/brightening-complex-serum.jpg`, crop: { l: -16.67, t: -19.01, w: 127.86, h: 127.86 }, tags: ["Niacinamide", "DarkSpotCare", "BoostRadiance"] },
    { id: "aha-bha-complex-toner", name: "AHA BHA Complex Toner", image: `${FACIAL_CARE}/aha-bha-complex-toner.jpg`, tags: ["Exfoliation", "PoreCare", "SkinSmoothing"] },
    { id: "pdrn-boost-toner", name: "PDRN Boost Toner", image: `${FACIAL_CARE}/pdrn-boost-toner.jpg`, tags: ["PDRN", "Hydration", "BoostRadiance"] },
    { id: "rice-ceramide-toner", name: "Rice Ceramide Toner", image: `${FACIAL_CARE}/rice-ceramide-toner.jpg`, crop: { l: -7.55, t: -7.55, w: 115.1, h: 115.1 }, tags: ["RiceExtract", "Brightening", "Hydration"] },
    { id: "vibrating-eye-lifter-cream", name: "Vibrating Eye Lifter Cream", image: `${FACIAL_CARE}/vibrating-eye-lifter-cream.jpg`, crop: { l: -5.24, t: -0.5, w: 112.24, h: 112.24 }, tags: ["Caffeine", "DarkCircleCare", "Depuffing"] },
    { id: "rice-moisture-multi-balm-stick", name: "Rice Moisture Multi Balm Stick", image: `${FACIAL_CARE}/rice-moisture-multi-balm-stick.jpg`, crop: { l: -13.8, t: -8.85, w: 127.86, h: 127.86 }, tags: ["RiceExtract", "DeepHydration", "Multi-use"] },
  ],
  // Not confirmed yet — add confirmed products before launch (Figma example cards are placeholders, not data).
  cleansing: [],
  "mask-pad": [],
  "sun-care": [],
  makeup: [],
  "body-care": [],
  "hair-care": [],
};

/** A product with the category it is listed under (for the card's category line). */
export type PortfolioListItem = PortfolioProduct & { category: ProductCategorySlug };

/** `?category=` value → filter. Unknown or missing values fall back to All. */
export function parsePortfolioCategory(value: string | null): PortfolioCategory {
  return PRODUCT_CATEGORY_SLUGS.find((slug) => slug === value) ?? "all";
}

/** Products for a filter. All lists every category in filter order and skips repeated ids. */
export function portfolioProducts(category: PortfolioCategory): PortfolioListItem[] {
  const slugs = category === "all" ? PRODUCT_CATEGORY_SLUGS : [category];
  const seen = new Set<string>();
  return slugs.flatMap((slug) =>
    PORTFOLIO_PRODUCTS[slug]
      .filter((product) => !seen.has(product.id) && seen.add(product.id))
      .map((product) => ({ ...product, category: slug })),
  );
}
