"use client";

import { useState } from "react";
import Link from "next/link";

const FUND_SIZES = ["<$1M", "$1M–$5M", "$5M–$25M", "$25M–$100M", "$100M+"];
const TARGET_RETURNS = ["5–8% IRR", "8–12% IRR", "12–18% IRR", "18%+ IRR", "Income-focused"];
const GEOGRAPHIES = [
  "London & South East",
  "UK Regions (North)",
  "UK Regions (Midlands)",
  "New York Metro",
  "Miami & South Florida",
  "Austin & Texas",
  "USA — Open to all markets",
  "UK — Open to all markets",
];

const DEAL_TYPES = [
  { icon: "🏗️", title: "Development land",        desc: "Permitted plots and urban land assemblies in growth corridors." },
  { icon: "🏢", title: "Commercial conversion",    desc: "Offices and retail converting to residential or mixed-use." },
  { icon: "🏘️", title: "Residential portfolios",  desc: "Multi-unit residential portfolios in undersupplied locations." },
  { icon: "🏨", title: "Hospitality & tourism",   desc: "Hotels, boutique resorts, and short-stay assets in coastal markets." },
];

export function CapitalClient() {
  const [form, setForm] = useState({
    name: "", email: "", company: "",
    fund_size: "", target_return: "", geography: "", message: "",
  });
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    try {
      const res = await fetch("/api/capital/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Submission failed");
      }
      setState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  }

  return (
    <main>
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <div className="max-w-3xl">
          <p className="text-xs text-pa-green font-mono uppercase tracking-widest mb-4">prime-atlas Capital</p>
          <h1 className="text-5xl font-bold leading-tight mb-6">
            Off-market USA + UK.<br />
            <span className="text-pa-green">Before the crowd arrives.</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            Prime Atlas Capital connects institutional and qualified investors with off-market opportunities
            across the highest-scoring USA and UK markets — identified by our AI-powered intelligence platform
            before capital deployment drives prices to market rate.
          </p>
          <div className="flex items-center gap-4">
            <a href="#enquiry"
              className="bg-primary text-white font-bold px-6 py-3 rounded-lg hover:bg-primary/85 transition-colors">
              Submit investment mandate →
            </a>
            <Link href="/opportunities/finder"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Browse opportunities first
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: "58+", label: "Markets scored" },
            { value: "$4.2B", label: "Pipeline tracked" },
            { value: "91/100", label: "Top opportunity score" },
            { value: "24hr", label: "Signal latency" },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="font-mono font-bold text-3xl text-pa-green">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Deal types */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-2xl font-bold mb-2">Deal types we introduce</h2>
        <p className="text-muted-foreground text-sm mb-8">Sourced from our proprietary signals network across USA and UK markets.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DEAL_TYPES.map((d) => (
            <div key={d.title} className="border border-border bg-card rounded-xl p-5">
              <span className="text-2xl mb-3 block">{d.icon}</span>
              <h3 className="font-semibold mb-1">{d.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{d.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-2xl font-bold mb-8">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Submit your mandate", desc: "Tell us your fund size, target returns, geography, and deal preferences." },
              { step: "02", title: "We match you", desc: "Our team identifies opportunities from our signals network that fit your mandate." },
              { step: "03", title: "Warm introductions", desc: "We make direct introductions to sponsors and operators. You control the process." },
            ].map(({ step, title, desc }) => (
              <div key={step}>
                <p className="font-mono text-pa-green font-bold text-sm mb-2">{step}</p>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enquiry form */}
      <section id="enquiry" className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold mb-2">Submit your investment mandate</h2>
          <p className="text-muted-foreground text-sm mb-8">
            We review every enquiry personally. Qualified mandates receive introductions within 5 business days.
          </p>

          {state === "success" ? (
            <div className="border border-pa-green/30 bg-pa-green/5 rounded-xl p-8 text-center">
              <p className="text-2xl mb-3">✓</p>
              <h3 className="font-bold text-lg mb-2 text-pa-green">Mandate received</h3>
              <p className="text-sm text-muted-foreground">
                A member of the prime-atlas Capital team will be in touch within 2 business days.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5">Name <span className="text-red-400">*</span></label>
                  <input type="text" required value={form.name} onChange={(e) => update("name", e.target.value)}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-pa-green/50" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">Email <span className="text-red-400">*</span></label>
                  <input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-pa-green/50" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5">Company / Fund name</label>
                <input type="text" value={form.company} onChange={(e) => update("company", e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-pa-green/50" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5">Deployment capacity</label>
                  <select value={form.fund_size} onChange={(e) => update("fund_size", e.target.value)}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-pa-green/50">
                    <option value="">Select range</option>
                    {FUND_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">Target return</label>
                  <select value={form.target_return} onChange={(e) => update("target_return", e.target.value)}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-pa-green/50">
                    <option value="">Select target</option>
                    {TARGET_RETURNS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5">Preferred geography</label>
                <div className="flex flex-wrap gap-2">
                  {GEOGRAPHIES.map((g) => (
                    <button key={g} type="button" onClick={() => update("geography", g)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        form.geography === g
                          ? "border-pa-green/50 bg-pa-green/10 text-pa-green"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5">Additional notes</label>
                <textarea rows={4} value={form.message} onChange={(e) => update("message", e.target.value)}
                  placeholder="Deal types, timeline, specific requirements…"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-pa-green/50 resize-none" />
              </div>

              {state === "error" && (
                <p className="text-sm text-red-400">{errorMsg}</p>
              )}

              <button type="submit" disabled={state === "loading"}
                className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-primary/85 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {state === "loading" && (
                  <span className="w-4 h-4 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
                )}
                Submit mandate
              </button>

              <p className="text-xs text-muted-foreground text-center">
                By submitting you agree to be contacted by the prime-atlas Capital team. Not investment advice.
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
