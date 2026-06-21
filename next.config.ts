import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Progressive Web App is handled via public/manifest.json + service worker
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  // Incremental Static Regeneration for SEO pages
  experimental: {
    ppr: false,
  },
};

export default nextConfig;
