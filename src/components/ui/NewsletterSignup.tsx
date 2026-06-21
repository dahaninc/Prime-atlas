"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  source?: string;
  className?: string;
  compact?: boolean;
}

export function NewsletterSignup({ source = "footer", className, compact = false }: Props) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setState("loading");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Subscribe failed");
      }
      setState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className="text-pa-green text-sm font-medium">✓ You're in — check your inbox.</span>
      </div>
    );
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className={cn("flex gap-2", className)}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="flex-1 min-w-0 bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pa-green/50"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="bg-pa-green text-pa-navy font-semibold text-sm px-4 py-2 rounded-lg hover:bg-pa-green/90 transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {state === "loading" ? "…" : "Subscribe"}
        </button>
      </form>
    );
  }

  return (
    <div className={cn("border border-border rounded-xl bg-card p-6", className)}>
      <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-2">Weekly intelligence</p>
      <h3 className="font-bold text-lg mb-1">The Spain Opportunity Digest</h3>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        Ranked opportunities, live signals, and AI-generated investment theses — delivered every Monday morning.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
          placeholder="your@email.com"
          required
          className="flex-1 min-w-0 bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-pa-green/50"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="bg-pa-green text-pa-navy font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-pa-green/90 transition-colors disabled:opacity-60"
        >
          {state === "loading" ? "…" : "Subscribe free"}
        </button>
      </form>
      {state === "error" && (
        <p className="text-xs text-red-400 mt-2">{errorMsg}</p>
      )}
      <p className="text-xs text-muted-foreground mt-3">Free forever. Unsubscribe anytime.</p>
    </div>
  );
}
