import { describe, it, expect } from "vitest";
import { sanitizeListingFields, sanitizeListingRows, MAX_SANE_PRICE, MAX_SANE_SIZE_SQM, MAX_SANE_BEDROOMS } from "./listingSanity";

describe("sanitizeListingFields", () => {
  it("passes through a plausible row unchanged", () => {
    const row = { price: 60_000_00, size_sqm: 95, bedrooms: 2 };
    expect(sanitizeListingFields(row)).toEqual(row);
  });

  it("nulls a corrupted price without touching size_sqm/bedrooms", () => {
    const row = { price: 40_000_000_000_00, size_sqm: 95, bedrooms: 2 };
    const out = sanitizeListingFields(row);
    expect(out.price).toBeNull();
    expect(out.size_sqm).toBe(95);
    expect(out.bedrooms).toBe(2);
  });

  it("nulls a corrupted size_sqm (the 86,931 sqm case from the audit)", () => {
    const out = sanitizeListingFields({ price: 60_000_00, size_sqm: 86_931, bedrooms: 3 });
    expect(out.size_sqm).toBeNull();
  });

  it("nulls a corrupted bedrooms count (the 39-bed case from the audit)", () => {
    const out = sanitizeListingFields({ price: 60_000_00, size_sqm: 95, bedrooms: 39 });
    expect(out.bedrooms).toBeNull();
  });

  it("never zeroes a value — missing stays null, not 0", () => {
    const out = sanitizeListingFields({ price: null, size_sqm: null, bedrooms: null });
    expect(out.price).toBeNull();
    expect(out.size_sqm).toBeNull();
    expect(out.bedrooms).toBeNull();
  });

  it("accepts values exactly at the boundary", () => {
    const out = sanitizeListingFields({ price: MAX_SANE_PRICE, size_sqm: MAX_SANE_SIZE_SQM, bedrooms: MAX_SANE_BEDROOMS });
    expect(out.price).toBe(MAX_SANE_PRICE);
    expect(out.size_sqm).toBe(MAX_SANE_SIZE_SQM);
    expect(out.bedrooms).toBe(MAX_SANE_BEDROOMS);
  });
});

describe("sanitizeListingRows", () => {
  it("excludes a row with an implausible price entirely (list context)", () => {
    const rows = [
      { id: "a", price: 60_000_00, size_sqm: 95, bedrooms: 2 },
      { id: "b", price: 40_000_000_000_00, size_sqm: 95, bedrooms: 2 },
    ];
    const out = sanitizeListingRows(rows);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("a");
  });

  it("keeps a row with a missing (null) price rather than excluding it", () => {
    const out = sanitizeListingRows([{ id: "a", price: null, size_sqm: 95, bedrooms: 2 }]);
    expect(out).toHaveLength(1);
  });
});
