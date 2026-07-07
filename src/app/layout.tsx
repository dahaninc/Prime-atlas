import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { PostHogProvider, PostHogPageView } from "@/components/analytics/PostHogProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { BottomNav } from "@/components/layout/BottomNav";
import { Toaster } from "@/components/ui/Toaster";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "600", "700"],
  variable: "--font-newsreader",
});

export const metadata: Metadata = {
  title: {
    default: "prime-atlas | Real estate conviction — for every investor, at every scale.",
    template: "%s | prime-atlas",
  },
  description:
    "From retail investors spotting emerging markets early to institutional funds closing deals before competitors build a model. Pre-screened pipeline across 32 markets, live underwrite, Investment Analysis Report in one click. USA · UK.",
  keywords: [
    "real estate investment conviction",
    "investment analysis report generator real estate",
    "real estate deal screening",
    "property investment analysis",
    "site acquisition decision tool",
    "go no-go site analysis",
    "development site pre-screening",
    "investment analysis report",
    "real estate preliminary underwrite",
    "ROI feasibility index",
    "deal board real estate",
    "retail real estate investment",
    "institutional real estate analysis",
    "real estate fund pre-screening",
  ],
  authors: [{ name: "prime-atlas" }],
  creator: "prime-atlas",
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://prime-atlas-weld.vercel.app",
    siteName: "prime-atlas",
    title: "prime-atlas | Real estate conviction — for every investor, at every scale.",
    description:
      "Pre-screened pipeline across 32 markets, live preliminary underwrite, Investment Analysis Report in one click. For retail investors, developers, and institutional funds. USA · UK.",
  },
  twitter: {
    card: "summary_large_image",
    title: "prime-atlas",
    description: "Real estate conviction for every investor. Pre-screened pipeline, live underwrite, Investment Analysis Report same day. 32 markets across the USA and UK.",
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
  themeColor: "#09090b",
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
      <body className={`${inter.variable} ${newsreader.variable} font-sans antialiased min-h-screen pb-[env(safe-area-inset-bottom)] md:pb-0`}>
        <PostHogProvider>
          <AuthProvider>
          <Suspense fallback={null}><PostHogPageView /></Suspense>
          <div className="pb-20 md:pb-0">
            {children}
          </div>
          <BottomNav />
          <Toaster />
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', () => {
                    // The old caching SW stranded browsers on stale deploys
                    // (dead JS chunks -> broken signup). Registering the v4
                    // self-destruct worker forces an update check on legacy
                    // clients; explicitly unregister + purge caches as well.
                    navigator.serviceWorker.register('/sw.js').catch(() => {});
                    navigator.serviceWorker.getRegistrations()
                      .then((rs) => rs.forEach((r) => r.unregister()))
                      .catch(() => {});
                    if (window.caches) {
                      caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
                    }
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
