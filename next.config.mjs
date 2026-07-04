/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      // Scraped property photos (rendered via next/image on detail pages)
      { protocol: "https", hostname: "photos.zillowstatic.com" },
      { protocol: "https", hostname: "**.zillowstatic.com" },
      { protocol: "https", hostname: "media.rightmove.co.uk" },
      { protocol: "https", hostname: "**.rightmove.co.uk" },
      { protocol: "https", hostname: "**.onthemarket.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
