import { describe, it, expect } from "vitest";
import { extractZip5, screenByZipComps, MIN_ZIP_COMPS, type CompInput } from "./comps";

/** n same-bucket listings at a given ppsqm ladder (100 sqm each, price in minor units). */
function bucketOf(pricesUsd: number[], overrides: Partial<CompInput> = {}): CompInput[] {
  return pricesUsd.map((usd, i) => ({
    id: `c${i}`,
    address: `${100 + i} Main St, Charlotte, NC 28202`,
    price: usd * 100,
    size_sqm: 100,
    bedrooms: 2,
    property_type: "Condo",
    ...overrides,
  }));
}

describe("extractZip5", () => {
  it("pulls ZIP5 from a scraped US address tail", () => {
    expect(extractZip5("355 1st St Unit S207, San Francisco, CA 94105")).toBe("94105");
  });
  it("handles ZIP+4 and trailing whitespace", () => {
    expect(extractZip5("1 Elm St, Charlotte, NC 28202-1234  ")).toBe("28202");
  });
  it("returns null for UK addresses and null input", () => {
    expect(extractZip5("12 Baker Street, London NW1 6XE")).toBeNull();
    expect(extractZip5(null)).toBeNull();
  });
});

describe("screenByZipComps", () => {
  it("computes discount vs the median of same-ZIP/type/bedroom comps, excluding the subject", () => {
    // 5 comps at $500k/100sqm (ppsqm 500), subject at $400k -> 20% below
    const listings = [
      ...bucketOf([500_000, 500_000, 500_000, 500_000, 500_000]),
      { id: "subj", address: "9 Oak St, Charlotte, NC 28202", price: 400_000 * 100, size_sqm: 100, bedrooms: 2, property_type: "Condo" },
    ];
    const r = screenByZipComps(listings);
    const s = r.byId.get("subj")!;
    expect(s.status).toBe("mispriced");
    expect(s.discountPct).toBeCloseTo(20, 5);
    expect(s.comps).toHaveLength(5);
    expect(s.comps.map((c) => c.id)).not.toContain("subj");
    expect(s.basisLabel).toBe("ZIP 28202 · Condo · 2 bed");
    expect(r.mispricingCount).toBe(1);
  });

  it(`requires at least ${MIN_ZIP_COMPS} comps — 4 is insufficient, never a metro fallback`, () => {
    const listings = [
      ...bucketOf([500_000, 500_000, 500_000, 500_000]),
      { id: "subj", address: "9 Oak St, Charlotte, NC 28202", price: 300_000 * 100, size_sqm: 100, bedrooms: 2, property_type: "Condo" },
    ];
    const s = screenByZipComps(listings).byId.get("subj")!;
    expect(s.status).toBe("insufficient_comps");
    expect(s.discountPct).toBeNull();
    expect(s.comps).toEqual([]);
  });

  it("does not mix buckets: different ZIP, type, or bedrooms never count as comps", () => {
    const listings = [
      ...bucketOf([500_000, 500_000], { address: "1 Elm St, Charlotte, NC 28203" }), // other ZIP
      ...bucketOf([500_000, 500_000], { property_type: "House" }),                    // other type
      ...bucketOf([500_000, 500_000], { bedrooms: 3 }),                               // other beds
      { id: "subj", address: "9 Oak St, Charlotte, NC 28202", price: 300_000 * 100, size_sqm: 100, bedrooms: 2, property_type: "Condo" },
    ];
    expect(screenByZipComps(listings).byId.get("subj")!.status).toBe("insufficient_comps");
  });

  it("a listing without size/ZIP/type/bedrooms is insufficient AND can't serve as a comp", () => {
    const noSize = bucketOf([500_000, 500_000, 500_000, 500_000, 500_000], { size_sqm: null });
    const listings = [
      ...noSize,
      { id: "subj", address: "9 Oak St, Charlotte, NC 28202", price: 300_000 * 100, size_sqm: 100, bedrooms: 2, property_type: "Condo" },
    ];
    const r = screenByZipComps(listings);
    expect(r.byId.get("subj")!.status).toBe("insufficient_comps");
    expect(r.byId.get("c0")!.status).toBe("insufficient_comps");
    expect(r.coveredCount).toBe(0);
  });

  it("classifies a >60% discount as implausible, not the best deal", () => {
    const listings = [
      ...bucketOf([500_000, 500_000, 500_000, 500_000, 500_000]),
      { id: "subj", address: "9 Oak St, Charlotte, NC 28202", price: 100_000 * 100, size_sqm: 100, bedrooms: 2, property_type: "Condo" },
    ];
    const s = screenByZipComps(listings).byId.get("subj")!;
    expect(s.status).toBe("implausible");
    expect(s.discountPct).toBeNull();
  });

  it("classifies <15% below basis as below_floor — near-market pricing is not a mispricing", () => {
    const listings = [
      ...bucketOf([500_000, 500_000, 500_000, 500_000, 500_000]),
      { id: "subj", address: "9 Oak St, Charlotte, NC 28202", price: 460_000 * 100, size_sqm: 100, bedrooms: 2, property_type: "Condo" },
    ];
    const r = screenByZipComps(listings);
    expect(r.byId.get("subj")!.status).toBe("below_floor");
    expect(r.mispricingCount).toBe(0);
    expect(r.coveredCount).toBeGreaterThan(0);
  });

  it("UK-shaped rows (no ZIP, no size) all come back insufficient — honest silence, no fallback", () => {
    const uk: CompInput[] = Array.from({ length: 20 }, (_, i) => ({
      id: `uk${i}`, address: `${i} High Street, Manchester`, price: 250_000 * 100,
      size_sqm: null, bedrooms: 2, property_type: "Terraced",
    }));
    const r = screenByZipComps(uk);
    expect(r.coveredCount).toBe(0);
    expect(r.mispricingCount).toBe(0);
    expect(Array.from(r.byId.values()).every((e) => e.status === "insufficient_comps")).toBe(true);
  });

  it("returns comp evidence sorted cheapest-first with real ppsqm", () => {
    const listings = [
      ...bucketOf([600_000, 450_000, 500_000, 550_000, 520_000]),
      { id: "subj", address: "9 Oak St, Charlotte, NC 28202", price: 400_000 * 100, size_sqm: 100, bedrooms: 2, property_type: "Condo" },
    ];
    const s = screenByZipComps(listings).byId.get("subj")!;
    const ppsqms = s.comps.map((c) => c.ppsqm);
    expect(ppsqms).toEqual([...ppsqms].sort((a, b) => a - b));
    expect(s.comps[0].ppsqm).toBeCloseTo((450_000 * 100) / 100, 5);
    // median of [450,500,520,550,600]k over 100sqm = 520k/100sqm
    expect(s.compMedianPpsqm).toBeCloseTo((520_000 * 100) / 100, 5);
  });
});
