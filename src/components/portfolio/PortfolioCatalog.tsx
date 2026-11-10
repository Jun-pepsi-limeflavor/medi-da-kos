"use client";

// Portfolio 2–3 · Category Filter & Product Grid.
// - 선택 카테고리는 항상 URL ?category=<slug>에서 읽는다(All은 파라미터 없음). 새로고침·뒤로/앞으로 가기와 일치
// - 칩 클릭: history.pushState로 방문 기록만 추가(서버 요청·페이지 이동·스크롤 이동 없음), 같은 URL이면 추가하지 않음
// - ?category=로 새로 들어오거나(Home 카테고리 타일·직접 접속) Home 'View all'·'Discover our work'(PortfolioProductsLink)로
//   들어오면 필터가 Navbar 아래 24px에 오도록 한 번 스크롤
//   (뒤로/앞으로 가기·새로고침은 브라우저가 복원한 위치 유지, Navbar·직접 /portfolio·칩 클릭은 스크롤하지 않음)
// - 필터와 첫 제품 사이 간격 28px(Figma 48 → 28, 2026-11-10)
// - 그리드: 처음 12개 → Load more 클릭마다 12개 추가, 추가된 첫 카드로 포커스. 카테고리를 바꾸면 처음 12개로 초기화
// - 확정 제품이 없는 카테고리는 임시 빈 상태 문구를 표시(제품 데이터가 추가되면 자동으로 그리드로 바뀜)
// - 모바일은 칩을 가로 스크롤(선택 칩이 가려지면 칩 줄만 옆으로 이동), lg 이상은 한 줄(넘치면 줄바꿈). 그리드 1열 → sm 2열 → lg 3열
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PortfolioProductCard } from "@/components/portfolio/PortfolioProductCard";
import { consumeProductsEntryRequest } from "@/components/portfolio/PortfolioProductsLink";
import {
  PORTFOLIO_FILTERS,
  parsePortfolioCategory,
  portfolioProducts,
  type PortfolioCategory,
} from "@/components/portfolio/products";
import { ROUTES } from "@/lib/config/routes";
import { SECTION_CONTAINER } from "@/components/home/styles";
import { cx } from "@/lib/utils/cx";

/** Figma: Load more — show up to 12, then 12 more per click. */
const PAGE_SIZE = 12;

const categoryHref = (slug: PortfolioCategory) => (slug === "all" ? ROUTES.portfolio : `${ROUTES.portfolio}?category=${slug}`);

// Entry scroll: arriving with ?category= (Home category tile, direct link) opens at the filter, not the Hero.
// Back/forward and reload keep the position the browser restores, so those entries are skipped.
let lastTraverse = Number.NEGATIVE_INFINITY;
let firstMountInDocument = true;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    lastTraverse = performance.now();
  });
}

function isFreshEntry() {
  const traversed = performance.now() - lastTraverse < 1000;
  const load = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const restoredLoad = firstMountInDocument && load?.name === location.href && load.type !== "navigate";
  firstMountInDocument = false;
  return !traversed && !restoredLoad;
}

