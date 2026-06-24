import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a score 0–100 with a colour class */
export function scoreColor(score: number): string {
  if (score >= 75) return "text-pa-green";
  if (score >= 50) return "text-pa-amber";
  return "text-pa-red";
}

/** Score band label */
export function scoreBand(score: number): "High" | "Medium" | "Low" {
  if (score >= 75) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}

/** Format EUR (legacy — prefer formatCurrency) */
export function formatEur(amount: number): string {
  return formatCurrency(amount, "EUR");
}

/** Format a monetary amount with the correct currency symbol */
export function formatCurrency(amount: number, currencyCode = "EUR"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currencyCode,
    notation: amount >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: amount >= 1_000_000 ? 1 : 0,
  }).format(amount);
}

/** Format a date to readable string */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Weighted composite score */
export function computeOpportunityScore(scores: {
  growth_score: number;
  infrastructure_score: number;
  development_score: number;
  liquidity_score: number;
  risk_score: number;
}, weights = { growth: 0.25, infrastructure: 0.25, development: 0.25, liquidity: 0.15, risk: 0.10 }): number {
  const { growth_score, infrastructure_score, development_score, liquidity_score, risk_score } = scores;
  // Risk inverted: high risk reduces score
  const riskAdj = (100 - risk_score) * weights.risk;
  return Math.round(
    growth_score * weights.growth +
    infrastructure_score * weights.infrastructure +
    development_score * weights.development +
    liquidity_score * weights.liquidity +
    riskAdj
  );
}
