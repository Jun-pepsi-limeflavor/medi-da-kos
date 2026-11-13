import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages of the previous site that the renewal removed (destinations confirmed 2026-11-13). Query strings (UTM)
  // pass through. /test and /admin/* stay 404 on purpose.
  async redirects() {
    return [
      // Confirmed, permanent (308)
      { source: "/business", destination: "/about-us", permanent: true },
      { source: "/process", destination: "/services#how-it-works", permanent: true },
      { source: "/how-it-works", destination: "/services#how-it-works", permanent: true },
      { source: "/landing/catalog", destination: "/portfolio", permanent: true },
      { source: "/compare", destination: "/services", permanent: true },
      { source: "/pricing", destination: "/services", permanent: true },
      // Dashboard comes back in V2.1: temporary (307, not cached by browsers). Remove this entry then.
      // `:path*` matches /dashboard itself and every sub-path (/dashboard/orders, /dashboard/tracking).
      { source: "/dashboard/:path*", destination: "/contact", permanent: false },
      // PENDING — destination awaiting CEO confirmation. Temporary (307) to /contact only so cold-mail links don't
      // 404 meanwhile; not the final decision.
      { source: "/korea", destination: "/contact", permanent: false },
      { source: "/landing/korea", destination: "/contact", permanent: false },
      { source: "/landing/dashboard", destination: "/contact", permanent: false },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400,
    // Required from Next 16 on: a `quality` prop not listed here returns 400.
    qualities: [60, 75],
  },
};

export default nextConfig;