/** Figma: 2–3 · Category Filter & Product Grid (772:3285). */
export function PortfolioCatalog() {
  const category = parsePortfolioCategory(useSearchParams().get("category"));
  const chips = useRef<HTMLUListElement>(null);
  const filter = useRef<HTMLElement>(null);
  const entry = useRef<{ category: PortfolioCategory; fresh?: boolean; productsFirst?: boolean }>({ category });

  // Runs once per page entry (chip clicks never remount this component, so they never scroll the page).
  // Layout effect + rAF: runs after Next.js resets the scroll to the top on navigation, but before the first paint,
  // so the Hero is never painted at the top first.
  useLayoutEffect(() => {
    const state = entry.current;
    // Decided once per mount (also under React Strict Mode's double effect run); the Home request is consumed here.
    state.fresh ??= isFreshEntry();
    state.productsFirst ??= consumeProductsEntryRequest();
    const el = filter.current;
    if (!state.fresh || (state.category === "all" && !state.productsFirst) || !el) return;
    const align = () => el.scrollIntoView({ block: "start", behavior: "instant" });
    const frame = requestAnimationFrame(() => {
      align();
      const placed = window.scrollY;
      // Web fonts can shift the Hero height once loaded; re-align only if the user has not scrolled meanwhile.
      void document.fonts?.ready.then(() => {
        if (Math.abs(window.scrollY - placed) < 2) align();
      });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // Mobile chip row scrolls sideways: bring the selected chip into view (horizontal only, page scroll untouched).
  useEffect(() => {
    const list = chips.current;
    const chip = list?.querySelector("[aria-current]");
    if (!list || !chip) return;
    const c = chip.getBoundingClientRect();
    const l = list.getBoundingClientRect();
    if (c.left < l.left || c.right > l.right) list.scrollBy({ left: c.left - l.left - 24, behavior: "instant" });
  }, [category]);

  const select = (event: MouseEvent<HTMLAnchorElement>, slug: PortfolioCategory) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (slug === category) return;
    // Next.js syncs useSearchParams with native history calls; passing null keeps its internal history state.
    window.history.pushState(null, "", categoryHref(slug));
  };

  return (
    <section className="bg-mdk-white pb-20 lg:pb-[120px]">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-7`}>
        {/* scroll-mt: sticky Navbar 72px + 24px gap when the entry scroll aligns the filter. */}
        <nav ref={filter} aria-label="Product categories" className="scroll-mt-24 border-y border-mdk-light-gray py-6 lg:py-8">
          <ul ref={chips} className="-mx-6 flex gap-2 overflow-x-auto px-6 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
            {PORTFOLIO_FILTERS.map(({ slug, label }) => {
              const current = slug === category;
              return (
                <li key={slug} className="shrink-0">
                  <a
                    href={categoryHref(slug)}
                    onClick={(event) => select(event, slug)}
                    aria-current={current ? "true" : undefined}
                    className={cx(
                      "flex h-10 items-center rounded-full px-[18px] text-[14px] leading-5 font-medium tracking-[-0.003em] whitespace-nowrap transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-charcoal",
                      current
                        ? "bg-mdk-charcoal text-mdk-white"
                        : "bg-mdk-white text-mdk-charcoal shadow-[inset_0_0_0_1px_var(--color-mdk-light-gray)] hover:shadow-[inset_0_0_0_1px_var(--color-mdk-charcoal)]",
                    )}
                  >
                    {label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        {/* key: switching category remounts the grid, so it starts again from the first 12 products. */}
        <ProductGrid key={category} category={category} />
      </div>
    </section>
  );
}

function ProductGrid({ category }: { category: PortfolioCategory }) {
  const products = portfolioProducts(category);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const firstAdded = useRef<HTMLLIElement>(null);
  const loadedMore = useRef(false);

  // After Load more, move keyboard focus to the first newly added card (Figma note).
  useEffect(() => {
    if (loadedMore.current) firstAdded.current?.focus();
  }, [visible]);

  if (products.length === 0) {
    // TEMPORARY empty state for categories without confirmed products yet (pre-launch only).
    // It disappears automatically once products are added to PORTFOLIO_PRODUCTS.
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-mdk-lg bg-mdk-off-white px-6 py-16 text-center">
        <p className="text-mdk-body text-mdk-charcoal-muted">No products in this category yet.</p>
      </div>
    );
  }

  const shown = products.slice(0, visible);
  const loadMore = () => {
    loadedMore.current = true;
    setVisible(visible + PAGE_SIZE);
  };

  return (
    <div className="flex flex-col gap-12">
      <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-16">
        {shown.map((product, index) => (
          <PortfolioProductCard
            key={product.id}
            product={product}
            eager={index < 3}
            ref={index > 0 && index === visible - PAGE_SIZE ? firstAdded : undefined}
          />
        ))}
      </ul>
      <div className="flex flex-col items-center gap-4">
        <p aria-live="polite" className="text-[14px] leading-[25px] tracking-[-0.002em] text-mdk-charcoal-muted">
          Showing {shown.length} of {products.length} products
        </p>
        {shown.length < products.length ? (
          <Button variant="secondary" onClick={loadMore}>
            Load more products
          </Button>
        ) : null}
      </div>
    </div>
  );
}
