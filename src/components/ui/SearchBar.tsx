"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "municipality" | "opportunity";
  name: string;
  subtitle: string;
  score: number;
  slug: string;
}

export function SearchBar({ className }: { className?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return; }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const [{ data: munis }, { data: opps }] = await Promise.all([
          supabase
            .from("municipalities")
            .select("id, name, region, opportunity_score")
            .ilike("name", `%${query}%`)
            .order("opportunity_score", { ascending: false })
            .limit(4),
          supabase
            .from("opportunities")
            .select("id, title, category, opportunity_score, municipalities(name)")
            .ilike("title", `%${query}%`)
            .eq("status", "active")
            .order("opportunity_score", { ascending: false })
            .limit(3),
        ]);

        const combined: SearchResult[] = [
          ...(munis ?? []).map((m) => ({
            id: m.id,
            type: "municipality" as const,
            name: m.name,
            subtitle: m.region,
            score: m.opportunity_score,
            slug: `/opportunities/${m.name.toLowerCase().replace(/\s+/g, "-")}`,
          })),
          ...(opps ?? []).map((o) => ({
            id: o.id,
            type: "opportunity" as const,
            name: o.title,
            subtitle: `${(o.municipalities as { name: string } | null)?.name ?? ""} · ${o.category}`,
            score: o.opportunity_score,
            slug: `/opportunities/${(o.municipalities as { name: string } | null)?.name?.toLowerCase().replace(/\s+/g, "-") ?? o.id}`,
          })),
        ];
        setResults(combined);
        setOpen(combined.length > 0);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search municipalities, opportunities…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="w-full bg-secondary border border-border rounded-lg pl-9 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pa-green/50 focus:border-pa-green/50 transition-colors"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border border-pa-green border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
          {results.map((r) => (
            <button
              key={r.id}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary transition-colors text-left border-b border-border last:border-0"
              onClick={() => { router.push(r.slug); setOpen(false); setQuery(""); }}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">
                    {r.type === "municipality" ? "Place" : "Opp"}
                  </span>
                  <span className="text-sm font-medium">{r.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{r.subtitle}</p>
              </div>
              <span className="text-pa-green font-mono font-bold text-sm ml-4">{r.score}</span>
            </button>
          ))}
          <div className="px-4 py-2 bg-secondary/50">
            <p className="text-xs text-muted-foreground">Free tier search · <a href="/pricing" className="text-pa-green hover:underline">Upgrade for advanced filters</a></p>
          </div>
        </div>
      )}
    </div>
  );
}
