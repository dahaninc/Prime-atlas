import type { Metadata } from "next";
import { redirect }      from "next/navigation";
import { createClient as createSsrClient } from "@/lib/supabase/server";
import { createClient }  from "@supabase/supabase-js";
import { ScraperDashboard } from "@/components/admin/ScraperDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scraper Health | Prime Atlas Admin",
};

export default async function AdminScrapersPage() {
  // ── Auth gate — admin emails only ────────────────────────────────────────
  const ADMIN_EMAILS = ["admin@prime-atlas.io"];

  const ssrClient = await createSsrClient();
  const { data: { user } } = await ssrClient.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email ?? "")) redirect("/auth/login");

  // ── Service-role client bypasses RLS on scraper_runs ─────────────────────
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Fetch last 100 runs across all providers
  const { data: runs, error } = await supabase
    .from("scraper_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[admin/scrapers] fetch error:", error.message);
  }

  // Latest run per provider for the status card strip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestByProvider: Record<string, any> = {};
  for (const run of (runs ?? [])) {
    if (!latestByProvider[run.provider]) {
      latestByProvider[run.provider] = run;
    }
  }

  return (
    <ScraperDashboard
      runs={runs ?? []}
      latestByProvider={latestByProvider}
    />
  );
}
