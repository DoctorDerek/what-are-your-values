import "./globals.css"
import { SerwistProvider } from "@serwist/next/react"
import type { Metadata, Viewport } from "next"
import { createWebMetadata } from "@/lib/WebMetadata"

export const metadata: Metadata = createWebMetadata(process.env.VERCEL_ENV)

export const viewport: Viewport = {
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const serviceWorkerIsDisabled =
    process.env.NODE_ENV !== "production" ||
    process.env.VERCEL_ENV === "preview"

  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <SerwistProvider
          swUrl="/sw.js"
          disable={serviceWorkerIsDisabled}
          cacheOnNavigation={false}
          reloadOnOnline={false}
        >
          {children}
        </SerwistProvider>
      </body>
    </html>
  )
}
