import packagingJson from "@/components/dashboard/Packaging_Options.json";
import type { ProductCategory } from "./types";

export type PackagingOptionsMap = Record<string, Record<string, string[]>>;

export const PACKAGING_OPTIONS = packagingJson as PackagingOptionsMap;

export function categoryToPackagingKey(
  category: ProductCategory,
): keyof PackagingOptionsMap {
  return category === "skincare" ? "Skin Care" : "Cosmetic";
}

export function getPackagingGroups(category: ProductCategory): string[] {
  const key = categoryToPackagingKey(category);
  return Object.keys(PACKAGING_OPTIONS[key] ?? {});
}

export function getPackagingItems(
  category: ProductCategory,
  group: string,
): string[] {
  const key = categoryToPackagingKey(category);
  return PACKAGING_OPTIONS[key]?.[group] ?? [];
}
