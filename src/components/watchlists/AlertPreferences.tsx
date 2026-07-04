"use client";

import { useState, useTransition } from "react";
import { updateAlertPreferences } from "@/app/watchlists/actions";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface AlertPrefs {
  email_alerts: boolean;
  signal_threshold: number;
  alert_frequency: "immediate" | "daily" | "weekly";
}

interface Props {
  initialPrefs: AlertPrefs;
  isPro: boolean;
}

const FREQUENCIES = [
  { value: "immediate", label: "Immediately",  desc: "The moment it's detected" },
  { value: "daily",     label: "Daily digest", desc: "One email per day, 8am" },
  { value: "weekly",    label: "Weekly digest", desc: "Monday morning briefing" },
] as const;

export function AlertPreferences({ initialPrefs, isPro }: Props) {
  const [prefs, setPrefs] = useState<AlertPrefs>(initialPrefs);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await updateAlertPreferences(prefs);
      setSaved(true);
      toast("Alert preferences saved");
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="font-semibold text-sm">Alert Preferences</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Control when and how you hear about new signals.
        </p>
      </div>

      <div className="p-5 space-y-5">
        {!isPro && (
          <div className="p-3 border border-pa-amber/30 bg-pa-amber/5 rounded-lg">
            <p className="text-xs text-pa-amber font-medium mb-1">Pro feature</p>
            <p className="text-xs text-muted-foreground">
              Email alerts require a Pro subscription.{" "}
              <Link href="/pricing" className="text-pa-green hover:underline">Upgrade →</Link>
            </p>
          </div>
        )}

        {/* Email toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Email alerts</p>
            <p className="text-xs text-muted-foreground mt-0.5">Receive signal alerts by email</p>
          </div>
          <button
            onClick={() => setPrefs((p) => ({ ...p, email_alerts: !p.email_alerts }))}
            disabled={!isPro}
            className={cn(
              "relative w-11 h-6 rounded-full transition-colors disabled:opacity-40",
              prefs.email_alerts ? "bg-primary" : "bg-secondary border border-border"
            )}
            aria-checked={prefs.email_alerts}
            role="switch"
          >
            <span className={cn(
              "absolute top-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform",
              prefs.email_alerts ? "translate-x-5" : "translate-x-0.5"
            )} />
          </button>
        </div>

        {/* Minimum impact threshold */}
        <div>
          <div className="flex justify-between mb-2">
            <p className="text-sm font-medium">Signal impact threshold</p>
            <span className="text-pa-green font-mono font-bold text-sm">{prefs.signal_threshold}</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Only alert for signals scoring above this impact</p>
          <input
            type="range"
            min={0}
            max={90}
            step={5}
            value={prefs.signal_threshold}
            onChange={(e) => setPrefs((p) => ({ ...p, signal_threshold: Number(e.target.value) }))}
            disabled={!isPro}
            className="w-full accent-pa-green disabled:opacity-40"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>All signals</span>
            <span>High impact only</span>
          </div>
        </div>

        {/* Frequency */}
        <div>
          <p className="text-sm font-medium mb-3">Alert frequency</p>
          <div className="space-y-2">
            {FREQUENCIES.map((f) => (
              <button
                key={f.value}
                onClick={() => setPrefs((p) => ({ ...p, alert_frequency: f.value }))}
                disabled={!isPro}
                className={cn(
                  "w-full text-left border rounded-lg px-4 py-2.5 transition-all disabled:opacity-40",
                  prefs.alert_frequency === f.value
                    ? "border-pa-green/50 bg-pa-green/5"
                    : "border-border hover:bg-secondary/50"
                )}
              >
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!isPro || isPending}
          className="w-full bg-primary text-white font-semibold text-sm py-2.5 rounded-lg hover:bg-primary/85 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {isPending && <span className="w-3.5 h-3.5 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />}
          {saved ? "✓ Saved" : isPending ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </div>
  );
}
