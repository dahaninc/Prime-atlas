import { describe, it, expect } from "vitest";
import { buildDealBrochureHtml, type BrochurePayload, type BrochurePropertyPayload } from "./dealBrochure";

const PROP: BrochurePropertyPayload = {
  address: "121 Edgerly Ct, Charlotte, NC 28214",
  market: "Charlotte, North Carolina — USA",
  price: "$470.0K",
  detail: "4 bed · 2 bath · House · 250 sqm",
  images: ["https://example.com/a.jpg", "https://example.com/b.jpg", "https://example.com/c.jpg"],
  listingUrl: "https://example.com/listing",
  discountPct: 42.0,
  compBasisLabel: "ZIP 28214 · House · 4 bed",
  comps: [
    { address: "1112 Long Paw Ln, Charlotte, NC 28214", price: "$455.0K", ppsm: "$168/SF" },
    { address: "7336 Everett Dr, Charlotte, NC 28214", price: "$255.0K", ppsm: "$187/SF" },
  ],
  grossYieldPct: 6.2,
  rentCompCount: 14,
  medianRentDisplay: "$1.8K",
  financing: [
    { ratePct: 5.5, monthlyPI: "$2.0K", dscr: 1.31, cashToClose: "$126.9K" },
    { ratePct: 7.5, monthlyPI: "$2.5K", dscr: 1.08, cashToClose: "$126.9K" },
  ],
  agent: { name: "J. Realtor", company: "Acme Realty", phone: "+1 704 555 0100", email: "j@acme.example" },
  contactWithheldReason: null,
};

const BASE: BrochurePayload = {
  preparedFor: "member@example.com",
  properties: [PROP],
  assumptions: { ltvPct: 75, amortYears: 30, vacancyPct: 5, expenseRatioPct: 40, closingCostPct: 2 },
  generatedAtIso: "2026-07-08T12:00:00.000Z",
};

describe("buildDealBrochureHtml", () => {
  const html = buildDealBrochureHtml(BASE);

  it("frames the pack as preparation, never approval or advice", () => {
    expect(html).toContain("Preliminary Financing Discussion Pack");
    expect(html).toContain("What a Lender Will Still Require");
    expect(html).toContain("not mortgage advice");
    expect(html).toContain("not investment advice");
    expect(html).not.toContain("pre-approval");
  });

  it("shows comp evidence and the discount with its basis", () => {
    expect(html).toContain("42.0% below");
    expect(html).toContain("ZIP 28214 · House · 4 bed");
    expect(html).toContain("1112 Long Paw Ln");
    expect(html).toContain("$168/SF");
  });

  it("renders financing scenarios with labeled assumptions", () => {
    expect(html).toContain("Financing Assumptions");
    expect(html).toContain("75%");
    expect(html).toContain("Monthly P&amp;I");
    expect(html).toContain("1.31");
    expect(html).toContain("not a quote");
  });

  it("embeds at most 2 images per property", () => {
    expect(html).toContain("https://example.com/a.jpg");
    expect(html).toContain("https://example.com/b.jpg");
    expect(html).not.toContain("https://example.com/c.jpg");
  });

  it("renders honest gaps — no discount, no yield, no DSCR fabricated", () => {
    const gappy = buildDealBrochureHtml({
      ...BASE,
      properties: [{
        ...PROP,
        discountPct: null, comps: [], compBasisLabel: null,
        grossYieldPct: null, medianRentDisplay: null, rentCompCount: 0,
        financing: [{ ratePct: 6.5, monthlyPI: "$2.2K", dscr: null, cashToClose: "$126.9K" }],
      }],
    });
    expect(gappy).toContain("Insufficient comparable data");
    expect(gappy).toContain("no discount is computed or implied");
    expect(gappy).toContain("Insufficient rent-comp data");
    expect(gappy).toContain("n/a — no real rent basis");
  });

  it("notes a quota-withheld contact rather than silently dropping it", () => {
    const withheld = buildDealBrochureHtml({
      ...BASE,
      properties: [{ ...PROP, agent: null, contactWithheldReason: "quota" }],
    });
    expect(withheld).toContain("Withheld — monthly contact-reveal quota reached");
  });

  it("summarizes the pack from computed discounts only", () => {
    expect(html).toContain("1 property across 1 market");
    expect(html).toContain("average 42.0% below their own comparable basis");
  });

  it("escapes untrusted fields", () => {
    const xss = buildDealBrochureHtml({
      ...BASE,
      properties: [{ ...PROP, address: "<script>alert(1)</script>" }],
    });
    expect(xss).not.toContain("<script>alert(1)</script>");
    expect(xss).toContain("&lt;script&gt;");
  });
});
