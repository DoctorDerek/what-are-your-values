import type { MetadataRoute } from "next"

export const dynamic = "force-static"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "What Are Your Values, Mapache?",
    short_name: "WAYVM",
    description:
      "A high-speed autobattler designed to help you find your values in life.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#1e1e1e",
    theme_color: "#008b8b",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  }
}
