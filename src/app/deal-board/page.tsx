import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { DealBoard } from "@/components/deal-board/DealBoard";
import type { DealRow } from "@/components/deal-board/DealBoard";

export const metadata: Metadata = {
  title: "Deal Board | prime-atlas",
  description: "Site-acquisition terminal. Ranked markets by ROI, zoning momentum, and demand pressure.",
};

export const dynamic = "force-dynamic";

export default async function DealBoardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?redirect=/deal-board");

  const [profileRes, municipalitiesRes, freshnessRes] = await Promise.all([
    supabase.from("profiles").select("subscription_tier").eq("id", user.id).single(),
    supabase.from("municipalities").select(
      `id, name, region, country, currency_code,
       opportunity_score, growth_score, infrastructure_score,
       development_score, liquidity_score, risk_score,
       population, retrieved_at, source_name, data_confidence, slug`
    ).order("opportunity_score", { ascending: false }).limit(100),
    supabase.from("data_freshness").select("market_iso2, last_updated"),
  ]);

  const tier = (profileRes.data?.subscription_tier ?? "free") as
    "free" | "pro" | "investor" | "institutional";

  const isoToCountry: Record<string, string> = {
    ES: "Spain", GB: "United Kingdom", US: "United States",
    AU: "Australia", CA: "Canada",
  };
  const freshnessMap: Record<string, string> = {};
  for (const f of (freshnessRes.data ?? []) as Array<{ market_iso2: string; last_updated: string | null }>) {
    const country = isoToCountry[f.market_iso2];
    if (country && f.last_updated) freshnessMap[country] = f.last_updated;
  }

  const rows = (municipalitiesRes.data ?? []).map((m) => ({
    ...m,
    currency_code:   m.currency_code   ?? "EUR",
    source_name:     m.source_name     ?? "manual",
    data_confidence: m.data_confidence ?? 0.5,
    retrieved_at:    m.retrieved_at    ?? null,
  })) as DealRow[];

  return (
    <div className="min-h-screen bg-[#0B0F1A]">
      <DealBoard rows={rows} tier={tier} freshnessMap={freshnessMap} userEmail={user.email} />
    </div>
  );
}
