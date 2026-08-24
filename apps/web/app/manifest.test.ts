import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import manifest, { dynamic } from "./manifest"

const EXPECTED_INSTALL_ICONS = Object.freeze([
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
] as const)

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

describe("web application manifest", () => {
  it("defines the static install identity and exact raster assets", () => {
    expect(dynamic).toBe("force-static")
    expect(manifest()).toMatchObject({
      name: "What Are Your Values, Mapache?",
      short_name: "WAYVM",
      description:
        "A high-speed autobattler designed to help you find your values in life.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#1e1e1e",
      theme_color: "#008b8b",
      icons: EXPECTED_INSTALL_ICONS,
    })

    for (const icon of EXPECTED_INSTALL_ICONS) {
      const png = readFileSync(resolve(WEB_ROOT, "public", icon.src.slice(1)))
      const [expectedWidth, expectedHeight] = icon.sizes.split("x").map(Number)

      expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a")
      expect(png.readUInt32BE(16)).toBe(expectedWidth)
      expect(png.readUInt32BE(20)).toBe(expectedHeight)
    }
  })
})
