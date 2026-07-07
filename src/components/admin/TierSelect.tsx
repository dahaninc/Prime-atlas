"use client";

import { useState, useTransition } from "react";
import { setUserTier } from "@/app/admin/actions";
import { toast } from "@/components/ui/Toaster";

const TIER_COLORS: Record<string, string> = {
  institutional: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  professional:  "text-primary bg-primary/10 border-primary/25",
  explorer:      "text-purple-400 bg-purple-500/10 border-purple-500/25",
  free:          "text-zinc-500 bg-background border-border",
};

const TIERS = ["free", "explorer", "professional", "institutional"] as const;

export function TierSelect({ userId, initialTier }: { userId: string; initialTier: string }) {
  const [tier, setTier] = useState(initialTier);
  const [pending, startTransition] = useTransition();

  function handleChange(next: string) {
    const prev = tier;
    setTier(next);
    startTransition(async () => {
      const res = await setUserTier(userId, next);
      if (!res.ok) {
        setTier(prev);
        toast(res.error ?? "Could not update tier — try again", "error");
      } else {
        toast(`Tier set to ${next}`);
      }
    });
  }

  return (
    <select
      value={tier}
      disabled={pending}
      onChange={(e) => handleChange(e.target.value)}
      className={`text-[9px] font-bold border rounded px-2 py-0.5 uppercase tracking-wider bg-transparent focus:outline-none disabled:opacity-50 ${TIER_COLORS[tier] ?? TIER_COLORS.free}`}
    >
      {TIERS.map((t) => (
        <option key={t} value={t} className="bg-background text-zinc-200 normal-case">
          {t}
        </option>
      ))}
    </select>
  );
}
