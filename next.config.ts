import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/how-it-works",
        destination: "/process",
        permanent: true,
      },
      {
        source: "/pricing",
        destination: "/compare",
        permanent: true,
      },
      {
        source: "/business",
        destination: "/about-us",
        permanent: true,
      },
      {
        source: "/korea",
        destination: "/landing/korea",
        permanent: true,
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400,
    // Required from Next 16 on: a `quality` prop not listed here returns 400.
    qualities: [60, 75],
    // Hero sources top out at 3200px wide and Next never upscales, so a 3840
    // request would just re-serve the 3200 source under a second cache key.
    deviceSizes: [16, 640, 750, 828, 1080, 1200, 1920, 2048, 3200],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
