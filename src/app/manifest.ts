import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: "Medidakos — Your Korean Cosmetics OEM & ODM Partner.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6fbff",
    theme_color: "#38bdf8",
    icons: [
      {
        src: "/icons/icon-48.png",
        sizes: "48x48",
        type: "image/png",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        // favicon.ico holds 16, 32 and 48 px images.
        src: "/favicon.ico",
        sizes: "16x16 32x32 48x48",
        type: "image/x-icon",
      },
    ],
  };
}
