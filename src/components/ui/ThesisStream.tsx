"use client";

import { useEffect, useState, useCallback } from "react";
import { analytics } from "@/lib/analytics";

interface ThesisStreamProps {
  municipalityId: string;
  opportunityId?: string;
  context?: {
    objective?: string;
    budget_min?: number;
    budget_max?: number;
    risk_tolerance?: string;
  };
  fallbackThesis?: string;
  autoStart?: boolean;
}

export function ThesisStream({
  municipalityId,
  opportunityId,
  context,
  fallbackThesis,
  autoStart = false,
}: ThesisStreamProps) {
  const [thesis, setThesis] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(autoStart);

  const generate = useCallback(async () => {
    setLoading(true);
    setThesis("");
    setDone(false);
    setError(null);
    analytics.thesisGenerated({ municipality_id: municipalityId, municipality_name: opportunityId ?? municipalityId });

    try {
      const res = await fetch("/api/thesis/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ municipality_id: municipalityId, opportunity_id: opportunityId, context }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to generate thesis");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response stream");

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") { setDone(true); break; }
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) setThesis((prev) => prev + parsed.text);
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }, [municipalityId, opportunityId, context]);

  useEffect(() => {
    if (autoStart) generate();
  }, [autoStart, generate]);

  // Show fallback if not yet started
  if (!started) {
    return (
      <div>
        {fallbackThesis && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">{fallbackThesis}</p>
        )}
        <button
          onClick={() => { setStarted(true); generate(); }}
          className="flex items-center gap-2 text-xs border border-primary/30 bg-primary/5 text-primary px-4 py-2 rounded-lg hover:bg-primary/10 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Generate personalised thesis with Claude
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Loading state */}
      {loading && !thesis && (
        <div className="py-2 space-y-2.5" role="status" aria-label="Generating thesis">
          <div className="skeleton h-3.5 w-full" />
          <div className="skeleton h-3.5 w-11/12" />
          <div className="skeleton h-3.5 w-4/5" />
          <p className="text-xs text-muted-foreground pt-1.5">Claude is analysing the opportunity…</p>
        </div>
      )}

      {/* Streaming text */}
      {thesis && (
        <div className="prose prose-sm prose-invert max-w-none">
          {thesis.split("\n\n").map((para, i) => {
            if (para.startsWith("**Entry thesis:**") || para.includes("**Entry thesis:**")) {
              const parts = para.split("**Entry thesis:**");
              return (
                <div key={i}>
                  {parts[0] && <p className="text-sm text-muted-foreground leading-relaxed mb-3">{parts[0].trim()}</p>}
                  {parts[1] && (
                    <div className="border-l-2 border-pa-green pl-4 mt-4">
                      <p className="text-xs text-pa-green font-semibold uppercase tracking-widest mb-1">Entry thesis</p>
                      <p className="text-sm font-medium leading-relaxed">{parts[1].trim()}</p>
                    </div>
                  )}
                </div>
              );
            }
            return <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-3">{para}</p>;
          })}
          {loading && (
            <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5" />
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 border border-pa-red/30 bg-pa-red/5 rounded-lg">
          <p className="text-xs text-pa-red mb-2">{error}</p>
          <button onClick={generate} className="text-xs text-pa-green hover:underline">Try again</button>
        </div>
      )}

      {/* Regenerate */}
      {done && (
        <button
          onClick={generate}
          className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Regenerate thesis
        </button>
      )}
    </div>
  );
}
