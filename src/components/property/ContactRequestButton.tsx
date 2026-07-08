"use client";

import { useState } from "react";

interface Props {
  propertyId:  string;
  userEmail:   string;
  alreadySent: boolean;
}

type State = "idle" | "loading" | "sent" | "already" | "error" | "quota";

export function ContactRequestButton({ propertyId, userEmail, alreadySent }: Props) {
  const [state, setState] = useState<State>(alreadySent ? "already" : "idle");
  const [quotaLimit, setQuotaLimit] = useState<number | null>(null);

  async function handleRequest() {
    if (state === "loading" || state === "sent") return;
    setState("loading");

    try {
      const res  = await fetch("/api/contact-request", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ property_id: propertyId }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data?.error === "quota_exceeded") {
          setQuotaLimit(typeof data.limit === "number" ? data.limit : null);
          setState("quota");
        } else {
          setState("error");
        }
      }
      else if (data.already_sent) setState("already");
      else                    setState("sent");
    } catch {
      setState("error");
    }
  }

  /* ── Sent ── */
  if (state === "sent") {
    return (
      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-4">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-400 leading-tight">Report sent</p>
            <p className="text-[10px] text-emerald-400 mt-0.5 leading-relaxed">
              Check <span className="font-semibold">{userEmail}</span> — includes agent contact, yield analysis & exit projections.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Already sent ── */
  if (state === "already") {
    return (
      <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
        <p className="text-[10px] font-semibold text-primary mb-0.5">Report already sent</p>
        <p className="text-[10px] text-blue-500 leading-relaxed mb-2">
          Check <span className="font-semibold">{userEmail}</span> for your property report.
        </p>
        <button
          onClick={handleRequest}
          className="text-[10px] font-bold text-primary hover:text-primary/80 underline underline-offset-2"
        >
          Re-send report →
        </button>
      </div>
    );
  }

  /* ── Quota exceeded ── */
  if (state === "quota") {
    return (
      <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
        <p className="text-xs font-bold text-primary mb-1">Monthly reveal limit reached</p>
        <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
          {quotaLimit != null
            ? `Your plan includes ${quotaLimit} contact reveals per month.`
            : "You've used your contact reveals for this month."} Upgrade for a higher (or unlimited) allowance.
        </p>
        <a
          href="/pricing"
          className="text-[10px] font-bold text-primary hover:text-primary/80 underline underline-offset-2"
        >
          View plans →
        </a>
      </div>
    );
  }

  /* ── Error ── */
  if (state === "error") {
    return (
      <div className="rounded-xl bg-red-500/10 border border-red-500/25 p-4">
        <p className="text-xs font-bold text-red-400 mb-1">Failed to send</p>
        <p className="text-[10px] text-red-500 mb-2 leading-relaxed">
          Something went wrong. Please try again.
        </p>
        <button
          onClick={() => setState("idle")}
          className="text-[10px] font-bold text-red-500 underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    );
  }

  /* ── Idle / Loading ── */
  return (
    <div>
      <button
        onClick={handleRequest}
        disabled={state === "loading"}
        className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${
          state === "loading"
            ? "bg-secondary text-zinc-500 cursor-not-allowed"
            : "bg-[#0A0E1A] text-white hover:bg-primary active:scale-[0.98]"
        }`}
      >
        {state === "loading" ? (
          <>
            <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Sending…
          </>
        ) : (
          <>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Send Report to My Email
          </>
        )}
      </button>
      <p className="text-[10px] text-zinc-500 text-center mt-1.5 leading-relaxed">
        Sent instantly to <span className="font-semibold text-zinc-500">{userEmail}</span>
      </p>
    </div>
  );
}
