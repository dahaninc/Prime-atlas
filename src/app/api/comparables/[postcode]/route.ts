import { NextResponse } from "next/server";

/** Land Registry Price Paid Data — open data, no auth required */
const LR_BASE = "https://landregistry.data.gov.uk/data/ppi";

const PROPERTY_TYPE: Record<string, string> = {
  D: "Detached", S: "Semi-detached", T: "Terraced", F: "Flat / Apartment", O: "Other",
};

interface LRItem {
  transactionDate: string;
  pricePaid: number;
  propertyType: { value: string } | string;
  estateType: { value: string } | string;
  newBuild: string;
  propertyAddress: {
    paon?: string;
    saon?: string;
    street?: string;
    postcode?: string;
    town?: string;
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ postcode: string }> }
) {
  const { postcode } = await params;
  const clean = postcode.replace(/-/g, " ").toUpperCase();

  try {
    const url =
      `${LR_BASE}/transaction-record.json` +
      `?propertyAddress.postcode=${encodeURIComponent(clean)}` +
      `&_pageSize=10` +
      `&_sort=-transactionDate`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 }, // cache 24h
    });

    if (!res.ok) {
      return NextResponse.json({ comparables: [], source: "land_registry", error: "fetch_failed" }, { status: 200 });
    }

    const json = await res.json();
    const items: LRItem[] = json?.result?.items ?? [];

    const comparables = items.map((item) => {
      const addr = item.propertyAddress;
      const parts = [addr.paon, addr.saon, addr.street, addr.postcode].filter(Boolean);
      const rawType = typeof item.propertyType === "object" ? item.propertyType.value : item.propertyType;
      const typeCode = rawType?.split("/").pop() ?? "O";

      return {
        address: parts.join(" "),
        price: item.pricePaid,
        currency: "GBP",
        date: item.transactionDate?.slice(0, 10),
        type: PROPERTY_TYPE[typeCode] ?? typeCode,
        new_build: item.newBuild === "Y",
        postcode: addr.postcode ?? clean,
        source: "land_registry",
        source_label: "Land Registry",
      };
    });

    return NextResponse.json({
      comparables,
      postcode: clean,
      count: comparables.length,
      source: "land_registry",
    });
  } catch {
    return NextResponse.json({ comparables: [], source: "land_registry", error: "network_error" }, { status: 200 });
  }
}
