import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400,
    // Required from Next 16 on: a `quality` prop not listed here returns 400.
    qualities: [60, 75],
  },
};

export default nextConfig;
