import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { PostHogProvider, PostHogPageView } from "@/components/analytics/PostHogProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "prime-atlas | Find Tomorrow's Winners Before Everyone Else",
    template: "%s | prime-atlas",
  },
  description:
    "Ranked, scored investment markets across Spain, UK, and beyond. Data-driven opportunity index for property developers, capital allocators, and fund managers.",
  keywords: [
    "investment market index",
    "municipality opportunity score",
    "global property investment",
    "UK land registry data",
    "development opportunity index",
    "market ranking tool",
    "real estate opportunity score",
    "capital allocation intelligence",
  ],
  authors: [{ name: "prime-atlas" }],
  creator: "prime-atlas",
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://prime-atlas-weld.vercel.app",
    siteName: "prime-atlas",
    title: "prime-atlas | Ranked Investment Market Index",
    description:
      "Data-driven opportunity scores for property and development markets. Built for investors, developers, and capital allocators.",
  },
  twitter: {
    card: "summary_large_image",
    title: "prime-atlas",
    description: "Find Tomorrow's Winners Before Everyone Else.",
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
