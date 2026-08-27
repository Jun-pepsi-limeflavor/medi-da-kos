import type { LandingCatalogItem } from "./types";

export interface CatalogProduct extends LandingCatalogItem {
  image: string;
  description: string;
  differentiators: string;
  technology: string;
  keyIngredients: string;
  howToUse: string;
}

const rawProducts: ReadonlyArray<[CatalogProduct["category"], string, string]> = [
  ["serum", "NIACINAMIDE 2% + SAPONIN PINK SERUM", "niacinamide-2-saponin-pink-serum"], ["serum", "GREEN APPLE CAPSULE SERUM", "green-apple-capsule-serum"], ["serum", "SUPER PDRN BOOSTER", "super-pdrn-booster"], ["serum", "GREEN RETINAL BEAN DROP SERUM", "green-retinal-bean-drop-serum"], ["serum", "CLOUD ROOT SOOTHING SERUM", "cloud-root-soothing-serum"], ["serum", "NAD + SLUSH RESET SERUM", "nad-slush-reset-serum"], ["serum", "PERFECT RESURFACING SERUM", "perfect-resurfacing-serum"], ["serum", "HYALURON SEAL SERUM", "hyaluron-seal-serum"], ["serum", "HYALUCOGEN SERUM", "hyalucogen-serum"], ["serum", "PANTHENOL REGENERATIVE SERUM", "panthenol-regenerative-serum"], ["serum", "PINK HYDRATION CAPSULE SERUM", "pink-hydration-capsule-serum"], ["serum", "HYDRA JELLY SMOOTHIE SERUM", "hydra-jelly-smoothie-serum"], ["serum", "RETINOL MATRIX REPAIR SERUM", "retinol-matrix-repair-serum"], ["serum", "DERMA ACTION REVITALIZING SERUM", "derma-action-revitalizing-serum"], ["serum", "HYDRO BOOST HYALURONIC ACID SERUM", "hydro-boost-hyaluronic-acid-serum"], ["serum", "LAYER BLENDING SERUM", "layer-blending-serum"], ["serum", "YUJA Vit.C BRIGHTENING SERUM", "yuja-vit-c-brightening-serum"], ["serum", "BETA CALMING REPAIR AMPOULE", "beta-calming-repair-ampoule"], ["serum", "DAILY GLUTA SHOT", "daily-gluta-shot"], ["serum", "POWER ANTIAGING SERUM", "power-antiaging-serum"], ["serum", "FIRMING SOLUTION (MULTI-PEPTIDE EYE SERUM)", "firming-solution"], ["serum", "DEPUFFING SOLUTION (CAFFEINE + EGCG EYE SERUM)", "depuffing-solution"],
  ["toner", "PDRN GLOW BOOSTER", "pdrn-glow-booster"], ["toner", "GREEN EXOSOME SEBUM SOFTENER", "green-exosome-sebum-softener"], ["toner", "PANTHENOL 10 REPAIR ESSENCE TONER", "panthenol-10-repair-essence-toner"], ["toner", "PHA 10 GLASS RESET BUBBLE TONER", "pha-10-glass-reset-bubble-toner"],
  ["cream", "PDRN-EEDLE REVIVAL CREAM", "pdrn-needle-revival-cream"], ["cream", "QUERCETIN 1000 CALMING CREAM", "quercetin-1000-calming-cream"], ["cream", "GREEN BALANCING CREAM", "green-balancing-cream"], ["cream", "BERRY BOUNCE BALM", "berry-bounce-balm"],
  ["mist", "RED ELIXIR JELLY MIST", "red-elixir-jelly-mist"], ["mist", "DEW LAYER SERUM MIST", "dew-layer-serum-mist"], ["mist", "RED REVIVE DUAL MIST", "red-revive-dual-mist"], ["mist", "COLLAGEN HYDROGEL MIST", "collagen-hydrogel-mist"],
];

