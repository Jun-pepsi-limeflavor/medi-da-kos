"use client";

// /portfolio(All)로 이동하면서 Hero 대신 카테고리 필터·첫 제품 행부터 보여 달라는 일회성 진입 링크.
// - Home의 'View all'·'Discover our work'에서 사용. URL은 그대로 /portfolio(쿼리·해시 추가 없음)
// - 일반 클릭 순간 메모리에 진입 요청을 남기고, PortfolioCatalog가 첫 마운트에서 읽은 뒤 바로 지운다
// - 새 탭 열기(수정 키·가운데 클릭)는 요청하지 않고, 10초 안에 소비되지 않은 요청은 무시 → 이후 Navbar 진입 등에 남지 않음
import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { ROUTES } from "@/lib/config/routes";

const REQUEST_TTL_MS = 10_000;
let requestedAt = Number.NEGATIVE_INFINITY;

/** Returns whether a products-first entry was requested just now, and clears the request. */
export function consumeProductsEntryRequest() {
  const requested = performance.now() - requestedAt < REQUEST_TTL_MS;
  requestedAt = Number.NEGATIVE_INFINITY;
  return requested;
}

/** next/link to /portfolio that opens the page at the category filter (All selected). */
export function PortfolioProductsLink({ onClick, ...props }: Omit<ComponentProps<typeof Link>, "href">) {
  const request = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    requestedAt = performance.now();
  };
  return <Link href={ROUTES.portfolio} onClick={request} {...props} />;
}
