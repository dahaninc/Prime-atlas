import { describe, it, expect } from "vitest";
import { computeValueLevers } from "./levers";
import { US_DEFAULT_INPUTS } from "./screener";

describe("computeValueLevers", () => {
  const levers = computeValueLevers(US_DEFAULT_INPUTS);

  it("produces all five levers ranked by absolute cash-on-cash impact", () => {
    expect(levers).toHaveLength(5);
    for (let i = 1; i < levers.length; i++) {
      expect(Math.abs(levers[i - 1].cocDeltaPts)).toBeGreaterThanOrEqual(Math.abs(levers[i].cocDeltaPts));
    }
  });

  it("directionally correct: price cut and rent lift both raise cash-on-cash", () => {
    const price = levers.find((l) => l.lever === "Purchase price")!;
    const rent  = levers.find((l) => l.lever === "Rent programme")!;
    const rate  = levers.find((l) => l.lever === "Financing rate")!;
    expect(price.cocDeltaPts).toBeGreaterThan(0);
    expect(rent.cocDeltaPts).toBeGreaterThan(0);
    expect(rate.cocDeltaPts).toBeGreaterThan(0); // −50bp rate → higher CoC
  });

  it("rent lift raises exit value; price cut does not change exit value", () => {
    const rent  = levers.find((l) => l.lever === "Rent programme")!;
    const price = levers.find((l) => l.lever === "Purchase price")!;
    expect(rent.exitValueDelta).toBeGreaterThan(0);
    expect(Math.abs(price.exitValueDelta)).toBeLessThan(1); // exit value is NOI-driven
  });

  it("never emits advice language", () => {
    const text = levers.map((l) => l.narrative).join(" ").toLowerCase();
    expect(text).not.toMatch(/\byou should\b|recommend|guaranteed|must buy/);
  });
});
