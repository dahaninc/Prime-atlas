import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { PostHogProvider, PostHogPageView } from "@/components/analytics/PostHogProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "prime-atlas | Find Tomorrow's Winners Before Everyone Else",
    template: "%s | prime-atlas",
  },
  description:
    "The Bloomberg for Future Investment Opportunities. Discover ranked, scored investment opportunities in municipalities and regions before the market recognises them.",
  keywords: [
    "investment opportunities",
    "municipality investment",
    "Spain property investment",
    "development opportunities",
    "Costa Blanca investment",
    "Alicante real estate",
    "Valencia development",
    "opportunity score",
  ],
  authors: [{ name: "prime-atlas" }],
  creator: "prime-atlas",
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://prime-atlas.com",
    siteName: "prime-atlas",
    title: "prime-atlas | Find Tomorrow's Winners Before Everyone Else",
    description:
      "Ranked investment opportunities with AI-generated thesis, opportunity scores, and real-time signals. Built for investors, developers, and capital allocators.",
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
        </PostHogProvider>
      </body>
    </html>
  );
}
