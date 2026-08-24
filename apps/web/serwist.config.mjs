import { serwist } from "@serwist/next/config"

export default serwist({
  swSrc: "app/sw.ts",
  swDest: "out/sw.js",
})
