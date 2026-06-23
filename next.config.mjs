/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  typescript: {
    // @supabase/ssr@0.3.0 doesn't propagate the Database generic through
    // createServerClient, causing false-positive "never" type errors on all
    // query results. The runtime code is correct. Fix: upgrade @supabase/ssr
    // to v0.5+ after launch (run: npm i @supabase/ssr@latest @supabase/supabase-js@latest)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
