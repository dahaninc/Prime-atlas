import Link from "next/link";
import { cn, scoreColor } from "@/lib/utils";
import type { Opportunity } from "@/types";

interface OpportunityCardProps {
  opportunity: Opportunity & {
    municipality?: { name: string; region: string } | null;
  };
  rank?: number;
  className?: string;
}

const RISK_COLORS = {
  low: "text-pa-green border-pa-green/30 bg-pa-green/5",
  medium: "text-pa-amber border-pa-amber/30 bg-pa-amber/5",
  high: "text-pa-red border-pa-red/30 bg-pa-red/5",
  very_high: "text-pa-red border-pa-red/40 bg-pa-red/10",
};

export function OpportunityCard({ opportunity, rank, className }: OpportunityCardProps) {
  const slug = opportunity.municipality?.name?.toLowerCase().replace(/\s+/g, "-") ?? opportunity.municipality_id;

  return (
    <Link
      href={`/opportunities/${slug}`}
      className={cn(
        "block border border-border rounded-lg p-5 bg-card hover:border-pa-green/40 hover:bg-card/80 transition-all group",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          {rank && (
            <span className="text-xs text-muted-foreground font-mono mb-1 block">#{rank}</span>
          )}
          <h3 className="font-semibold text-sm leading-snug group-hover:text-pa-green transition-colors line-clamp-2">
            {opportunity.title}
          </h3>
          {opportunity.municipality && (
            <p className="text-xs text-muted-foreground mt-1">
              {opportunity.municipality.name} · {opportunity.municipality.region}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <p className={cn("text-2xl font-bold font-mono", scoreColor(opportunity.opportunity_score))}>
            {opportunity.opportunity_score}
          </p>
          <p className="text-xs text-muted-foreground">score</p>
        </div>
      </div>

      {/* Thesis preview */}
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-4">
        {opportunity.investment_thesis}
      </p>

      {/* Footer chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs border border-border rounded px-2 py-0.5 text-muted-foreground">
          {opportunity.category}
        </span>
        <span className={cn("text-xs border rounded px-2 py-0.5 font-medium", RISK_COLORS[opportunity.risk_level])}>
          {opportunity.risk_level.replace("_", " ")} risk
        </span>
      </div>
    </Link>
  );
}
