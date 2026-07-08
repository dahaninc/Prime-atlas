import { describe, it, expect } from "vitest";
import {
  ENTITLEMENTS, getEntitlements, normalizeTier, tierRank, evaluateQuota,
  canParseOm, canExportScreenerDoc, canBulkExport, underpricedListingLimit,
} from "./entitlements";

describe("normalizeTier", () => {
  it("passes through known tiers", () => {
    expect(normalizeTier("professional")).toBe("professional");
  });
  it("fails closed to free for unknown/missing tiers", () => {
    expect(normalizeTier(null)).toBe("free");
    expect(normalizeTier(undefined)).toBe("free");
    expect(normalizeTier("nonsense")).toBe("free");
  });
});

describe("tier ordering", () => {
  it("is monotonically increasing free -> institutional", () => {
    expect(tierRank("free")).toBeLessThan(tierRank("explorer"));
    expect(tierRank("explorer")).toBeLessThan(tierRank("professional"));
    expect(tierRank("professional")).toBeLessThan(tierRank("institutional"));
  });
});

describe("evaluateQuota", () => {
  it("allows unlimited (null limit) regardless of usage", () => {
    expect(evaluateQuota(9_999, null)).toEqual({ allowed: true, used: 9_999, limit: null, remaining: null });
  });
  it("allows while under the cap and reports remaining", () => {
    expect(evaluateQuota(2, 10)).toEqual({ allowed: true, used: 2, limit: 10, remaining: 8 });
  });
  it("denies at and above the cap", () => {
    expect(evaluateQuota(10, 10).allowed).toBe(false);
    expect(evaluateQuota(11, 10).allowed).toBe(false);
  });
});

describe("numeric caps never decrease as tier rises (free -> institutional)", () => {
  const numericKeys = [
    "underpricedListingLimit", "screenerRunsPerMonth", "contactRevealsPerMonth", "seats",
  ] as const;
  const tiers = ["free", "explorer", "professional", "institutional"] as const;

  for (const key of numericKeys) {
    it(`${key} is non-decreasing across tiers (null = unlimited)`, () => {
      let prev: number | null = 0;
      for (const t of tiers) {
        const v = ENTITLEMENTS[t][key];
        if (v === null) { prev = null; continue; } // unlimited from here on is always >= prev
        expect(prev).not.toBeNull(); // once a lower tier is unlimited, a higher tier can't be a finite cap
        expect(v).toBeGreaterThanOrEqual(prev as number);
        prev = v;
      }
    });
  }
});

describe("boolean feature gates match the approved tier spec", () => {
  it("OM parsing: Professional and Institutional only", () => {
    expect(canParseOm("free")).toBe(false);
    expect(canParseOm("explorer")).toBe(false);
    expect(canParseOm("professional")).toBe(true);
    expect(canParseOm("institutional")).toBe(true);
  });

  it("Screener doc export: Professional and Institutional only", () => {
    expect(canExportScreenerDoc("free")).toBe(false);
    expect(canExportScreenerDoc("explorer")).toBe(false);
    expect(canExportScreenerDoc("professional")).toBe(true);
    expect(canExportScreenerDoc("institutional")).toBe(true);
  });

  it("Bulk CSV/Excel export: Institutional only", () => {
    expect(canBulkExport("free")).toBe(false);
    expect(canBulkExport("explorer")).toBe(false);
    expect(canBulkExport("professional")).toBe(false);
    expect(canBulkExport("institutional")).toBe(true);
  });

  it("Underpriced feed: 0 for free, teaser for explorer, full (null) for professional+", () => {
    expect(underpricedListingLimit("free")).toBe(0);
    expect(underpricedListingLimit("explorer")).toBeGreaterThan(0);
    expect(underpricedListingLimit("professional")).toBeNull();
    expect(underpricedListingLimit("institutional")).toBeNull();
  });
});

describe("getEntitlements", () => {
  it("returns the free row for an unrecognized tier (fail closed)", () => {
    expect(getEntitlements("made_up_tier")).toEqual(ENTITLEMENTS.free);
  });
});
