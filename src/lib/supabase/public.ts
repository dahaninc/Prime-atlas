import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Cookie-less Supabase client for PUBLIC data on cacheable pages.
 *
 * Unlike `@/lib/supabase/server`, this never touches `cookies()`, so pages
 * using it can be statically rendered / ISR-cached by Next.js and served
 * from Vercel's CDN instead of hitting Supabase on every request.
 *
 * Only use it for data covered by public RLS SELECT policies — it always
 * queries as the anonymous role.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
