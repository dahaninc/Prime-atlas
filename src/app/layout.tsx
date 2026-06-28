import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { PostHogProvider, PostHogPageView } from "@/components/analytics/PostHogProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { BottomNav } from "@/components/layout/BottomNav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-playfair",
});

export const metadata: Metadata = {
  title: {
    default: "prime-atlas | Real estate conviction — for every investor, at every scale.",
    template: "%s | prime-atlas",
  },
  description:
    "From retail investors spotting emerging markets early to institutional funds closing deals before competitors build a model. Pre-screened pipeline across 80+ markets, live underwrite, IC memo in one click. UK · US · AU · CA · ES.",
  keywords: [
    "real estate investment conviction",
    "IC memo generator real estate",
    "real estate deal screening",
    "property investment analysis",
    "site acquisition decision tool",
    "go no-go site analysis",
    "development site pre-screening",
    "investment committee memo",
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
      "Pre-screened pipeline across 80+ markets, live preliminary underwrite, IC memo in one click. For retail investors, developers, and institutional funds. UK · US · AU · CA · ES.",
  },
  twitter: {
    card: "summary_large_image",
    title: "prime-atlas",
    description: "Real estate conviction for every investor. Pre-screened pipeline, live underwrite, IC memo same day. 80+ markets across UK, US, AU, CA, ES.",
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
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased min-h-screen pb-[env(safe-area-inset-bottom)] md:pb-0`}>
        <PostHogProvider>
          <AuthProvider>
          <Suspense fallback={null}><PostHogPageView /></Suspense>
          <div className="pb-20 md:pb-0">
            {children}
          </div>
          <BottomNav />
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
