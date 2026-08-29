const normalizedSourceIdPattern = /^[a-z0-9]+(?:_[a-z0-9]+)*$/

export type SeethingSwarmAnimationEvidence = Readonly<{
  relativePath: string
  animationId: string
  frameCount: number
}>

export type SeethingSwarmPaletteEvidence = Readonly<{
  sourceRelativePath: string
  colorLabel: string
}>

export type SeethingSwarmGeometryEvidence = Readonly<{
  sourceRelativePath: string
  frameWidth: number
  frameHeight: number
}>

function parseEvidenceLines(text: string, label: string) {
  const normalizedText = text.replaceAll("\r\n", "\n")
  if (normalizedText.includes("\r")) {
    throw new Error(`Invalid ${label}: unsupported line ending`)
  }

  const lines = normalizedText.split("\n")
  if (lines.at(-1) === "") lines.pop()
  if (lines.length === 0 || lines.some((line) => line === "")) {
    throw new Error(`Invalid ${label}: empty line`)
  }

  return lines
}

function parseSeparatedLine(
  line: string,
  fieldCount: 2,
  label: string,
): readonly [string, string]
function parseSeparatedLine(
  line: string,
  fieldCount: 3,
  label: string,
): readonly [string, string, string]
function parseSeparatedLine(
  line: string,
  fieldCount: 2 | 3,
  label: string,
): readonly [string, string] | readonly [string, string, string] {
  const fields = line.split(" -> ")
  if (fields.length !== fieldCount || fields.some((field) => field === "")) {
    throw new Error(`Invalid ${label}: ${line}`)
  }

  return fields as [string, string] | [string, string, string]
}

function assertRelativePath(value: string, label: string) {
  const segments = value.split("/")
  if (
    value.includes("\\") ||
    value.startsWith("/") ||
    value.endsWith("/") ||
    segments.some(
      (segment) =>
        segment === "" ||
        segment === "." ||
        segment === ".." ||
        !/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(segment),
    )
  ) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
}

function assertNormalizedSourceId(value: string, label: string) {
  if (!normalizedSourceIdPattern.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
}

function parsePositiveSafeInteger(value: string, label: string) {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`)
  }

  const parsedValue = Number(value)
  if (!Number.isSafeInteger(parsedValue)) {
    throw new Error(`Invalid ${label}: ${value}`)
  }

  return parsedValue
}

function assertUniquePaths(paths: readonly string[], label: string) {
  const comparablePaths = new Set<string>()
  for (const path of paths) {
    const comparablePath = path.toLowerCase()
    if (comparablePaths.has(comparablePath)) {
      throw new Error(`Duplicate ${label}: ${path}`)
    }
    comparablePaths.add(comparablePath)
  }
}

export function parseSeethingSwarmAnimationEvidence(text: string) {
  const records = parseEvidenceLines(text, "animation evidence").map((line) => {
    const [relativePath, animationId, frameDescription] = parseSeparatedLine(
      line,
      3,
      "animation evidence line",
    )

    assertRelativePath(relativePath, "animation evidence path")
    if (!relativePath.endsWith(".png")) {
      throw new Error(`Invalid animation evidence path: ${relativePath}`)
    }
    assertNormalizedSourceId(animationId, "animation evidence ID")

    const frameMatch = /^([0-9]+) frames$/.exec(frameDescription)
    if (!frameMatch) {
      throw new Error(
        `Invalid animation evidence frame count: ${frameDescription}`,
      )
    }

    return Object.freeze({
      relativePath,
      animationId,
      frameCount: parsePositiveSafeInteger(
        frameMatch[1]!,
        "animation evidence frame count",
      ),
    })
  })

  assertUniquePaths(
    records.map(({ relativePath }) => relativePath),
    "animation evidence path",
  )
  return Object.freeze(records)
}

export function parseSeethingSwarmPaletteEvidence(text: string) {
  const records = parseEvidenceLines(text, "palette evidence").map((line) => {
    const [sourceRelativePath, colorLabel] = parseSeparatedLine(
      line,
      2,
      "palette evidence line",
    )

    assertRelativePath(sourceRelativePath, "palette evidence source path")
    assertNormalizedSourceId(colorLabel, "palette evidence color label")

    return Object.freeze({
      sourceRelativePath,
      colorLabel,
    })
  })

  assertUniquePaths(
    records.map(({ sourceRelativePath }) => sourceRelativePath),
    "palette evidence source path",
  )
  return Object.freeze(records)
}

export function parseSeethingSwarmGeometryEvidence(text: string) {
  const records = parseEvidenceLines(text, "geometry evidence").map((line) => {
    const [sourceRelativePath, dimensions] = parseSeparatedLine(
      line,
      2,
      "geometry evidence line",
    )

    assertRelativePath(sourceRelativePath, "geometry evidence source path")
    const dimensionMatch = /^([0-9]+)x([0-9]+)$/.exec(dimensions)
    if (!dimensionMatch) {
      throw new Error(`Invalid geometry evidence dimensions: ${dimensions}`)
    }

    return Object.freeze({
      sourceRelativePath,
      frameWidth: parsePositiveSafeInteger(
        dimensionMatch[1]!,
        "geometry evidence frame width",
      ),
      frameHeight: parsePositiveSafeInteger(
        dimensionMatch[2]!,
        "geometry evidence frame height",
      ),
    })
  })

  assertUniquePaths(
    records.map(({ sourceRelativePath }) => sourceRelativePath),
    "geometry evidence source path",
  )
  return Object.freeze(records)
}