const generic = (name: string, category: CatalogProduct["category"]): Omit<CatalogProduct, "id" | "name" | "category" | "image"> => ({
  description: `${name} is a proposal-ready ${category} developed for private-label beauty programs.`,
  differentiators: "A flexible concept that can be reviewed with the Medidakos formulation and packaging team.",
  technology: "Formula and packaging specifications are confirmed during consultation.",
  keyIngredients: "See the product proposal for the complete ingredient and claim review.",
  howToUse: "Use as directed after the final formula and packaging specification are confirmed.",
});

/** Card and dialog descriptions transcribed from 카탈로그_제품_텍스트.md. */
const PRODUCT_DESCRIPTIONS: Readonly<Record<string, string>> = {
  "NIACINAMIDE 2% + SAPONIN PINK SERUM": "A brightening pomegranate fondant serum richly infused with revitalizing fruit essence.",
  "GREEN APPLE CAPSULE SERUM": "A brightening serum in which refreshing green apple capsules burst to deliver moisture and nourishment. Leaves skin smooth and firm with a fresh, dewy radiance.",
  "SUPER PDRN BOOSTER": "Revives weakened skin and restores its natural condition with powerful PDRN regeneration energy. Melts into the skin to recharge elasticity, radiance, and moisture from within.",
  "GREEN RETINAL BEAN DROP SERUM": "A daily boosting serum combining green-hued mung bean extract and retinal for calming and firming care.",
  "CLOUD ROOT SOOTHING SERUM": "A soothing serum in which beta-sitosterol active beads melt smoothly onto the skin to strengthen the barrier and quickly calm sensitized skin.",
  "NAD + SLUSH RESET SERUM": "A daily peeling toner with 10% PHA and a bubble texture that finishes skin with a smooth, glass-like look.",
  "PERFECT RESURFACING SERUM": "An overnight serum with 11% vegan acid blend clinically proven to exfoliate and renew skin.",
  "HYALURON SEAL SERUM": "A bouncy gel serum infused with hyaluronic acid that forms a moisture barrier to strengthen and protect the skin.",
  "HYALUCOGEN SERUM": "A water serum with hyaluronic acid and glycogen that deeply moisturizes the skin without stickiness.",
  "PANTHENOL REGENERATIVE SERUM": "A panthenol serum that calms irritated skin overnight, leaving it smooth and hydrated by morning. A nutrient-rich anti-aging serum that strengthens the skin barrier and slows down visible signs of aging.",
  "PINK HYDRATION CAPSULE SERUM": "This serum features pink capsules that melt into combination skin, instantly boosting hydration and comfort.",
  "HYDRA JELLY SMOOTHIE SERUM": "Packed like a smoothie, powered like a serum. This cooling gel hydrates, calms, and revives thirsty skin in one fresh swipe.",
  "RETINOL MATRIX REPAIR SERUM": "A triple-layer stabilized retinol serum that visibly refines skin texture and evens out tone — your go-to firming solution for smoother, more radiant skin.",
  "DERMA ACTION REVITALIZING SERUM": "This serum with Epidermbarrier®, Hyaluronic Acid, and Macadamia Seed Oil strengthens the skin barrier and hydrates deeply.",
  "HYDRO BOOST HYALURONIC ACID SERUM": "A gel serum that instantly boosts hydration while forming a strong moisturizing barrier on the skin.",
  "LAYER BLENDING SERUM": "Shake to activate this 2-layer serum with astaxanthin, collagen, and peptides that lock in hydration and fight aging.",
  "YUJA Vit.C BRIGHTENING SERUM": "This gel serum hydrates and evens tone while smoothing the skin’s texture.",
  "BETA CALMING REPAIR AMPOULE": "A serum enriched with plant-derived ingredients that strengthen the skin barrier and soothe for overall skin health.",
  "DAILY GLUTA SHOT": "A renewal serum that refines skin tone and texture together, completing a clear, even skin impression.",
  "POWER ANTIAGING SERUM": "A deeply hydrating serum with collagen and coenzyme Q10 to combat signs of aging.",
  "FIRMING SOLUTION (MULTI-PEPTIDE EYE SERUM)": "A peptide-rich eye serum that firms delicate under-eye skin and reduces puffiness and dark circles.",
  "DEPUFFING SOLUTION (CAFFEINE + EGCG EYE SERUM)": "An eye serum with caffeine and EGCG to reduce puffiness, dark spots, and brighten the under-eye area.",
  "PDRN GLOW BOOSTER": "A high-hydration, glow-boosting vitamin toner with patented LACTO- PDRN® to visibly brighten skin tone and replenish moisture deep within.",
  "GREEN EXOSOME SEBUM SOFTENER": "A green exosome cleaner essence that gently dissolves and removes built-up sebum and dead skin cells inside pores, leaving skin smooth and clean.",
  "PANTHENOL 10 REPAIR ESSENCE TONER": "A repair essence toner formulated with 10% panthenol to hydrate and soothe damaged, sensitized skin.",
  "PHA 10 GLASS RESET BUBBLE TONER": "A daily peeling toner with 10% PHA and a bubble texture that finishes skin with a smooth, glass-like look.",
  "PDRN-EEDLE REVIVAL CREAM": "A silky-soft cream that uses micro-spicule technology to enhance the absorption of patented LACTO-PDRN® and barrier-repairing actives.",
  "QUERCETIN 1000 CALMING CREAM": "A calming balance cream formulated with Quercetin 1000ppm to soothe stressed, sensitive skin and restore comfort.",
  "GREEN BALANCING CREAM": "A deep-hydrating cream that replenishes moisture while refining sebum and dead skin cells, inspired by long-lasting green tea hydration.",
  "BERRY BOUNCE BALM": "A rich yet silky balm infused with antioxidant-rich berries to deeply nourish, soothe, and protect the skin with long-lasting hydration.",
  "RED ELIXIR JELLY MIST": "A jelly mist that combines a bouncy jelly serum texture with the glow synergy of red active ingredients to deliver firm, dewy radiance to the skin.",
  "DEW LAYER SERUM MIST": "High-moisture dual-layer mist for hydration, soothing, and skin recovery. One spritz = a lot of benefits!",
  "RED REVIVE DUAL MIST": "A dual-layer oil-serum mist that delivers deep hydration and firm glow care in one anti-aging ritual.",
  "COLLAGEN HYDROGEL MIST": "A jelly mist that delivers the hydrating and firming effect of a collagen hydrogel mask.",
};

export const CATALOG_PRODUCTS: readonly CatalogProduct[] = rawProducts.map(([category, name, id]) => {
  const defaultCopy = generic(name, category);
  return {
    id,
    name,
    category,
    image: `/landing/catalog/${id}.png`,
    ...defaultCopy,
    description: PRODUCT_DESCRIPTIONS[name] ?? defaultCopy.description,
  };
});

const apple = CATALOG_PRODUCTS.find((product) => product.id === "green-apple-capsule-serum");
if (apple) Object.assign(apple, { description: PRODUCT_DESCRIPTIONS[apple.name], differentiators: "A multi-serum for exfoliating care, hydration, brightening, and firming, with a light water-gel feel and bursting green and yellow capsules.", technology: "Apple EV Technology, megasonic extraction of four green fruits, and a green capsule system.", keyIngredients: "SingGreen(S) 2%, Apple EVs, Niacinamide 2%, Adenosine, Panthenol.", howToUse: "After toner, spread an appropriate amount so the capsules burst fully, then let it absorb." });

export const CATALOG_CATEGORY_ORDER = ["serum", "toner", "cream", "mist"] as const;
export const CATALOG_CATEGORIES = CATALOG_CATEGORY_ORDER;
