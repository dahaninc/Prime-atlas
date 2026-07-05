import { describe, it, expect } from "vitest";
import { redactStreet, redactRows, isPaidTier } from "./access";

describe("redactStreet", () => {
  it("keeps US locality (city, state zip)", () => {
    expect(redactStreet("12 Maple St, Austin, TX 78701")).toBe("Austin, TX 78701");
  });

  it("keeps UK locality segments", () => {
    expect(redactStreet("Maple Road, Peckham, London SE15")).toBe("Peckham, London SE15");
  });

  it("drops unit prefixes AND the street behind them (regression: Flat 2, 166 Rockingham St)", () => {
    expect(redactStreet("Flat 2, 166 Rockingham Street, Sheffield S2")).toBe("Sheffield S2");
    expect(redactStreet("Apartment 12, 41 Brook Avenue, Wembley HA9")).toBe("Wembley HA9");
  });

  it("redacts to null when no locality segment survives", () => {
    expect(redactStreet("Flat 2, 166 Rockingham Street")).toBeNull();
    expect(redactStreet("41 Brook Avenue HA9")).toBeNull();
    expect(redactStreet("")).toBeNull();
    expect(redactStreet(null)).toBeNull();
  });

  it("drops house-numbered segments anywhere in the string", () => {
    expect(redactStreet("Penthouse, 25 Cross Street M2, Manchester")).toBe("Manchester");
  });
});

describe("redactRows", () => {
  const rows = [
    { id: "1", address: "12 Maple St, Austin, TX 78701", images: ["https://x/1.jpg"] },
    { id: "2", address: "41 Brook Avenue HA9", images: ["https://x/2.jpg"] },
  ];

  it("passes rows through untouched for members", () => {
    expect(redactRows(rows, true)).toEqual(rows);
  });

  it("strips photos and street detail for non-members", () => {
    const out = redactRows(rows, false);
    expect(out[0].images).toEqual([]);
    expect(out[0].address).toBe("Austin, TX 78701");
    expect(out[1].address).toBeNull();
    expect(JSON.stringify(out)).not.toMatch(/Maple St|Brook Avenue|1\.jpg/);
  });
});

describe("isPaidTier", () => {
  it("only paid tiers pass", () => {
    expect(isPaidTier("explorer")).toBe(true);
    expect(isPaidTier("professional")).toBe(true);
    expect(isPaidTier("institutional")).toBe(true);
    expect(isPaidTier("free")).toBe(false);
    expect(isPaidTier(null)).toBe(false);
    expect(isPaidTier(undefined)).toBe(false);
  });
});
