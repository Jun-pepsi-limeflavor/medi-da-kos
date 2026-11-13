// Home 7 · Client Testimonials.
// - 세계 지도(SVG) 위 강조 핀 5개와 후기 카드, 기타 진출 국가 회색 점 18개(Figma 좌표 그대로)
// - lg 이상: 1200px 지도 캔버스 전체를 컨테이너 폭에 맞춰 비례 축소(카드·연결선 포함)
// - lg 미만: 지도와 핀만 표시하고 후기 카드는 지도 아래 목록으로 표시
// - 지도 그래픽 레이어만 좌우 끝을 흰 배경으로 페이드, 핀은 최소 크기·정원형 유지
// - 인터랙션 없음. 후기 문구·국가 점 위치는 Figma [확인 필요] 상태 그대로 옮긴 것
import type { CSSProperties } from "react";
import Image from "next/image";
import { DISPLAY_TITLE, EYEBROW, SECTION_CONTAINER } from "@/components/home/styles";
import { cx } from "@/lib/utils/cx";

/** Figma canvas: Testimonial Map 1200×588 (1060:1559). */
const MAP_W = 1200;
const MAP_H = 588;

/** Figma "Markets" — other markets (Map Pin / Dot, 8px), top-left coordinates. */
const MARKET_DOTS: ReadonlyArray<readonly [number, number]> = [
  [96, 125.86], [329, 174.86], [256, 295.86], [426, 414.86], [614, 182.86], [631, 187.86],
  [661, 183.86], [584, 232.86], [638, 223.86], [574, 264.86], [699, 283.86], [746, 293.86],
  [722, 374.86], [679, 474.86], [949, 320.86], [1003, 332.86], [1059, 249.86], [1043, 459.86],
];

/** Highlighted markets (Map Pin / Active, 20px) with their testimonial card position (card top-left). */
const TESTIMONIALS = [
  {
    country: "USA",
    product: "Peptide Complex Serum",
    quote: "“The quality and texture exceeded our expectations. We’re very pleased with the final product.”",
    pin: [267, 233.86],
    card: [110, 18],
  },
  {
    country: "UK",
    product: "Long-Lasting Cushion Foundation",
    quote:
      "“From planning a formula to developing the shades, they supported us with great care as if it were their own brand.”",
    pin: [585, 175.86],
    card: [618, -65],
  },
  {
    country: "France",
    product: "Panthenol Cream Mist",
    quote: "“A lightweight, refreshing formula with a refined feel. The development process was seamless.”",
    pin: [598, 200.86],
    card: [304, 249],
  },
  {
    country: "UAE",
    product: "Anti-Aging Retinol Eye Cream",
    quote: "“Excellent quality and thoughtful support throughout the development process.”",
    pin: [771, 285.86],
    card: [740, 345],
  },
  {
    country: "India",
    product: "Ceramide UV Lip Treatment",
    quote: "“The texture and finish were exactly what we were looking for. A smooth development experience.”",
    pin: [852, 297.86],
    card: [899, 105],
  },
] as const;

const pctX = (x: number) => `${(x / MAP_W) * 100}%`;
const pctY = (y: number) => `${(y / MAP_H) * 100}%`;
/** One Figma pixel of the 1200px canvas, resolved against the map's container width. */
const u = (px: number) => `calc(${px} * 100cqw / ${MAP_W})`;

type Testimonial = (typeof TESTIMONIALS)[number];

/** Edge fade for the map layer (mask keeps the white page background showing through). */
const FADE = "linear-gradient(to right, transparent 0%, #000 8%, #000 92%, transparent 100%)";
const MAP_EDGE_FADE: CSSProperties = { maskImage: FADE, WebkitMaskImage: FADE };

/**
 * Pins are placed by their Figma center and kept square (aspect-ratio 1) with a minimum size,
 * so they stay round and visible when the map scales down on narrow screens.
 */
const MARKER = "absolute aspect-square -translate-x-1/2 -translate-y-1/2";

/** Figma: Map Testimonial Card (1060:1609). `scaled` sizes it in canvas units for the desktop map. */
function TestimonialCard({ item, scaled, style }: { item: Testimonial; scaled?: boolean; style?: CSSProperties }) {
  const s = (px: number) => (scaled ? u(px) : `${px}px`);
  return (
    <figure
      style={{ padding: `${s(12)} ${s(16)}`, gap: s(8), borderRadius: s(12), ...style }}
      className="flex flex-col border border-mdk-light-gray bg-mdk-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.06)]"
    >
      <figcaption className="flex flex-col font-medium" style={{ gap: s(2) }}>
        <span className="text-mdk-charcoal-muted uppercase" style={{ fontSize: s(12), lineHeight: s(16) }}>
          {item.country}
        </span>
        <span className="tracking-[-0.003em] text-mdk-charcoal" style={{ fontSize: s(15), lineHeight: s(20) }}>
          {item.product}
        </span>
      </figcaption>
      <blockquote className="text-mdk-charcoal-muted" style={{ fontSize: s(14), lineHeight: s(22) }}>
        {item.quote}
      </blockquote>
    </figure>
  );
}

/** Figma: 7 · Client Testimonials (234:5415). */
export function Testimonials() {
  return (
    <section className="bg-mdk-white py-20 lg:py-30">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-12`}>
        <div className="flex flex-col gap-6">
          <p className={EYEBROW}>Client Testimonials</p>
          <h2 className={cx(DISPLAY_TITLE, "text-mdk-charcoal")}>What our clients say</h2>
          <p className="max-w-[560px] text-mdk-lead text-mdk-charcoal-muted">
            Trusted by brands across global markets — connecting with diverse product needs around the world.
          </p>
        </div>

        <div className="@container">
          <div className="relative aspect-[1200/588] w-full">
            {/* Map graphic only: soft white fade at the left/right edges (pins and cards stay sharp). */}
            <div className="absolute inset-0" style={MAP_EDGE_FADE}>
              <Image src="/images/home/testimonials/world-map.svg" alt="" fill unoptimized />
            </div>
            {MARKET_DOTS.map(([x, y]) => (
              <span
                key={`${x}-${y}`}
                aria-hidden="true"
                className={MARKER}
                style={{ left: pctX(x + 4), top: pctY(y + 4), width: `max(4px, ${u(8)})` }}
              >
                <Image src="/icons/map-pin-dot.svg" alt="" fill unoptimized />
              </span>
            ))}
            {/* Leader lines (1px) linking each active pin to its card — desktop only, with the cards. */}
            <div
              aria-hidden="true"
              className="absolute hidden lg:block"
              style={{ left: pctX(277), top: pctY(115), width: pctX(654), height: pctY(230) }}
            >
              <Image src="/images/home/testimonials/leaders.svg" alt="" fill unoptimized />
            </div>
            {TESTIMONIALS.map(({ country, pin: [x, y] }) => (
              <span
                key={country}
                aria-hidden="true"
                className={MARKER}
                style={{ left: pctX(x + 10), top: pctY(y + 10), width: `max(10px, ${u(20)})` }}
              >
                <Image src="/icons/map-pin-active.svg" alt="" fill unoptimized />
              </span>
            ))}
            <div className="hidden lg:block">
              {TESTIMONIALS.map((item) => (
                <TestimonialCard
                  key={item.country}
                  item={item}
                  scaled
                  style={{ position: "absolute", left: pctX(item.card[0]), top: u(item.card[1]), width: u(260) }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
          {TESTIMONIALS.map((item) => (
            <TestimonialCard key={item.country} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
