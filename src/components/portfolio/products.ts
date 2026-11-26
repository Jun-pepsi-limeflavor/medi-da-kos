// Portfolio 카테고리·제품 정적 데이터와 필터 계산.
// - 필터 칩 8개(All + 7개 카테고리, Figma 순서·표기). slug는 Home 카테고리 타일과 같다(product-categories.ts)
// - PORTFOLIO_PRODUCTS: 카테고리별 확정 제품만 등록. 현재 확정 데이터는 Facial care 15개(Figma 'Portfolio — Facial care'),
//   Cleansing 3개(Figma 'Portfolio — Cleansing' 첫 줄), Hair care 9개(Figma 'Portfolio — Hair Care')
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
 * - `keyIngredients`: shown under the name as "Key ingredients: A, B" (Figma Product Card · Key Ingredients).
 * - `tags`: benefit hashtags shown last, without the leading "#" (Figma Product Card · Short Description).
 */
export type PortfolioProduct = {
  id: string;
  name: string;
  image: string;
  crop?: { l: number; t: number; w: number; h: number };
  keyIngredients: readonly string[];
  tags: readonly string[];
};

/**
 * Figma: Category Filter (All + 7) chip labels, in order. `cardLabel` is the category line on each product card.
 * Both use the same Title Case names as the Home category tiles (2026-11-26 decision); slugs stay as they are.
 */
export const PORTFOLIO_FILTERS: readonly { slug: PortfolioCategory; label: string; cardLabel: string }[] = [
  { slug: "all", label: "All", cardLabel: "" },
  { slug: "facial-care", label: "Facial Care", cardLabel: "Facial Care" },
  { slug: "cleansing", label: "Cleansing", cardLabel: "Cleansing" },
  { slug: "mask-pad", label: "Mask / Pad", cardLabel: "Mask / Pad" },
  { slug: "sun-care", label: "Sun Care", cardLabel: "Sun Care" },
  { slug: "makeup", label: "Makeup", cardLabel: "Makeup" },
  { slug: "body-care", label: "Body Care", cardLabel: "Body Care" },
  { slug: "hair-care", label: "Hair Care", cardLabel: "Hair Care" },
];

const FACIAL_CARE = "/images/portfolio/facial-care";
const CLEANSING = "/images/portfolio/cleansing";
const HAIR_CARE = "/images/portfolio/hair-care";

