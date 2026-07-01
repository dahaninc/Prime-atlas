import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { scoreColor } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Property Investment Opportunities | Prime Atlas",
  description:
    "Real estate investment opportunities across the UK and USA — categorised by BTR, PBSA, Affordable Housing, Commercial, Industrial, and Mixed-use. Scored and sourced from official planning portals.",
};

export const dynamic = "force-dynamic";

const CATEGORIES = [
  { key: "All",              label: "All",                 },
  { key: "BTR",              label: "BTR",                 },
  { key: "PBSA",             label: "PBSA",                },
  { key: "Affordable Housing",label: "Affordable Housing", },
  { key: "Commercial",       label: "Commercial",          },
  { key: "Industrial",       label: "Industrial",          },
  { key: "Mixed-use",        label: "Mixed-use",           },
  { key: "Land & Development",label: "Land",               },
];

const COUNTRY_FLAG: Record<string, string> = {
  "United Kingdom": "🇬🇧",
  "United States":  "🇺🇸",
};

type PageProps = {
  searchParams: Promise<{ category?: string }>;
};

export default async function OpportunitiesPage({ searchParams }: PageProps) {
  const { category } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("opportunities")
    .select("id, title, category, opportunity_score, risk_level, source_name, source_url, municipalities(name, region, country, slug)")
    .eq("status", "active")
    .order("opportunity_score", { ascending: false })
    .limit(60);

  if (category && category !== "All") {
    query = query.eq("category", category);
  }

  const { data: opportunities } = await query;

  const activeCategory = category && category !== "All" ? category : "All";

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      {/* Breadcrumb */}
      <nav className="text-xs text-muted-foreground mb-6 flex items-center gap-2">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span>/</span>
        <span>Opportunities</span>
        {category && category !== "All" && (
          <>
            <span>/</span>
            <span>{category}</span>
          </>
        )}
      </nav>

      <div className="mb-6">
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-2">
          prime-atlas · {opportunities?.length ?? 0} opportunities{category && category !== "All" ? ` · ${category}` : ""}
        </p>
        <h1 className="text-3xl font-bold mb-2">
          {category && category !== "All" ? `${category} Opportunities` : "All Investment Opportunities"}
        </h1>
        <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed">
          Real estate investment opportunities across the UK and USA, scored on the Prime Atlas conviction framework.
          Each opportunity is enriched with macro/micro outlook and exit projections.
        </p>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap mb-8">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.key}
            href={cat.key === "All" ? "/opportunities" : `/opportunities?category=${encodeURIComponent(cat.key)}`}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              activeCategory === cat.key
                ? "border-pa-green/40 bg-pa-green/10 text-pa-green"
                : "border-border text-muted-foreground hover:text-foreground hover:border-pa-green/20"
            }`}
          >
            {cat.label}
          </Link>
        ))}
      </div>

      {/* Cards */}
      {opportunities && opportunities.length > 0 ? (
        <div className="space-y-3">
          {(opportunities as Array<{
            id: string; title: string; category: string; opportunity_score: number;
            risk_level: string; source_name: string | null; source_url: string | null;
            municipalities: { name: string; region: string; country: string; slug: string } | null;
          }>).map((opp) => {
            const muni = opp.municipalities;
            return (
              <div key={opp.id} className="border border-border rounded-xl p-5 bg-card hover:border-pa-green/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {/* Tags */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-[10px] font-mono border border-border rounded px-2 py-0.5 text-muted-foreground">
                        {opp.category}
                      </span>
                      <span className={`text-[10px] font-medium rounded px-2 py-0.5 ${
                        opp.risk_level === "low"
                          ? "bg-pa-green/10 text-pa-green"
                          : opp.risk_level === "medium"
                          ? "bg-pa-amber/10 text-pa-amber"
                          : "bg-red-500/10 text-red-400"
                      }`}>
                        {opp.risk_level} risk
                      </span>
                      {muni && (
                        <span className="text-[10px] text-muted-foreground">
                          {COUNTRY_FLAG[muni.country] ?? "🌍"} {muni.name}, {muni.region}
                        </span>
                      )}
                    </div>
                    {/* Title */}
                    {muni ? (
                      <Link href={`/opportunities/${muni.slug}`} className="font-semibold text-sm hover:text-pa-green transition-colors">
                        {opp.title}
                      </Link>
                    ) : (
                      <p className="font-semibold text-sm">{opp.title}</p>
                    )}
                    {/* Source name only — no external URL */}
                    {opp.source_name && (
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        Data: {opp.source_name}
                      </p>
                    )}
                  </div>
                  {/* Score */}
                  <div className="flex-shrink-0 text-center">
                    <p className={`text-2xl font-bold font-mono ${scoreColor(opp.opportunity_score)}`}>
                      {opp.opportunity_score}
                    </p>
                    <p className="text-[9px] text-muted-foreground">score</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-xl p-12 text-center">
          <p className="text-sm font-medium mb-1">No opportunities in this category yet</p>
          <p className="text-xs text-muted-foreground mb-4">Try another category or browse all.</p>
          <Link href="/opportunities" className="text-xs text-pa-green hover:underline">View all opportunities →</Link>
        </div>
      )}

      {/* CTA */}
      <div className="mt-10 p-6 border border-dashed border-border rounded-xl text-center">
        <p className="text-sm font-semibold mb-1">View live market scores in the Deal Board</p>
        <p className="text-xs text-muted-foreground mb-4">
          The Deal Board ranks all 58 markets with editable pro-forma, evidence layers, and IC memo export.
        </p>
        <Link href="/deal-board" className="inline-block bg-pa-green text-pa-navy font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-pa-green/90 transition-colors">
          Open Deal Board →
        </Link>
      </div>
    </main>
  );
}
