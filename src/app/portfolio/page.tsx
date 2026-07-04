import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { addPortfolioAsset, removePortfolioAsset } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portfolio Monitor | Prime Atlas",
  description: "Ongoing market intelligence for the assets you already own.",
};

function fmtMoney(minor: number | null, currency: string): string {
  if (minor == null) return "—";
  const sym = currency === "GBP" ? "£" : "$";
  const n = minor / 100;
  if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${sym}${Math.round(n / 1_000)}K`;
  return `${sym}${n.toLocaleString()}`;
}

export default async function PortfolioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?redirect=/portfolio");

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();
  const tier = profile?.subscription_tier ?? "free";

  // ── Institutional gate ──────────────────────────────────────────
  if (tier !== "institutional") {
    return (
      <>
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-24 text-center">
          <p className="font-mono text-xs text-pa-green tracking-widest uppercase mb-3">Portfolio Monitor</p>
          <h1 className="text-2xl font-bold mb-3">Ongoing intelligence for assets you already own</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">
            Register your holdings and Prime Atlas watches their markets for you: score
            movements, new planning applications (incoming supply), infrastructure
            spending nearby, and live pricing shifts — a recurring risk radar, not a
            one-time screener. Available on the <strong>Institutional</strong> plan.
          </p>
          <Link
            href="/pricing"
            className="inline-block bg-primary text-white font-semibold text-sm px-6 py-3 rounded-lg hover:bg-primary/85 transition-colors"
          >
            Upgrade to Institutional →
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  // ── Data ────────────────────────────────────────────────────────
  const [{ data: assets }, { data: municipalities }] = await Promise.all([
    supabase
      .from("portfolio_assets")
      .select("id, name, address, purchase_price, currency_code, purchase_date, notes, municipality_id")
      .order("created_at", { ascending: false }),
    supabase
      .from("municipalities")
      .select("id, name, country, opportunity_score, risk_score, growth_score")
      .in("country", ["United Kingdom", "United States"])
      .order("name"),
  ]);

  const marketIds = Array.from(
    new Set((assets ?? []).map((a) => a.municipality_id).filter((x): x is string => !!x))
  );

  type SignalRow = { municipality_id: string; title: string; signal_type: string; opportunity_impact: number; detected_at: string };
  type PlanningRow = { municipality_id: string; project_type: string; status: string; application_date: string };
  type StatsRow = { municipality_id: string | null; median_price: number | null; sale_count: number | null; rent_count: number | null; underpriced_count: number | null; median_ppsqm: number | null };

  let signals: SignalRow[] = [];
  let planning: PlanningRow[] = [];
  let stats: StatsRow[] = [];
  if (marketIds.length) {
    const [sigRes, planRes, statRes] = await Promise.all([
      supabase
        .from("signals")
        .select("municipality_id, title, signal_type, opportunity_impact, detected_at")
        .in("municipality_id", marketIds)
        .order("detected_at", { ascending: false })
        .limit(30),
      supabase
        .from("planning_applications")
        .select("municipality_id, project_type, status, application_date")
        .in("municipality_id", marketIds)
        .order("application_date", { ascending: false })
        .limit(30),
      supabase.from("market_listing_stats").select("*").in("municipality_id", marketIds),
    ]);
    signals = sigRes.data ?? [];
    planning = planRes.data ?? [];
    stats = statRes.data ?? [];
  }

  const marketById = new Map((municipalities ?? []).map((m) => [m.id, m]));
  const signalsByMarket = new Map<string, SignalRow[]>();
  for (const sg of signals) {
    const list = signalsByMarket.get(sg.municipality_id) ?? [];
    if (list.length < 3) { list.push(sg); signalsByMarket.set(sg.municipality_id, list); }
  }
  const planningCount = new Map<string, number>();
  for (const pl of planning) {
    planningCount.set(pl.municipality_id, (planningCount.get(pl.municipality_id) ?? 0) + 1);
  }
  const statsByMarket = new Map(stats.map((s) => [s.municipality_id, s]));

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-10">
          <p className="font-mono text-xs text-pa-green tracking-widest uppercase mb-2">
            Portfolio Monitor · Institutional
          </p>
          <h1 className="text-2xl font-bold">Your assets, watched around the clock</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Market scores, incoming supply, and live pricing for every market where you hold assets.
          </p>
        </div>

        {/* ── Add asset ── */}
        <form
          action={addPortfolioAsset}
          className="border border-border rounded-xl p-5 bg-card mb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3"
        >
          <input
            name="name" required placeholder="Asset name *"
            className="lg:col-span-2 bg-secondary border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pa-green/50"
          />
          <select
            name="municipality_id"
            className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
            defaultValue=""
          >
            <option value="">Market…</option>
            {(municipalities ?? []).map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.country === "United Kingdom" ? "UK" : "US"})</option>
            ))}
          </select>
          <input
            name="purchase_price" placeholder="Purchase price" inputMode="decimal"
            className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          <select name="currency_code" className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none" defaultValue="USD">
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
          <button
            type="submit"
            className="bg-primary text-white font-semibold text-sm rounded-lg px-4 py-2 hover:bg-primary/85 transition-colors"
          >
            Add asset
          </button>
        </form>

        {/* ── Assets ── */}
        {(assets ?? []).length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
            No assets yet — add your first holding above and Prime Atlas starts watching its market.
          </div>
        ) : (
          <div className="space-y-5">
            {(assets ?? []).map((asset) => {
              const market = asset.municipality_id ? marketById.get(asset.municipality_id) : null;
              const st = asset.municipality_id ? statsByMarket.get(asset.municipality_id) : null;
              const sigs = asset.municipality_id ? (signalsByMarket.get(asset.municipality_id) ?? []) : [];
              const newSupply = asset.municipality_id ? (planningCount.get(asset.municipality_id) ?? 0) : 0;
              return (
                <div key={asset.id} className="border border-border rounded-xl bg-card overflow-hidden">
                  <div className="flex items-start justify-between px-5 py-4 border-b border-border">
                    <div>
                      <p className="font-semibold text-sm">{asset.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {market ? `${market.name}, ${market.country}` : "No market linked"}
                        {asset.purchase_price ? ` · acquired ${fmtMoney(asset.purchase_price, asset.currency_code)}` : ""}
                        {asset.purchase_date ? ` · ${asset.purchase_date}` : ""}
                      </p>
                    </div>
                    <form action={removePortfolioAsset}>
                      <input type="hidden" name="id" value={asset.id} />
                      <button className="text-xs text-muted-foreground hover:text-pa-red transition-colors">Remove</button>
                    </form>
                  </div>

                  {market && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-border border-b border-border">
                      <div className="px-5 py-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Market score</p>
                        <p className="text-lg font-bold">{market.opportunity_score}<span className="text-xs text-muted-foreground">/100</span></p>
                      </div>
                      <div className="px-5 py-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Risk</p>
                        <p className={`text-lg font-bold ${market.risk_score > 60 ? "text-pa-red" : ""}`}>{market.risk_score}<span className="text-xs text-muted-foreground">/100</span></p>
                      </div>
                      <div className="px-5 py-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Live median ask</p>
                        <p className="text-lg font-bold">{st?.median_price ? fmtMoney(st.median_price, asset.currency_code) : "—"}</p>
                      </div>
                      <div className="px-5 py-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Incoming supply</p>
                        <p className={`text-lg font-bold ${newSupply > 0 ? "text-pa-amber" : ""}`}>{newSupply}<span className="text-xs text-muted-foreground"> applications</span></p>
                      </div>
                    </div>
                  )}

                  {sigs.length > 0 && (
                    <div className="px-5 py-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Latest signals in this market</p>
                      <ul className="space-y-1.5">
                        {sigs.map((sg, i) => (
                          <li key={i} className="text-xs flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sg.opportunity_impact >= 60 ? "bg-pa-green" : "bg-pa-amber"}`} />
                            <span className="flex-1 truncate">{sg.title}</span>
                            <span className="text-muted-foreground flex-shrink-0">
                              {new Date(sg.detected_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground mt-8 leading-relaxed">
          Portfolio data is private to your account (row-level security). Market intelligence is
          index-based and heuristic — verify before acting. Not investment advice.
        </p>
      </main>
      <Footer />
    </>
  );
}