/** Confirmed products per category, in display order. Add products here (and their images under /public/images/portfolio/<slug>/). */
export const PORTFOLIO_PRODUCTS: Record<ProductCategorySlug, readonly PortfolioProduct[]> = {
  /** Figma: Portfolio — Facial care (772:3270) › Product Grid, rows 1–5. */
  "facial-care": [
    { id: "ghk-cu-copper-peptide-serum", name: "GHK- Cu Copper Peptide Serum", image: `${FACIAL_CARE}/ghk-cu-copper-peptide-serum.jpg`, crop: { l: -8.85, t: -9.11, w: 117.97, h: 117.97 }, keyIngredients: ["Copper Tripeptide-1", "Niacinamide"], tags: ["Firming", "WrinkleCare", "DeepHydration"] },
    { id: "pdrn-radiance-serum", name: "PDRN Radiance Serum", image: `${FACIAL_CARE}/pdrn-radiance-serum.jpg`, crop: { l: -1.37, t: -11.2, w: 101.44, h: 134.64 }, keyIngredients: ["PDRN", "Ceramides", "Niacinamide"], tags: ["SkinRecovery", "BarrierCare", "RadiantGlow"] },
    { id: "7-peptide-skin-moisturiser", name: "7-Peptide Skin Moisturiser", image: `${FACIAL_CARE}/7-peptide-skin-moisturiser.jpg`, keyIngredients: ["Peptide Complex", "Hyaluronic Acid"], tags: ["Firming", "BarrierRepair", "DeepHydration"] },
    { id: "liposomal-retinol-eye-cream", name: "Liposomal Retinol Eye Cream", image: `${FACIAL_CARE}/liposomal-retinol-eye-cream.jpg`, crop: { l: -11.2, t: -16.67, w: 143.23, h: 143.23 }, keyIngredients: ["Retinol", "Niacinamide", "Adenosine"], tags: ["FineLineCare", "SkinRenewal", "EyeFirming"] },
    { id: "retinal-facial-cream", name: "Retinal Facial Cream", image: `${FACIAL_CARE}/retinal-facial-cream.jpg`, crop: { l: -3.91, t: -2.86, w: 107.81, h: 107.81 }, keyIngredients: ["Retinal", "Tranexamic Acid", "Adenosine"], tags: ["WrinkleCare", "Firming", "EvenSkinTone"] },
    { id: "vitamin-c-brightening-serum", name: "Vitamin C Brightening Serum", image: `${FACIAL_CARE}/vitamin-c-brightening-serum.jpg`, crop: { l: -1.04, t: 0, w: 101.04, h: 101.04 }, keyIngredients: ["Niacinamide", "Vitamin C"], tags: ["Brightening", "RadiantGlow", "Antioxidant"] },
    { id: "tranexamic-acid-cream", name: "TRANEXAMIC ACID CREAM", image: `${FACIAL_CARE}/tranexamic-acid-cream.jpg`, crop: { l: -8.33, t: -8.85, w: 116.93, h: 116.93 }, keyIngredients: ["Tranexamic Acid"], tags: ["Brightening", "DarkSpotCare", "EvenSkinTone"] },
    { id: "hyaluronic-acid-serum", name: "Hyaluronic Acid Serum", image: `${FACIAL_CARE}/hyaluronic-acid-serum.jpg`, crop: { l: -4.95, t: -6.51, w: 110.16, h: 110.16 }, keyIngredients: ["Hyaluronic Acid"], tags: ["DeepHydration", "MoistureBoost", "Plumping"] },
    { id: "barrier-calming-serum", name: "Barrier Calming Serum", image: `${FACIAL_CARE}/barrier-calming-serum.jpg`, crop: { l: -2.86, t: -2.86, w: 105.73, h: 105.73 }, keyIngredients: ["Centella Asiatica", "Panthenol"], tags: ["Soothing", "BarrierCare", "RednessRelief"] },
    { id: "brightening-complex-serum", name: "Brightening Complex Serum", image: `${FACIAL_CARE}/brightening-complex-serum.jpg`, crop: { l: -16.67, t: -19.01, w: 127.86, h: 127.86 }, keyIngredients: ["Niacinamide", "Arbutin", "Rucinol"], tags: ["DarkSpotCare", "EvenSkinTone", "BoostRadiance"] },
    { id: "aha-bha-complex-toner", name: "AHA BHA Complex Toner", image: `${FACIAL_CARE}/aha-bha-complex-toner.jpg`, keyIngredients: ["Glycolic Acid", "Lactic Acid", "Salicylic Acid"], tags: ["Exfoliation", "PoreCare", "SkinSmoothing"] },
    { id: "pdrn-boost-toner", name: "PDRN Boost Toner", image: `${FACIAL_CARE}/pdrn-boost-toner.jpg`, keyIngredients: ["PDRN", "Hyaluronic Acid"], tags: ["Hydration", "SkinRecovery", "BoostRadiance"] },
    { id: "rice-ceramide-toner", name: "Rice Ceramide Toner", image: `${FACIAL_CARE}/rice-ceramide-toner.jpg`, crop: { l: -7.55, t: -7.55, w: 115.1, h: 115.1 }, keyIngredients: ["Rice Extract", "Ceramides", "Niacinamide"], tags: ["Brightening", "Hydration", "BarrierCare"] },
    { id: "vibrating-eye-lifter-cream", name: "Vibrating Eye Lifter Cream", image: `${FACIAL_CARE}/vibrating-eye-lifter-cream.jpg`, crop: { l: -5.24, t: -0.5, w: 112.24, h: 112.24 }, keyIngredients: ["Caffeine", "Menadione"], tags: ["DarkCircleCare", "Depuffing", "EyeLifting"] },
    { id: "rice-moisture-multi-balm-stick", name: "Rice Moisture Multi Balm Stick", image: `${FACIAL_CARE}/rice-moisture-multi-balm-stick.jpg`, crop: { l: -13.8, t: -8.85, w: 127.86, h: 127.86 }, keyIngredients: ["Rice Bran Oil", "Ceramides", "Cica"], tags: ["DeepHydration", "Soothing", "BarrierCare"] },
  ],
  /** Figma: Portfolio — Cleansing (772:5300) › Product Grid, first row (confirmed 2026-11-17). */
  cleansing: [
    { id: "centella-cleansing-oil", name: "Centella Cleansing Oil", image: `${CLEANSING}/centella-cleansing-oil.png`, crop: { l: -32.03, t: -33.85, w: 156.77, h: 156.77 }, keyIngredients: ["Centella Asiatica", "6 Botanical Oils"], tags: ["Soothing", "DeepCleansing", "Moisturizing"] },
    { id: "pore-deep-cleansing-oil", name: "Pore Deep Cleansing Oil", image: `${CLEANSING}/pore-deep-cleansing-oil.png`, crop: { l: -16.67, t: -16.93, w: 139.06, h: 139.06 }, keyIngredients: ["Jojoba Seed Oil", "Artemisia Vulgaris Oil"], tags: ["PoreCare", "DeepCleansing", "Moisturizing"] },
    { id: "heartleaf-cleansing-oil", name: "Heartleaf Cleansing Oil", image: `${CLEANSING}/heartleaf-cleansing-oil.png`, crop: { l: -3.39, t: -3.39, w: 106.51, h: 106.51 }, keyIngredients: ["Heartleaf Extract"], tags: ["SebumControl", "Soothing", "PoreCare"] },
  ],
  // Not confirmed yet — add confirmed products before launch (Figma example cards are placeholders, not data).
  "mask-pad": [],
  "sun-care": [],
  makeup: [],
  "body-care": [],
  /** Figma: Portfolio — Hair Care (772:6695) › Product Grid, rows 1–3 (confirmed 2026-11-26). */
  "hair-care": [
    { id: "beer-yeast-shampoo", name: "Beer Yeast Shampoo", image: `${HAIR_CARE}/beer-yeast-shampoo.jpg`, crop: { l: 0, t: -3.91, w: 103.91, h: 103.91 }, keyIngredients: ["Beer Yeast Extract", "Salicylic Acid"], tags: ["AntiHairLoss", "ScalpCare", "HairStrengthening"] },
    { id: "damage-repair-shampoo", name: "Damage Repair Shampoo", image: `${HAIR_CARE}/damage-repair-shampoo.jpg`, crop: { l: -2.6, t: -2.6, w: 104.95, h: 104.95 }, keyIngredients: ["Hydrolyzed Proteins", "Amino Acids"], tags: ["DamageRepair", "HairStrengthening", "Nourishing"] },
    { id: "damage-care-shampoo", name: "Damage Care Shampoo", image: `${HAIR_CARE}/damage-care-shampoo.jpg`, crop: { l: -6.51, t: -3.65, w: 113.02, h: 113.02 }, keyIngredients: ["Hydrolyzed Collagen", "Niacinamide"], tags: ["DamageRepair", "HairElasticity", "Shine"] },
    { id: "beer-yeast-scalp-serum", name: "Beer Yeast Scalp Serum", image: `${HAIR_CARE}/beer-yeast-scalp-serum.jpg`, keyIngredients: ["Beer Yeast Extract", "Botanical Extracts"], tags: ["ScalpSoothing", "ScalpCare", "RootStrengthening"] },
    { id: "brush-hair-serum", name: "Brush Hair Serum", image: `${HAIR_CARE}/brush-hair-serum.jpg`, crop: { l: 0, t: -11.2, w: 116.93, h: 116.93 }, keyIngredients: ["Centella Asiatica", "PDRN", "Salicylic Acid"], tags: ["ScalpSoothing", "DandruffCare", "HairVolume"] },
    { id: "tea-tree-scalp-tonic", name: "Tea Tree Scalp Tonic", image: `${HAIR_CARE}/tea-tree-scalp-tonic.jpg`, crop: { l: -2.08, t: -1.04, w: 102.08, h: 102.08 }, keyIngredients: ["Tea Tree Oil", "Salicylic Acid"], tags: ["ScalpPurifying", "OilControl", "Cooling"] },
    { id: "damage-repair-treatment-mask", name: "Damage Repair Treatment & Mask", image: `${HAIR_CARE}/damage-repair-treatment-mask.jpg`, crop: { l: 0, t: -10.16, w: 113.02, h: 113.02 }, keyIngredients: ["Keratin Complex", "Panthenol"], tags: ["DamageRepair", "Smoothing", "DeepNourishing"] },
    { id: "no-wash-hair-treatment-mist", name: "No-Wash Hair Treatment & Mist", image: `${HAIR_CARE}/no-wash-hair-treatment-mist.jpg`, crop: { l: -3.65, t: -53.65, w: 107.03, h: 160.68 }, keyIngredients: ["Hydrolyzed Keratin", "Argan Oil"], tags: ["DeepMoisture", "Detangling", "Smoothing"] },
    { id: "silk-hair-oil-serum", name: "Silk Hair Oil & Serum", image: `${HAIR_CARE}/silk-hair-oil-serum.jpg`, crop: { l: -17.19, t: -15.1, w: 130.21, h: 130.21 }, keyIngredients: ["Proteins & Amino Acids", "Botanical Oils"], tags: ["SilkyShine", "FrizzControl", "DamageCare"] },
  ],
};

/** A product with the category it is listed under (for the card's category line). */
export type PortfolioListItem = PortfolioProduct & { category: ProductCategorySlug };

/** `?category=` value → filter. Unknown or missing values fall back to All. */
export function parsePortfolioCategory(value: string | null): PortfolioCategory {
  return PRODUCT_CATEGORY_SLUGS.find((slug) => slug === value) ?? "all";
}

/**
 * Products for a filter. A single category keeps its Figma order.
 * All shows categories in reverse filter order and each category's products in reverse (newest additions first),
 * skipping empty categories and repeated ids. The source arrays are not modified.
 */
export function portfolioProducts(category: PortfolioCategory): PortfolioListItem[] {
  const isAll = category === "all";
  const slugs = isAll ? [...PRODUCT_CATEGORY_SLUGS].reverse() : [category];
  const seen = new Set<string>();
  return slugs.flatMap((slug) => {
    const products = isAll ? [...PORTFOLIO_PRODUCTS[slug]].reverse() : PORTFOLIO_PRODUCTS[slug];
    return products
      .filter((product) => !seen.has(product.id) && seen.add(product.id))
      .map((product) => ({ ...product, category: slug }));
  });
}
