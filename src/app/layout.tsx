import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { PostHogProvider, PostHogPageView } from "@/components/analytics/PostHogProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "prime-atlas | Go/no-go in 10 minutes. IC memo in one click.",
    template: "%s | prime-atlas",
  },
  description:
    "Prime Atlas compresses time-to-defensible-conviction on real estate sites — from weeks of analyst labour to ten minutes you can put in front of a committee. Pre-screened pipeline, preliminary underwrite, one-click IC memo across UK, US, Australia, Canada, and Spain.",
  keywords: [
    "real estate investment conviction",
    "IC memo generator real estate",
    "site acquisition decision tool",
    "go no-go site analysis",
    "development site pre-screening",
    "investment committee memo",
    "real estate preliminary underwrite",
    "ROI feasibility index",
    "deal board real estate",
    "capital allocation real estate",
  ],
  authors: [{ name: "prime-atlas" }],
  creator: "prime-atlas",
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://prime-atlas-weld.vercel.app",
    siteName: "prime-atlas",
    title: "prime-atlas | Go/no-go in 10 minutes. IC memo in one click.",
    description:
      "Pre-screened pipeline, preliminary underwrite, one-click IC memo. Compress time-to-defensible-conviction before the off-market window closes.",
  },
  twitter: {
    card: "summary_large_image",
    title: "prime-atlas",
    description: "Go/no-go in 10 minutes. IC memo in one click. Before your competitor finishes pulling zoning.",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "prime-atlas",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0A0E1A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.variable} font-sans antialiased min-h-screen`}>
        <PostHogProvider>
          <AuthProvider>
          <Suspense fallback={null}><PostHogPageView /></Suspense>
          {children}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js').catch(console.error);
                  });
                }
              `,
            }}
          />
          </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
