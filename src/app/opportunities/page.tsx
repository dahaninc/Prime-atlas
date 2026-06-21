import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { OpportunityCard } from "@/components/ui/OpportunityCard";
import { SearchBar } from "@/components/ui/SearchBar";
import type { Opportunity } from "@/types";

export const metadata: Metadata = {
  title: "Investment Opportunities in Spain 2026 | prime-atlas",
  description:
    "Ranked investment opportunities across Spanish municipalities. AI-generated investment theses, opportunity scores, and supporting evidence. Costa Blanca, Alicante, Valencia.",
};

export const revalidate = 3600;

export default async function OpportunitiesPage() {
  const supabase = await createClient();

  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("*, municipalities(name, region)")
    .eq("status", "active")
    .order("opportunity_score", { ascending: false })
    .limit(20);

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <nav className="text-xs text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <span>Opportunities</span>
      </nav>

      <div className="mb-8">
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-2">
          prime-atlas · {opportunities?.length ?? 0} active opportunities
        </p>
        <h1 className="text-4xl font-bold mb-3">Investment Opportunities</h1>
        <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed">
          Every opportunity includes an AI-generated investment thesis, opportunity score, risk rating,
          and supporting evidence. Ranked by conviction score.
        </p>
      </div>

      {/* Search */}
      <SearchBar className="mb-8 max-w-lg" />

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap mb-6">
        {["All", "Coastal", "Industrial", "Infrastructure", "Residential"].map((cat) => (
          <button key={cat}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              cat === "All"
                ? "border-pa-green/40 bg-pa-green/10 text-pa-green"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(opportunities as (Opportunity & { municipalities: { name: string; region: string } | null })[])?.map((opp, i) => (
          <OpportunityCard
            key={opp.id}
            opportunity={{ ...opp, municipality: opp.municipalities }}
            rank={i + 1}
          />
        ))}
      </div>

      {/* Upgrade prompt */}
      <div className="mt-12 p-6 border border-dashed border-border rounded-xl text-center">
        <p className="text-sm font-semibold mb-1">Unlock the Opportunity Finder</p>
        <p className="text-xs text-muted-foreground mb-4">
          Pro subscribers input budget, geography, and risk profile — prime-atlas returns a personalised ranked list with full theses.
        </p>
        <Link href="/auth/signup" className="inline-block bg-pa-green text-pa-navy font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-pa-green/90 transition-colors">
          Upgrade to Pro — €149/mo
        </Link>
      </div>
    </main>
  );
}
