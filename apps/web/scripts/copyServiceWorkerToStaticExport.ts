import fs from "node:fs"
import path from "node:path"

export const copyServiceWorkerToStaticExport = (
  webDirectory: string = process.cwd(),
) => {
  fs.copyFileSync(
    path.join(webDirectory, "public", "sw.js"),
    path.join(webDirectory, "out", "sw.js"),
  )
}
