import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import RootLayout, { metadata } from "./layout"

const { serwistProviderSpy } = vi.hoisted(() => ({
  serwistProviderSpy: vi.fn(),
}))

vi.mock("@serwist/next/react", () => ({
  SerwistProvider: ({
    children,
    ...registration
  }: {
    children?: ReactNode
    swUrl: string
    disable?: boolean
    cacheOnNavigation?: boolean
    reloadOnOnline?: boolean
  }) => {
    serwistProviderSpy(registration)
    return <>{children}</>
  },
}))

afterEach(() => {
  vi.unstubAllEnvs()
  serwistProviderSpy.mockClear()
})

describe("Root layout", () => {
  it("exposes the product metadata and accessible document language", () => {
    render(
      <RootLayout>
        <p>Values client</p>
      </RootLayout>,
    )

    expect(metadata).toMatchObject({
      title:
        "What Are Your Values, Mapache? A Free Game To Find What You Value in Life",
      description:
        "What Are Your Values, Mapache? is a fast-paced, value-sorting autobattler to help you find out what you value in life.",
    })
    expect(document.documentElement).toHaveAttribute("lang", "en")
    expect(screen.getByText("Values client")).toBeVisible()
    expect(serwistProviderSpy).toHaveBeenCalledWith({
      swUrl: "/sw.js",
      disable: true,
      cacheOnNavigation: false,
      reloadOnOnline: false,
    })
  })

  it("enables offline registration for production releases", () => {
    vi.stubEnv("NODE_ENV", "production")

    render(
      <RootLayout>
        <p>Production values client</p>
      </RootLayout>,
    )

    expect(screen.getByText("Production values client")).toBeVisible()
    expect(serwistProviderSpy).toHaveBeenCalledWith({
      swUrl: "/sw.js",
      disable: false,
      cacheOnNavigation: false,
      reloadOnOnline: false,
    })
  })

  it("disables offline registration on protected Vercel Previews", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("VERCEL_ENV", "preview")

    render(
      <RootLayout>
        <p>Preview values client</p>
      </RootLayout>,
    )

    expect(screen.getByText("Preview values client")).toBeVisible()
    expect(serwistProviderSpy).toHaveBeenCalledWith({
      swUrl: "/sw.js",
      disable: true,
      cacheOnNavigation: false,
      reloadOnOnline: false,
    })
  })
})
