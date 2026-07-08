import { describe, it, expect } from "vitest";
import { buildMemoHtml, type MemoPayload } from "./icMemoTemplate";

const BASE_PAYLOAD: MemoPayload = {
  market: { name: "Austin", region: "Texas", country: "United States", slug: "austin-tx", population: 979_882 },
  scores: { opportunity: 82, growth: 88, development: 85, infrastructure: 80, liquidity: 78, risk: 30 },
  momentum: { previous: 79, current: 82 },
  pulse: {
    sale_count: 153, rent_count: 0,
    median_price: "$600.0K", median_ppsm_local: "$301/SF", underpriced_count: 43,
    comp_coverage: { covered: 61, total: 153 },
  },
  narrative: {
    thesis: "Austin's investment case rests on continued tech-sector inbound migration.",
    sourceName: "Prime Atlas Intelligence",
    sourceUrl: null,
    demandSignals: [
      { label: "Mispricing opportunity", value: "28.1% of sale listings", reading: "strong", note: "Elevated dispersion." },
      { label: "Score momentum", value: "+3.0 pts", reading: "neutral", note: "Stable week over week." },
    ],
  },
  deals: [
    {
      // 22% — realistic for a fixture, since the real API route only ever
      // marks something `ranked: true` at >=15% (the mispricing floor).
      address: "412 Cesar Chavez St", price: "$625K", detail: "2 bed · Condo · 95 sqm",
      discountPct: 22, grossYieldPct: 6.8, ranked: true,
      verdict: "22.0% below 5 ZIP-level comps (ZIP 78701 · Condo · 2 bed) · 6.8% gross yield (market rent basis, 12 comps)",
      compBasisLabel: "ZIP 78701 · Condo · 2 bed",
      comps: [
        { address: "44 East Ave #2506", price: "$799K", ppsm: "$742/SF" },
        { address: "222 West Ave APT 1502", price: "$815K", ppsm: "$768/SF" },
        { address: "555 E 5th St #2724", price: "$829K", ppsm: "$801/SF" },
        { address: "98 San Jacinto Blvd #2603", price: "$870K", ppsm: "$845/SF" },
        { address: "200 Congress Ave #17F", price: "$998K", ppsm: "$918/SF" },
      ],
    },
    {
      address: "88 Rainey St", price: "$540K", detail: "1 bed · Condo · 68 sqm",
      discountPct: null, grossYieldPct: null, ranked: false, unrankedReason: "insufficient_data",
      verdict: "discount: insufficient comparable data (needs ≥5 same-ZIP/type/bedroom comps) · yield: insufficient rent data",
    },
  ],
  diligence: [{ label: "Source & pipeline", desc: "Cross-check listing/OM against county records" }],
  evidence: { infra: ["Austin Light Rail — funded"], planning: [], signals: [] },
  provenance: { source: "US Census ACS", confidence: "65%", retrieved: "2026-06-24", freshness: "2026-06-24", listingBasis: "153 listings" },
  analyst: "admin@prime-atlas.io",
};

