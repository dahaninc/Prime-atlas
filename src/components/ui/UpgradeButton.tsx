"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { analytics } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface Props {
  source: string;           // where the button lives, e.g. "signals_feed"
  currentTier?: string;
  targetTier?: string;
  hasCustomer?: boolean;
  label?: string;
  className?: string;
  variant?: "primary" | "outline" | "ghost";
}

export function UpgradeButton({
  source,
  currentTier = "free",
  targetTier = "professional",
  hasCustomer = false,
  label = "Upgrade to Professional",
  className,
  variant = "primary",
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    analytics.upgradeClicked({ source, current_tier: currentTier, target_tier: targetTier });

    if (hasCustomer) {
      setLoading(true);
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
      setLoading(false);
      return;
    }

    setLoading(true);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: targetTier }),
    });
    const json = await res.json();
    if (json.url) window.location.href = json.url;
    else router.push("/pricing");
    setLoading(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-2 font-semibold text-sm rounded-lg px-4 py-2.5 transition-colors disabled:opacity-60",
        variant === "primary" && "bg-primary text-white hover:bg-primary/85",
        variant === "outline" && "border border-pa-green/40 text-pa-green hover:bg-pa-green/5",
        variant === "ghost"   && "text-pa-green hover:underline px-0 py-0",
        className
      )}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {label}
    </button>
  );
}
