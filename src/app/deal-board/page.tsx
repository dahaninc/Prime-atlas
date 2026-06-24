import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { DealBoard } from "@/components/deal-board/DealBoard";
import type { DealRow } from "@/components/deal-board/DealBoard";

export const metadata: Metadata = {
  title: "Deal Board | prime-atlas",
  description:
    "Ranked investment markets by opportunity score. Filter, sort, and model ROI across Spain, UK, and beyond.",
};

export const revalidate = 1800; // 30 min

export default async function DealBoardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?redirect=/deal-board");

  const [profileRes, municipalitiesRes, freshnessRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single(),

    supabase
      .from("municipalities")
      .select(
        `id, name, region, country, currency_code,
         opportunity_score, growth_score, infrastructure_score,
         development_score, liquidity_score, risk_score,
         population, retrieved_at, source_name, data_confidence, slug`
      )
      .order("opportunity_score", { ascending: false })
      .limit(100),

    supabase
      .from("data_freshness")
      .select("market_iso2, last_updated"),
  ]);

  const tier = (profileRes.data?.subscription_tier ?? "free") as
    | "free"
    | "pro"
    | "investor"
    | "institutional";

  // Build freshness map: country ISO2 → last_updated
  const freshnessRows = (freshnessRes.data ?? []) as Array<{
    market_iso2: string;
    last_updated: string | null;
  }>;
  const freshnessMap: Record<string, string> = {};
  const isoToCountry: Record<string, string> = {
    ES: "Spain",
    GB: "United Kingdom",
    US: "United States",
    AU: "Australia",
    CA: "Canada",
  };
  for (const f of freshnessRows) {
    const country = isoToCountry[f.market_iso2];
    if (country && f.last_updated) freshnessMap[country] = f.last_updated;
  }

  const rows = (municipalitiesRes.data ?? []).map((m) => ({
    ...m,
    currency_code: m.currency_code ?? "EUR",
    source_name: m.source_name ?? "manual",
    data_confidence: m.data_confidence ?? 0.5,
    retrieved_at: m.retrieved_at ?? null,
  })) as DealRow[];

  return (
    <>
      <Navbar user={user} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-2">
            Deal Board
          </p>
          <h1 className="text-3xl font-bold mb-2">Ranked Markets</h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Scored by growth, infrastructure, development, liquidity, and risk.{" "}
            {tier === "free"
              ? "Top 5 markets shown — upgrade for full access and pro-forma modelling."
              : "Click a row to model ROI and export an IC memo."}
          </p>
        </div>

        <DealBoard rows={rows} tier={tier} freshnessMap={freshnessMap} />

        {/* Data provenance footer */}
        <div className="mt-8 p-4 border border-border/50 rounded-lg">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            <strong>Data provenance:</strong> Scores are derived from publicly available
            data sources indicated in each row. This is an index — not a live data feed.
            Freshness indicators show when data was last ingested. prime-atlas does not
            guarantee accuracy or completeness. Nothing here constitutes investment advice.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
