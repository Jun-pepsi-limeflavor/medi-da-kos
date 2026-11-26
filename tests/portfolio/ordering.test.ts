// Portfolio 표시 순서: 개별 카테고리는 Figma 순서, All은 카테고리 역순 + 카테고리 내부 제품 역순(빈 카테고리 건너뜀).
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("../esm-alias-loader.mjs", import.meta.url);
const { PORTFOLIO_PRODUCTS, portfolioProducts } = await import("../../src/components/portfolio/products.ts");
const { PRODUCT_CATEGORY_SLUGS } = await import("../../src/lib/config/product-categories.ts");

const ids = (list: readonly { id: string }[]) => list.map((p) => p.id);
const allSource = PRODUCT_CATEGORY_SLUGS.flatMap((slug) => ids(PORTFOLIO_PRODUCTS[slug]));

test("product ids are unique across categories", () => {
  assert.equal(new Set(allSource).size, allSource.length);
});

test("each category filter keeps the source (Figma) order", () => {
  for (const slug of PRODUCT_CATEGORY_SLUGS) {
    const list = portfolioProducts(slug);
    assert.deepEqual(ids(list), ids(PORTFOLIO_PRODUCTS[slug]), slug);
    assert.ok(list.every((p) => p.category === slug), slug);
  }
});

test("All = categories reversed, products reversed within each, empty categories skipped", () => {
  const expected = [...PRODUCT_CATEGORY_SLUGS].reverse().flatMap((slug) =>
    [...PORTFOLIO_PRODUCTS[slug]].reverse().map((p) => `${slug}/${p.id}`),
  );
  assert.deepEqual(portfolioProducts("all").map((p) => `${p.category}/${p.id}`), expected);
});

test("All lists every product exactly once", () => {
  const all = ids(portfolioProducts("all"));
  assert.equal(all.length, allSource.length);
  assert.deepEqual([...all].sort(), [...allSource].sort());
});

test("current data: Hair care 9→1, then Cleansing 3→1, then Facial care 15→1", () => {
  const all = portfolioProducts("all");
  assert.equal(all[0].id, "silk-hair-oil-serum");
  assert.equal(all[8].id, "beer-yeast-shampoo");
  assert.deepEqual(ids(all.slice(9, 12)), ["heartleaf-cleansing-oil", "pore-deep-cleansing-oil", "centella-cleansing-oil"]);
  assert.equal(all[12].id, "rice-moisture-multi-balm-stick");
  assert.equal(all.at(-1)?.id, "ghk-cu-copper-peptide-serum");
});

test("All does not reorder the source arrays", () => {
  const before = PRODUCT_CATEGORY_SLUGS.map((slug) => ids(PORTFOLIO_PRODUCTS[slug]));
  portfolioProducts("all");
  portfolioProducts("all");
  assert.deepEqual(PRODUCT_CATEGORY_SLUGS.map((slug) => ids(PORTFOLIO_PRODUCTS[slug])), before);
});
