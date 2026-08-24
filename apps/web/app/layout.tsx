import "./globals.css"
import { SerwistProvider } from "@serwist/next/react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title:
    "What Are Your Values, Mapache? A Free Game To Find What You Value in Life",
  description:
    "What Are Your Values, Mapache? is a fast-paced, value-sorting autobattler to help you find out what you value in life.",
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
