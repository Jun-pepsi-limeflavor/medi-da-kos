import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  CATALOG_PRODUCTS,
  CATALOG_CATEGORY_ORDER,
} from "../src/lib/landing/catalog-products.ts";

const expectedNames = {
  serum: [
    "NIACINAMIDE 2% + SAPONIN PINK SERUM",
    "GREEN APPLE CAPSULE SERUM",
    "SUPER PDRN BOOSTER",
    "GREEN RETINAL BEAN DROP SERUM",
    "CLOUD ROOT SOOTHING SERUM",
    "NAD + SLUSH RESET SERUM",
    "LACTO CREAM SERUM",
    "PERFECT RESURFACING SERUM",
    "HYALURON SEAL SERUM",
    "HYALUCOGEN SERUM",
    "PANTHENOL REGENERATIVE SERUM",
    "TIMELESS NOURISHING SERUM",
    "PINK HYDRATION CAPSULE SERUM",
    "HYDRA JELLY SMOOTHIE SERUM",
    "RETINOL MATRIX REPAIR SERUM",
    "DERMA ACTION REVITALIZING SERUM",
    "HYDRO BOOST HYALURONIC ACID SERUM",
    "LAYER BLENDING SERUM",
    "YUJA Vit.C BRIGHTENING SERUM",
    "BETA CALMING REPAIR AMPOULE",
    "DAILY GLUTA SHOT",
    "POWER ANTIAGING SERUM",
    "FIRMING SOLUTION (MULTI-PEPTIDE EYE SERUM)",
    "DEPUFFING SOLUTION (CAFFEINE + EGCG EYE SERUM)",
  ],
  toner: [
    "PDRN GLOW BOOSTER",
    "GREEN EXOSOME SEBUM SOFTENER",
    "PANTHENOL 10 REPAIR ESSENCE TONER",
    "PHA 10 GLASS RESET BUBBLE TONER",
  ],
  cream: [
    "PDRN-EEDLE REVIVAL CREAM",
    "QUERCETIN 1000 CALMING CREAM",
    "GREEN BALANCING CREAM",
    "BERRY BOUNCE BALM",
    "R.E.D BLEMISH CLEAR MOISTURE CREAM",
    "GREEN FLAVONOID SOOTHING CREAM",
  ],
  mist: [
    "RED ELIXIR JELLY MIST",
    "DEW LAYER SERUM MIST",
    "RED REVIVE DUAL MIST",
    "COLLAGEN HYDROGEL MIST",
  ],
} as const;

test("catalog has the approved category counts and category order", () => {
  const counts = CATALOG_PRODUCTS.reduce<Record<string, number>>(
    (result, product) => {
      result[product.category] = (result[product.category] ?? 0) + 1;
      return result;
    },
    {},
  );

  assert.deepEqual(counts, { serum: 24, toner: 4, cream: 6, mist: 4 });
  assert.deepEqual(CATALOG_CATEGORY_ORDER, ["serum", "toner", "cream", "mist"]);
});

test("catalog contains exactly the approved product names", () => {
  for (const category of CATALOG_CATEGORY_ORDER) {
    const names = CATALOG_PRODUCTS
      .filter((product) => product.category === category)
      .map((product) => product.name)
      .sort();
    assert.deepEqual(names, [...expectedNames[category]].sort());
  }
});

test("catalog IDs and names are unique and every product uses a local asset", () => {
  const ids = new Set(CATALOG_PRODUCTS.map((product) => product.id));
  const names = new Set(CATALOG_PRODUCTS.map((product) => product.name));

  assert.equal(ids.size, 38);
  assert.equal(names.size, 38);
  for (const product of CATALOG_PRODUCTS) {
    assert.match(product.image, /^\/landing\/catalog\//);
    assert.doesNotMatch(product.image, /^https?:\/\//);
    assert.ok(product.description.trim().length > 0, product.name);
    assert.ok(product.differentiators.length > 0, product.name);
    assert.ok(product.technology.trim().length > 0, product.name);
    assert.ok(product.keyIngredients.length > 0, product.name);
    assert.ok(product.howToUse.trim().length > 0, product.name);
  }
});

test("catalog assets are present and each product has a distinct image", async () => {
  const hashes = await Promise.all(
    CATALOG_PRODUCTS.map(async (product) => {
      const bytes = await readFile(
        new URL(`../public${product.image}`, import.meta.url),
      );
      return createHash("sha256").update(bytes).digest("hex");
    }),
  );

  assert.equal(new Set(hashes).size, CATALOG_PRODUCTS.length);
});