describe("buildMemoHtml", () => {
  const html = buildMemoHtml(BASE_PAYLOAD);

  it("does not render a development pro-forma or ground-up dev metrics", () => {
    expect(html).not.toContain("Financial Model");
    expect(html).not.toContain("gsfPerUnit");
    expect(html).not.toContain("hardCostPerGsf");
    expect(html).not.toContain("marginOnGDV");
    expect(html).not.toContain("Development margin");
  });

  it("renders a clean header with no wide letter-spacing wordmark and no working-directory path", () => {
    expect(html).toContain("PRIME ATLAS");
    expect(html).toContain("Austin, Texas");
    expect(html).toContain("Confidential");
    expect(html).not.toContain("letter-spacing:0.15em");
    expect(html).not.toContain("/private/tmp");
    expect(html).not.toContain("file://");
  });

  it("keeps marketing URLs out of the header and body", () => {
    expect(html).not.toContain("prime-atlas-weld.vercel.app");
    expect(html).not.toContain("Committee members can screen deals");
  });

  it("leads the executive summary with a real, computed thesis paragraph", () => {
    expect(html).toContain("1. Executive Summary");
    expect(html).toContain("153 active sale listings");
    expect(html).toContain("43 of which price at least 15% below");
    expect(html).toContain("not a recommendation to transact");
  });

  it("only surfaces market-screening metrics in the summary stat cells, not development metrics", () => {
    expect(html).toContain("Composite opportunity score");
    expect(html).toContain("Mispricing count");
    expect(html).toContain("Deals ranked / screened");
    expect(html).not.toContain("Yield-on-cost");
    expect(html).not.toContain("Stabilized exit value");
  });

  it("includes the macro/micro narrative section with a source attribution line", () => {
    expect(html).toContain("Macro &amp; Micro Analysis");
    expect(html).toContain("tech-sector inbound migration");
    expect(html).toContain("Mispricing opportunity");
    expect(html).toContain("Source: Prime Atlas Intelligence");
    expect(html).toContain("internal analysis, not an external citation");
  });

  it("links an external source when sourceUrl is present, instead of the internal-analysis note", () => {
    const withSource = buildMemoHtml({
      ...BASE_PAYLOAD,
      narrative: { ...BASE_PAYLOAD.narrative!, sourceUrl: "https://www.austintexas.gov/development-services" },
    });
    expect(withSource).toContain("austintexas.gov");
    expect(withSource).not.toContain("internal analysis, not an external citation");
  });

  it("connects the macro section to the deal screen in Section 3", () => {
    expect(html).toContain("basis for the deal screen in Section 3");
  });

  it("connects the ranked deals heading to Section 1's mispricing count — top N of M", () => {
    expect(html).toContain("top 1 of 43 listings trading");
  });

  it("shows the yield basis (market rent, comp count) rather than a bare percentage", () => {
    expect(html).toContain("market rent basis, 12 comps");
  });

  it("never pads the ranked list — fewer than the display cap just means fewer rows, with an explicit note", () => {
    const noneQualify = buildMemoHtml({
      ...BASE_PAYLOAD,
      deals: [{
        address: "1 Test St", price: "$100K", detail: "n/a",
        discountPct: null, grossYieldPct: null, ranked: false, unrankedReason: "insufficient_data",
        verdict: "discount: insufficient comp data · yield: insufficient rent data",
      }],
    });
    expect(noneQualify).not.toContain("Ranked by discount to ZIP-level comps");
    expect(noneQualify).toContain("No listings in this market currently clear the 15% mispricing threshold");
  });

  it("includes a live deals section, ranked separately from unranked", () => {
    expect(html).toContain("Live Deals in Market");
    expect(html).toContain("412 Cesar Chavez St");
    expect(html).toContain("Ranked by discount to ZIP-level comps");
    expect(html).toContain("Additional deals — not ranked");
    expect(html).toContain("lack the 5+ same-ZIP/type/bedroom comparables");
  });

  it("renders the comparable evidence behind each ranked discount — addresses, asking, rate", () => {
    expect(html).toContain("Comparable evidence — 5 listings, ZIP 78701 · Condo · 2 bed");
    expect(html).toContain("44 East Ave #2506");
    expect(html).toContain("$742/SF");
    expect(html).toContain("measured against this set's median");
  });

  it("renders no comp-evidence block for a deal without comps", () => {
    const noComps = buildMemoHtml({
      ...BASE_PAYLOAD,
      deals: [{ ...BASE_PAYLOAD.deals![0], comps: [] }],
    });
    expect(noComps).not.toContain("Comparable evidence");
  });

  it("states comp coverage honestly in Section 1 — including the zero-coverage case", () => {
    expect(html).toContain("61 of 153 listings currently have a valid comparable set");
    const zeroCoverage = buildMemoHtml({
      ...BASE_PAYLOAD,
      pulse: { ...BASE_PAYLOAD.pulse!, underpriced_count: 0, comp_coverage: { covered: 0, total: 160 } },
      deals: [{
        address: "1 Test St", price: "$100K", detail: "n/a",
        discountPct: null, grossYieldPct: null, ranked: false, unrankedReason: "insufficient_data",
        verdict: "discount: insufficient comparable data (needs ≥5 same-ZIP/type/bedroom comps) · yield: insufficient rent data",
      }],
    });
    expect(zeroCoverage).toContain("No listing in this market currently has the 5+ same-ZIP comparables");
    expect(zeroCoverage).toContain("insufficient comparable data");
    expect(zeroCoverage).not.toContain("Ranked by discount to ZIP-level comps");
  });

  it("flags an implausible discount as a likely data artifact, not a headline deal", () => {
    const withImplausible = buildMemoHtml({
      ...BASE_PAYLOAD,
      deals: [{
        address: "6301 Oleander Trl", price: "$65K", detail: "4 bed · House · 114 sqm",
        discountPct: null, grossYieldPct: null, ranked: false, unrankedReason: "implausible",
        verdict: "discount: flagged as likely data error (beyond ±60%) · yield: insufficient rent data",
      }],
    });
    expect(withImplausible).toContain("likely data artifact, not a bargain");
    expect(withImplausible).not.toContain("Ranked by discount-to-value");
  });

  it("never renders a missing deal metric as zero — always an explicit n/a", () => {
    const unrankedOnly = buildMemoHtml({
      ...BASE_PAYLOAD,
      deals: [{
        address: "1 Test St", price: "$100K", detail: "n/a",
        discountPct: null, grossYieldPct: null, ranked: false, unrankedReason: "insufficient_data",
        verdict: "discount: insufficient comp data · yield: insufficient rent data",
      }],
    });
    expect(unrankedOnly).toContain("n/a");
  });

  it("reframes diligence as a forward-looking roadmap, never a checklist of unreviewed boxes", () => {
    expect(html).toContain("Diligence Roadmap");
    expect(html).not.toContain("☐");
    expect(html).not.toContain("not reviewed");
    expect(html).not.toContain("reviewed by analyst");
  });

  it("omits the narrative and deals sections when absent", () => {
    const minimal = buildMemoHtml({ ...BASE_PAYLOAD, narrative: null, deals: [] });
    expect(minimal).not.toContain("Macro &amp; Micro Analysis");
    expect(minimal).not.toContain("Live Deals in Market");
  });

  it("escapes untrusted text fields", () => {
    const withHtml = buildMemoHtml({
      ...BASE_PAYLOAD,
      narrative: { thesis: "<script>alert(1)</script>", sourceName: null, sourceUrl: null, demandSignals: [] },
    });
    expect(withHtml).not.toContain("<script>alert(1)</script>");
    expect(withHtml).toContain("&lt;script&gt;");
  });

  it("keeps the data provenance section but drops marketing links from it", () => {
    expect(html).toContain("Data Provenance");
    expect(html).toContain("US Census ACS");
  });
});
