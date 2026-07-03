"use client";

import { useState } from "react";

interface Props {
  propertyId:  string;
  isMember:    boolean;
  alreadySent: boolean;
}

type State = "idle" | "loading" | "sent" | "already" | "error";

export function ContactRequestButton({ propertyId, isMember, alreadySent }: Props) {
  const [state, setState] = useState<State>(alreadySent ? "already" : "idle");

  async function handleRequest() {
    if (!isMember || state === "loading" || state === "sent" || state === "already") return;
    setState("loading");

    try {
      const res  = await fetch("/api/contact-request", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ property_id: propertyId }),
      });
      const data = await res.json();

      if (!res.ok)       setState("error");
      else if (data.already_sent) setState("already");
      else               setState("sent");
    } catch {
      setState("error");
    }
  }

  /* ── States ─────────────────────────────────────────────────── */

  if (state === "sent") {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-xs font-bold text-green-700">Report sent to your email</p>
        <p className="text-[10px] text-green-600 mt-0.5">
          Includes agent contact details, yield analysis & exit architecture.
        </p>
      </div>
    );
  }

  if (state === "already") {
    return (
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-center">
        <p className="text-xs font-bold text-[#1B4FE4] mb-0.5">Report previously sent</p>
        <p className="text-[10px] text-blue-500">
          Check your inbox — we sent you the full property report including agent details.
        </p>
        <button
          onClick={handleRequest}
          className="mt-2 text-[10px] font-semibold text-[#1B4FE4] underline underline-offset-2 hover:text-[#1641C0]"
        >
          Re-send report →
        </button>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-center">
        <p className="text-xs font-bold text-red-600 mb-0.5">Something went wrong</p>
        <button
          onClick={() => setState("idle")}
          className="text-[10px] text-red-500 underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleRequest}
      disabled={state === "loading"}
      className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${
        state === "loading"
          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
          : "bg-[#0A0E1A] text-white hover:bg-[#1B4FE4] active:scale-[0.98]"
      }`}
    >
      {state === "loading" ? (
        <>
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Preparing report…
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Request Agent Details
        </>
      )}
    </button>
  );
}
