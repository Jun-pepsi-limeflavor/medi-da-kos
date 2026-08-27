import type { LandingCatalogItem } from "./types";

export interface CatalogProduct extends LandingCatalogItem {
  image: string;
  description: string;
  differentiators: string;
  technology: string;
  keyIngredients: string;
  howToUse: string;
  referencePrices?: { units: "1,000" | "5,000"; price: string }[];
}

const rawProducts: ReadonlyArray<[CatalogProduct["category"], string, string]> = [
  ["serum", "NIACINAMIDE 2% + SAPONIN PINK SERUM", "niacinamide-2-saponin-pink-serum"], ["serum", "GREEN APPLE CAPSULE SERUM", "green-apple-capsule-serum"], ["serum", "SUPER PDRN BOOSTER", "super-pdrn-booster"], ["serum", "GREEN RETINAL BEAN DROP SERUM", "green-retinal-bean-drop-serum"], ["serum", "CLOUD ROOT SOOTHING SERUM", "cloud-root-soothing-serum"], ["serum", "NAD + SLUSH RESET SERUM", "nad-slush-reset-serum"], ["serum", "PERFECT RESURFACING SERUM", "perfect-resurfacing-serum"], ["serum", "HYALURON SEAL SERUM", "hyaluron-seal-serum"], ["serum", "HYALUCOGEN SERUM", "hyalucogen-serum"], ["serum", "PANTHENOL REGENERATIVE SERUM", "panthenol-regenerative-serum"], ["serum", "PINK HYDRATION CAPSULE SERUM", "pink-hydration-capsule-serum"], ["serum", "HYDRA JELLY SMOOTHIE SERUM", "hydra-jelly-smoothie-serum"], ["serum", "RETINOL MATRIX REPAIR SERUM", "retinol-matrix-repair-serum"], ["serum", "DERMA ACTION REVITALIZING SERUM", "derma-action-revitalizing-serum"], ["serum", "HYDRO BOOST HYALURONIC ACID SERUM", "hydro-boost-hyaluronic-acid-serum"], ["serum", "LAYER BLENDING SERUM", "layer-blending-serum"], ["serum", "YUJA Vit.C BRIGHTENING SERUM", "yuja-vit-c-brightening-serum"], ["serum", "BETA CALMING REPAIR AMPOULE", "beta-calming-repair-ampoule"], ["serum", "DAILY GLUTA SHOT", "daily-gluta-shot"], ["serum", "POWER ANTIAGING SERUM", "power-antiaging-serum"], ["serum", "FIRMING SOLUTION (MULTI-PEPTIDE EYE SERUM)", "firming-solution"], ["serum", "DEPUFFING SOLUTION (CAFFEINE + EGCG EYE SERUM)", "depuffing-solution"],
  ["toner", "PDRN GLOW BOOSTER", "pdrn-glow-booster"], ["toner", "GREEN EXOSOME SEBUM SOFTENER", "green-exosome-sebum-softener"], ["toner", "PANTHENOL 10 REPAIR ESSENCE TONER", "panthenol-10-repair-essence-toner"], ["toner", "PHA 10 GLASS RESET BUBBLE TONER", "pha-10-glass-reset-bubble-toner"],
  ["cream", "PDRN-EEDLE REVIVAL CREAM", "pdrn-needle-revival-cream"], ["cream", "QUERCETIN 1000 CALMING CREAM", "quercetin-1000-calming-cream"], ["cream", "GREEN BALANCING CREAM", "green-balancing-cream"], ["cream", "BERRY BOUNCE BALM", "berry-bounce-balm"], ["cream", "R.E.D BLEMISH CLEAR MOISTURE CREAM", "red-blemish-clear-moisture-cream"],
  ["mist", "RED ELIXIR JELLY MIST", "red-elixir-jelly-mist"], ["mist", "DEW LAYER SERUM MIST", "dew-layer-serum-mist"], ["mist", "RED REVIVE DUAL MIST", "red-revive-dual-mist"], ["mist", "COLLAGEN HYDROGEL MIST", "collagen-hydrogel-mist"],
];

const generic = (name: string, category: CatalogProduct["category"]): Omit<CatalogProduct, "id" | "name" | "category" | "image"> => ({
  description: `${name} is a proposal-ready ${category} developed for private-label beauty programs.`,
  differentiators: "A flexible concept that can be reviewed with the Medidakos formulation and packaging team.",
  technology: "Formula and packaging specifications are confirmed during consultation.",
  keyIngredients: "See the product proposal for the complete ingredient and claim review.",
  howToUse: "Use as directed after the final formula and packaging specification are confirmed.",
});

export const CATALOG_PRODUCTS: readonly CatalogProduct[] = rawProducts.map(([category, name, id]) => ({ id, name, category, image: `/landing/catalog/${id}.png`, ...generic(name, category) }));

const apple = CATALOG_PRODUCTS.find((product) => product.id === "green-apple-capsule-serum");
if (apple) Object.assign(apple, { description: "A brightening serum in which refreshing green apple capsules burst to deliver moisture and nourishment, leaving skin smooth and dewy.", differentiators: "A multi-serum for exfoliating care, hydration, brightening, and firming, with a light water-gel feel and bursting green and yellow capsules.", technology: "Apple EV Technology, megasonic extraction of four green fruits, and a green capsule system.", keyIngredients: "SingGreen(S) 2%, Apple EVs, Niacinamide 2%, Adenosine, Panthenol.", howToUse: "After toner, spread an appropriate amount so the capsules burst fully, then let it absorb.", referencePrices: [{ units: "1,000", price: "$11.33" }, { units: "5,000", price: "$7.50" }] });

export const CATALOG_CATEGORY_ORDER = ["serum", "toner", "cream", "mist"] as const;
export const CATALOG_CATEGORIES = CATALOG_CATEGORY_ORDER;
