import { describe, it, expect } from "vitest";
import { fmt, symFor } from "./money";

describe("symFor", () => {
  it("maps GBP to the pound sign, everything else to dollar", () => {
    expect(symFor("GBP")).toBe("£");
    expect(symFor("USD")).toBe("$");
    expect(symFor("EUR")).toBe("$");
  });
});

describe("fmt", () => {
  // Regression case: a hand-rolled formatter in a throwaway review script
  // once displayed this exact listing as $1.38M instead of $137,500 — a
  // wrong divisor (10_000_000 instead of 100_000_000 from minor units, or
  // equivalently a bad direct-to-millions shortcut). This locks in the
  // real formatter's correct behavior for that specific figure permanently.
  it("formats $137,500 (2018 W Rundberg Ln, Austin) correctly — not $1.38M", () => {
    expect(fmt(137_500, "$")).toBe("$137.5K");
  });

  it("formats sub-thousand amounts as whole numbers", () => {
    expect(fmt(500, "$")).toBe("$500");
    expect(fmt(0, "$")).toBe("$0");
  });

  it("formats thousands with one decimal", () => {
    expect(fmt(1_500, "$")).toBe("$1.5K");
    expect(fmt(364_812, "$")).toBe("$364.8K");
  });

  it("formats millions with one decimal", () => {
    expect(fmt(1_495_000, "$")).toBe("$1.5M");
    expect(fmt(1_488_000, "$")).toBe("$1.5M");
  });

  it("prefixes negative values with a minus sign, magnitude unaffected", () => {
    expect(fmt(-137_500, "$")).toBe("−$137.5K");
  });

  it("uses the given currency symbol, not a hardcoded one", () => {
    expect(fmt(250_000, "£")).toBe("£250.0K");
  });
});
