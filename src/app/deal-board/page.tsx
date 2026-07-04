import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { DealBoard } from "@/components/deal-board/DealBoard";
import type { DealRow, LiveOpportunity } from "@/components/deal-board/DealBoard";

export const metadata: Metadata = {
  title: "Deal Board | prime-atlas",
  description: "Site-acquisition terminal. Ranked markets by ROI, zoning momentum, and demand pressure.",
};

export const dynamic = "force-dynamic";

export default async function DealBoardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?redirect=/deal-board");

  const [profileRes, municipalitiesRes, freshnessRes, opportunitiesRes] = await Promise.all([
    supabase.from("profiles").select("subscription_tier").eq("id", user.id).single(),
    supabase.from("municipalities").select(
      `id, name, region, country, currency_code,
       opportunity_score, growth_score, infrastructure_score,
       development_score, liquidity_score, risk_score,
       population, retrieved_at, source_name, data_confidence, slug`
    ).in("country", ["United Kingdom", "United States"])
     .order("opportunity_score", { ascending: false }).limit(120),
    supabase.from("data_freshness").select("market_iso2, last_updated"),
    supabase.from("opportunities")
      .select("id, municipality_id, title, category, opportunity_score, risk_level, source_name, source_url")
      .eq("status", "active")
      .order("opportunity_score", { ascending: false }),
  ]);

  const tier = (profileRes.data?.subscription_tier ?? "free") as
    "free" | "explorer" | "professional" | "institutional";

  const isoToCountry: Record<string, string> = {
    GB: "United Kingdom", US: "United States",
  };
  const freshnessMap: Record<string, string> = {};
  for (const f of (freshnessRes.data ?? []) as Array<{ market_iso2: string; last_updated: string | null }>) {
    const country = isoToCountry[f.market_iso2];
    if (country && f.last_updated) freshnessMap[country] = f.last_updated;
  }

  const rows = (municipalitiesRes.data ?? []).map((m) => ({
    ...m,
    currency_code:   m.currency_code   ?? "USD",
    source_name:     m.source_name     ?? "manual",
    data_confidence: m.data_confidence ?? 0.5,
    retrieved_at:    m.retrieved_at    ?? null,
  })) as DealRow[];

  // Build opportunities map keyed by municipality_id
  const opportunitiesMap: Record<string, LiveOpportunity[]> = {};
  for (const opp of (opportunitiesRes.data ?? []) as LiveOpportunity[]) {
    if (opp.municipality_id) {
      if (!opportunitiesMap[opp.municipality_id]) opportunitiesMap[opp.municipality_id] = [];
      opportunitiesMap[opp.municipality_id].push(opp);
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F1A]">
      <DealBoard rows={rows} tier={tier} freshnessMap={freshnessMap} userEmail={user.email} opportunitiesMap={opportunitiesMap} />
    </div>
  );
}
