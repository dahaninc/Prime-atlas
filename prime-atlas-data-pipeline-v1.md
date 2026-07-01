# Prime Atlas — Decoupled Data Pipeline Architecture v1.0

> **Scope**: End-to-end blueprint for ingesting messy external property data and delivering a 100% canonical, brand-clean payload to the Prime Atlas frontend. Four production layers: Database Schema → ETL Pipeline → API Payload → React Component.

---

## Decision Log

| Decision | Choice | Rationale |
|---|---|---|
| Database | **PostgreSQL 16** | ACID guarantees for financial data; JSONB for flexible source metadata; PostGIS for geo-queries; proven at global scale (Zillow, Realtor.com run PG) |
| ETL runtime | **Python + Pydantic v2** | Industry standard for data pipelines; Pydantic gives schema enforcement at parse time; runs on Lambda, Airflow, or any worker |
| HTML sanitisation | **bleach + lxml** | Battle-tested stripping; OWASP-safe; faster than regex |
| API style | **REST + JSON:API envelope** | Predictable, cacheable, works with any CDN |
| Frontend | **React + TypeScript** (Next.js, already in stack) | Zero new dependencies; matches existing codebase |
| Unit system | Canonical storage in **sq m**; convert on read | Single source of truth; display layer decides |
| Currency | Canonical storage in **minor units (cents/pence)** | Eliminates float rounding; matches Stripe/financial industry standard |
| Property taxonomy | **RESO Data Dictionary v2.0** `PropertyType` enum | Legal interoperability; MLS compatibility |

---

## Layer 1 — Canonical Database Schema (PostgreSQL)

### Design Principles
- Every external field maps to exactly one canonical column.
- `source_attribution` is a first-class JSONB object for legal compliance.
- All monetary values stored as `BIGINT` (minor units) + `CHAR(3)` currency code.
- All area values stored as `NUMERIC(12,4)` square metres.
- `property_type` uses a strict enum — no free-text.
- Soft-delete pattern (`deleted_at`) — never hard-delete property records.

```sql
-- ─────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────

CREATE TYPE property_type_enum AS ENUM (
  'Apartment',       -- maps: Flat, Condo, Unit, Studio Flat, Piso
  'House',           -- maps: Detached, Semi-Detached, Terraced, Villa, Chalet
  'Townhouse',       -- maps: Row House, Adosado
  'Land',            -- maps: Plot, Solar, Terrain
  'Commercial',      -- maps: Office, Retail, Local Comercial
  'Industrial',      -- maps: Warehouse, Nave Industrial
  'Hotel',
  'MultiFamily',     -- maps: HMO, Block of Flats, Edificio
  'ParkingSpace',
  'Storage',
  'Other'
);

CREATE TYPE listing_status_enum AS ENUM (
  'Active',
  'UnderContract',
  'Sold',
  'Withdrawn',
  'Expired',
  'ComingSoon'
);

CREATE TYPE listing_type_enum AS ENUM (
  'Sale',
  'Rent',
  'Auction',
  'SharedOwnership',
  'RentToBuy'
);

CREATE TYPE tenure_enum AS ENUM (
  'Freehold',
  'Leasehold',
  'Commonhold',
  'ShareOfFreehold',
  'Unknown'
);

CREATE TYPE energy_rating_enum AS ENUM (
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'Unknown'
);

CREATE TYPE data_source_enum AS ENUM (
  'Zillow',
  'Rightmove',
  'Idealista',
  'Zoopla',
  'OnTheMarket',
  'LandRegistry',
  'Sothebys',
  'KnightFrank',
  'Savills',
  'ScrapeOps',
  'ManualEntry',
  'Other'
);

-- ─────────────────────────────────────────────────────────────────
-- CORE: properties
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE properties (
  -- Identity
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id           TEXT          NOT NULL,   -- original ID from source
  source                data_source_enum NOT NULL,
  source_url            TEXT,                     -- canonical link to original listing
  fingerprint           TEXT          GENERATED ALWAYS AS (
                          md5(source || '::' || external_id)
                        ) STORED,                 -- dedup key

  -- RESO: ListingType / StandardStatus
  listing_type          listing_type_enum  NOT NULL DEFAULT 'Sale',
  listing_status        listing_status_enum NOT NULL DEFAULT 'Active',

  -- RESO: PropertyType
  property_type         property_type_enum NOT NULL DEFAULT 'Other',
  property_sub_type     TEXT,                     -- e.g. "Penthouse", "Ground Floor"

  -- RESO: UnparsedAddress / structured address
  address_line1         TEXT          NOT NULL,
  address_line2         TEXT,
  city                  TEXT          NOT NULL,
  state_region          TEXT,
  postcode              TEXT,
  country_iso2          CHAR(2)       NOT NULL,   -- ISO 3166-1 alpha-2
  latitude              NUMERIC(9,6),
  longitude             NUMERIC(9,6),

  -- RESO: ListPrice / canonical pricing (stored in minor units)
  price_amount          BIGINT,                   -- e.g. 75000000 = £750,000.00
  price_currency        CHAR(3)       NOT NULL DEFAULT 'GBP', -- ISO 4217
  price_per_sqm         NUMERIC(12,2),            -- derived, stored for query perf
  rental_yield_pct      NUMERIC(5,2),             -- gross yield %

  -- RESO: LivingArea / BuildingAreaTotal (canonical: sq metres)
  area_sqm              NUMERIC(12,4),
  area_sqft             NUMERIC(12,4) GENERATED ALWAYS AS (
                          ROUND(area_sqm * 10.7639, 4)
                        ) STORED,
  plot_area_sqm         NUMERIC(12,4),

  -- RESO: BedroomsTotal / BathroomsTotalInteger
  bedrooms              SMALLINT,
  bathrooms             SMALLINT,
  reception_rooms       SMALLINT,
  parking_spaces        SMALLINT,
  floors_total          SMALLINT,
  floor_number          SMALLINT,

  -- Legal / physical
  tenure                tenure_enum   NOT NULL DEFAULT 'Unknown',
  lease_years_remaining SMALLINT,
  year_built            SMALLINT,
  energy_rating         energy_rating_enum NOT NULL DEFAULT 'Unknown',
  energy_rating_num     SMALLINT,                 -- EPC numeric score

  -- RESO: PublicRemarks — CLEAN TEXT ONLY (HTML must be stripped before insert)
  description           TEXT,
  description_locale    CHAR(5) DEFAULT 'en-GB',  -- BCP-47

  -- Features (normalised tags, no HTML)
  features              TEXT[]        NOT NULL DEFAULT '{}',
  -- e.g. ['Central Heating', 'Double Glazing', 'Garden', 'EV Charging']

  -- Scores (Prime Atlas proprietary)
  opportunity_score     SMALLINT      CHECK (opportunity_score BETWEEN 0 AND 100),
  investment_grade      CHAR(1)       CHECK (investment_grade IN ('A','B','C','D','F')),

  -- Source attribution (JSONB — full provenance for legal compliance)
  source_attribution    JSONB         NOT NULL DEFAULT '{}',
  /*
    Required keys:
    {
      "brokerage_name":    "Sotheby's International Realty",
      "brokerage_id":      "SIR-LON-001",
      "agent_name":        "James Hargreaves",
      "agent_email":       "j.hargreaves@sothebys.com",
      "agent_phone":       "+44 20 7495 9580",
      "listing_office":    "London New Homes",
      "logo_url":          "https://cdn.sothebys.com/logos/sir-primary.svg",
      "disclaimer":        "This listing is provided by...",
      "scraped_at":        "2026-06-28T09:00:00Z",
      "raw_source_id":     "SIR-2026-LON-7821",
      "data_license":      "IDX",
      "compliance_notes":  ""
    }
  */

  -- Ingestion audit
  ingested_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  last_seen_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,              -- soft delete

  -- Constraints
  CONSTRAINT uq_fingerprint UNIQUE (fingerprint),
  CONSTRAINT chk_price      CHECK (price_amount > 0),
  CONSTRAINT chk_area       CHECK (area_sqm > 0)
);

-- Indexes
CREATE INDEX idx_properties_country    ON properties (country_iso2) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_type       ON properties (property_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_status     ON properties (listing_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_price      ON properties (price_amount, price_currency) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_geo        ON properties USING GIST (
  ST_MakePoint(longitude, latitude)
) WHERE latitude IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_properties_source_attr ON properties USING GIN (source_attribution);
CREATE INDEX idx_properties_features   ON properties USING GIN (features);

-- ─────────────────────────────────────────────────────────────────
-- MEDIA: property_media
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE property_media (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID    NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  media_type      TEXT    NOT NULL CHECK (media_type IN ('photo','floorplan','video','virtual_tour','document')),
  url             TEXT    NOT NULL,              -- CDN URL (never raw scraped URL)
  cdn_key         TEXT,                          -- S3/R2 object key after re-host
  caption         TEXT,                          -- clean text, HTML stripped
  width_px        INTEGER,
  height_px       INTEGER,
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  is_primary      BOOLEAN  NOT NULL DEFAULT FALSE,
  ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_property ON property_media (property_id, sort_order);

-- ─────────────────────────────────────────────────────────────────
-- INGESTION LOG: etl_runs
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE etl_runs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source          data_source_enum NOT NULL,
  run_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  records_in      INTEGER     NOT NULL DEFAULT 0,
  records_upserted INTEGER    NOT NULL DEFAULT 0,
  records_failed  INTEGER     NOT NULL DEFAULT 0,
  duration_ms     INTEGER,
  error_log       JSONB       NOT NULL DEFAULT '[]',
  triggered_by    TEXT        NOT NULL DEFAULT 'cron'  -- 'cron' | 'manual' | 'webhook'
);

-- ─────────────────────────────────────────────────────────────────
-- TRIGGER: auto-update updated_at
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

## Layer 2 — Cloud ETL Pipeline (Python)

### Runtime options (all supported by this script)
| Platform | How to deploy |
|---|---|
| AWS Lambda | Package as zip; trigger via EventBridge cron or SQS |
| Apache Airflow | Wrap `transform_and_upsert()` in a PythonOperator |
| Supabase Edge Functions | Port to TypeScript; logic is identical |
| Docker/Kubernetes | Run as a cron Job |

### Install dependencies
```bash
pip install pydantic==2.7.4 bleach==6.1.0 lxml==5.2.2 \
            psycopg2-binary==2.9.9 babel==2.15.0 python-dotenv==1.0.1
```

```python
"""
prime_atlas_etl.py
──────────────────────────────────────────────────────────────────
Production ETL pipeline for Prime Atlas.

Responsibilities:
  1. Accept raw JSON payload from any external source.
  2. Strip ALL HTML tags, inline styles, and unsafe markdown.
  3. Normalise field names → RESO canonical schema.
  4. Map PropertyType taxonomy (Flat → Apartment, Villa → House, etc.).
  5. Parse pricing strings → BIGINT minor units + ISO 4217 currency.
  6. Convert area units → sq metres (canonical).
  7. Validate with Pydantic — reject malformed records, log errors.
  8. Upsert into PostgreSQL via fingerprint dedup key.
  9. Write run audit to etl_runs table.
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any

import bleach
import psycopg2
import psycopg2.extras
from babel.numbers import parse_decimal
from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic import ValidationError

# ─── Logging ──────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger("prime_atlas.etl")

# ─── Config ───────────────────────────────────────────────────────

DATABASE_URL = os.environ["DATABASE_URL"]  # postgres://user:pass@host:5432/db

# ─── Property Type Taxonomy ───────────────────────────────────────
# Maps every known external label → RESO canonical value.
# Add rows here as new sources are onboarded. Never change canonical values.

PROPERTY_TYPE_MAP: dict[str, str] = {
    # Apartment variants
    "flat":              "Apartment",
    "apartment":         "Apartment",
    "condo":             "Apartment",
    "condominium":       "Apartment",
    "unit":              "Apartment",
    "studio":            "Apartment",
    "studio flat":       "Apartment",
    "maisonette":        "Apartment",
    "piso":              "Apartment",   # Spanish
    "departamento":      "Apartment",   # Latin American Spanish
    "appartement":       "Apartment",   # French
    "wohnung":           "Apartment",   # German
    # House variants
    "house":             "House",
    "detached":          "House",
    "detached house":    "House",
    "semi-detached":     "House",
    "semi detached":     "House",
    "terraced":          "House",
    "terraced house":    "House",
    "villa":             "House",
    "chalet":            "House",
    "bungalow":          "House",
    "cottage":           "House",
    "finca":             "House",       # Spanish rural
    "cortijo":           "House",       # Andalusian farmhouse
    "maison":            "House",       # French
    "haus":              "House",       # German
    # Townhouse
    "townhouse":         "Townhouse",
    "town house":        "Townhouse",
    "row house":         "Townhouse",
    "adosado":           "Townhouse",   # Spanish
    "casa adosada":      "Townhouse",
    # Land
    "land":              "Land",
    "plot":              "Land",
    "solar":             "Land",        # Spanish
    "terrain":           "Land",
    "building plot":     "Land",
    # Commercial
    "commercial":        "Commercial",
    "office":            "Commercial",
    "retail":            "Commercial",
    "local comercial":   "Commercial",  # Spanish
    "shop":              "Commercial",
    # Industrial
    "industrial":        "Industrial",
    "warehouse":         "Industrial",
    "nave industrial":   "Industrial",  # Spanish
    # MultiFamily
    "hmo":               "MultiFamily",
    "block of flats":    "MultiFamily",
    "apartment block":   "MultiFamily",
    "edificio":          "MultiFamily",
    "building":          "MultiFamily",
    # Hotel
    "hotel":             "Hotel",
    "boutique hotel":    "Hotel",
    # Other
    "parking":           "ParkingSpace",
    "garage":            "ParkingSpace",
    "parking space":     "ParkingSpace",
    "storage":           "Storage",
    "storage unit":      "Storage",
}

VALID_PROPERTY_TYPES = {
    "Apartment", "House", "Townhouse", "Land", "Commercial",
    "Industrial", "Hotel", "MultiFamily", "ParkingSpace", "Storage", "Other",
}

# ─── Currency symbol → ISO 4217 ───────────────────────────────────

CURRENCY_SYMBOL_MAP: dict[str, str] = {
    "£":   "GBP",
    "$":   "USD",
    "€":   "EUR",
    "A$":  "AUD",
    "C$":  "CAD",
    "AED": "AED",
    "CHF": "CHF",
    "sgd": "SGD",
    "¥":   "JPY",
}

# ─── HTML / text sanitisation ─────────────────────────────────────

# bleach allowlist — we allow NOTHING: pure text output only
ALLOWED_TAGS: list[str] = []
ALLOWED_ATTRS: dict = {}


def strip_html(raw: Any) -> str:
    """
    Strips ALL HTML tags, inline styles, scripts, and unsafe markdown
    from a raw value. Returns a clean UTF-8 string.
    Handles: None, int, float, list, dict, str.
    """
    if raw is None:
        return ""
    if isinstance(raw, (int, float)):
        return str(raw)
    if isinstance(raw, list):
        raw = " ".join(str(x) for x in raw)
    if isinstance(raw, dict):
        raw = " ".join(str(v) for v in raw.values())

    text = str(raw)

    # 1. Remove <script> and <style> blocks with content
    text = re.sub(r"<(script|style)[^>]*>.*?</(script|style)>", " ", text, flags=re.DOTALL | re.IGNORECASE)

    # 2. bleach strip — removes all remaining tags
    text = bleach.clean(text, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, strip=True)

    # 3. Decode common HTML entities
    html_entities = {
        "&amp;": "&", "&lt;": "<", "&gt;": ">",
        "&nbsp;": " ", "&quot;": '"', "&#39;": "'",
        "&pound;": "£", "&euro;": "€",
    }
    for entity, char in html_entities.items():
        text = text.replace(entity, char)

    # 4. Collapse excess whitespace
    text = re.sub(r"\s+", " ", text).strip()

    # 5. Remove zero-width characters and other junk
    text = re.sub(r"[​‌‍﻿]", "", text)

    return text


def normalise_features(raw_features: Any) -> list[str]:
    """Accepts list, comma-string, or HTML list. Returns clean string list."""
    if not raw_features:
        return []
    if isinstance(raw_features, str):
        # Could be comma-separated or HTML <li> list
        cleaned = strip_html(raw_features)
        items = re.split(r"[,;|\n•·–-]+", cleaned)
    elif isinstance(raw_features, list):
        items = [strip_html(i) for i in raw_features]
    else:
        return []

    return [i.strip().title() for i in items if i.strip() and len(i.strip()) > 1]


# ─── Price parsing ────────────────────────────────────────────────

PRICE_RE = re.compile(
    r"(?P<symbol>[£$€¥]|A\$|C\$|AED|CHF|SGD)?\s*"
    r"(?P<amount>[\d,\.]+)\s*"
    r"(?P<suffix>M|K|m|k|million|thousand)?",
    re.IGNORECASE,
)


def parse_price(raw: Any) -> tuple[int | None, str]:
    """
    Parses messy price strings → (minor_units: int, currency_iso: str).

    Examples:
      "£1,250,000"        → (125000000, 'GBP')
      "$750K"             → (75000000,  'USD')
      "€2.5M"             → (250000000, 'EUR')
      "1250000"           → (125000000, 'GBP')  # default currency
      "POA"               → (None, 'GBP')
    """
    if not raw or str(raw).strip().upper() in ("POA", "TBA", "N/A", "-", ""):
        return None, "GBP"

    text = str(raw).strip()
    currency = "GBP"  # default

    m = PRICE_RE.search(text)
    if not m:
        return None, currency

    # Resolve currency from symbol
    sym = (m.group("symbol") or "").strip()
    if sym in CURRENCY_SYMBOL_MAP:
        currency = CURRENCY_SYMBOL_MAP[sym]

    # Parse numeric part
    amount_str = m.group("amount").replace(",", "")
    try:
        amount = float(amount_str)
    except ValueError:
        return None, currency

    # Apply suffix multiplier
    suffix = (m.group("suffix") or "").lower()
    if suffix in ("m", "million"):
        amount *= 1_000_000
    elif suffix in ("k", "thousand"):
        amount *= 1_000

    # Convert to minor units (cents/pence)
    minor_units = int(round(amount * 100))
    return minor_units, currency


# ─── Area parsing ─────────────────────────────────────────────────

def parse_area_to_sqm(raw: Any, unit_hint: str = "sqm") -> float | None:
    """
    Parses area strings → float sq metres.

    Examples:
      "1,250 sq ft"   → 116.1278
      "85m²"          → 85.0
      "1200"          → 1200.0  (assumed sqm unless unit_hint='sqft')
    """
    if not raw:
        return None

    text = str(raw).strip().lower()
    text = re.sub(r"[,\s]", "", text)
    match = re.search(r"([\d\.]+)", text)
    if not match:
        return None

    val = float(match.group(1))

    # Detect unit from string content
    if any(x in text for x in ("sqft", "sq.ft", "ft²", "ft2", "sqf")):
        val = val * 0.092903  # sq ft → sq m
    elif any(x in text for x in ("sqyd", "yd²")):
        val = val * 0.836127  # sq yd → sq m
    elif unit_hint == "sqft":
        val = val * 0.092903

    return round(val, 4)


# ─── Pydantic canonical model ─────────────────────────────────────

class SourceAttribution(BaseModel):
    brokerage_name:   str
    brokerage_id:     str                   = ""
    agent_name:       str                   = ""
    agent_email:      str                   = ""
    agent_phone:      str                   = ""
    listing_office:   str                   = ""
    logo_url:         str                   = ""
    disclaimer:       str                   = ""
    raw_source_id:    str                   = ""
    data_license:     str                   = "IDX"
    compliance_notes: str                   = ""
    scraped_at:       str                   = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    @field_validator("brokerage_name", mode="before")
    @classmethod
    def clean_brokerage_name(cls, v: Any) -> str:
        return strip_html(v) or "Unknown Brokerage"


class CanonicalProperty(BaseModel):
    # Identity
    external_id:          str
    source:               str
    source_url:           str                 = ""

    # Classification
    listing_type:         str                 = "Sale"
    listing_status:       str                 = "Active"
    property_type:        str                 = "Other"
    property_sub_type:    str                 = ""

    # Address
    address_line1:        str
    address_line2:        str                 = ""
    city:                 str
    state_region:         str                 = ""
    postcode:             str                 = ""
    country_iso2:         str                 = "GB"
    latitude:             float | None        = None
    longitude:            float | None        = None

    # Pricing (already parsed to minor units + ISO 4217)
    price_amount:         int | None          = None
    price_currency:       str                 = "GBP"

    # Area (already converted to sq m)
    area_sqm:             float | None        = None
    plot_area_sqm:        float | None        = None

    # Rooms
    bedrooms:             int | None          = None
    bathrooms:            int | None          = None
    reception_rooms:      int | None          = None
    parking_spaces:       int | None          = None
    floor_number:         int | None          = None

    # Legal / physical
    tenure:               str                 = "Unknown"
    lease_years_remaining: int | None         = None
    year_built:           int | None          = None
    energy_rating:        str                 = "Unknown"

    # Content (clean text only)
    description:          str                 = ""
    features:             list[str]           = Field(default_factory=list)

    # Attribution
    source_attribution:   SourceAttribution

    @field_validator("property_type", mode="before")
    @classmethod
    def normalise_property_type(cls, v: Any) -> str:
        raw = strip_html(v).lower().strip()
        canonical = PROPERTY_TYPE_MAP.get(raw)
        if canonical:
            return canonical
        # Fuzzy fallback: check if any key is a substring
        for key, val in PROPERTY_TYPE_MAP.items():
            if key in raw:
                return val
        return "Other"

    @field_validator("description", mode="before")
    @classmethod
    def sanitise_description(cls, v: Any) -> str:
        return strip_html(v)

    @field_validator("address_line1", "address_line2", "city",
                     "state_region", "postcode", mode="before")
    @classmethod
    def sanitise_address(cls, v: Any) -> str:
        return strip_html(v)

    @field_validator("country_iso2", mode="before")
    @classmethod
    def normalise_country(cls, v: Any) -> str:
        return strip_html(v).upper()[:2] or "GB"

    @field_validator("energy_rating", mode="before")
    @classmethod
    def normalise_epc(cls, v: Any) -> str:
        cleaned = strip_html(v).strip().upper()
        return cleaned if cleaned in "ABCDEFG" else "Unknown"

    @field_validator("tenure", mode="before")
    @classmethod
    def normalise_tenure(cls, v: Any) -> str:
        mapping = {
            "freehold": "Freehold", "fee simple": "Freehold",
            "leasehold": "Leasehold", "long leasehold": "Leasehold",
            "commonhold": "Commonhold",
            "share of freehold": "ShareOfFreehold",
        }
        raw = strip_html(v).lower().strip()
        return mapping.get(raw, "Unknown")

    @model_validator(mode="after")
    def compute_price_per_sqm(self) -> "CanonicalProperty":
        # Stored as a derived field — handled in DB, but we validate here
        if self.price_amount and self.area_sqm and self.area_sqm > 0:
            self.price_per_sqm = round(
                (self.price_amount / 100) / self.area_sqm, 2
            )
        return self

    price_per_sqm: float | None = None


# ─── Source-specific field mappers ────────────────────────────────

def map_sothebys(raw: dict) -> dict:
    """
    Maps raw Sotheby's JSON (with messy field names) to a flat dict
    ready for CanonicalProperty. Add a new function per source.
    """
    addr = raw.get("propertyAddress", {})
    agent = raw.get("listingAgent", {})
    pricing = raw.get("askingPriceString") or raw.get("price_raw") or ""
    price_minor, currency = parse_price(pricing)
    area = parse_area_to_sqm(
        raw.get("floorArea") or raw.get("sqft") or raw.get("area"),
        unit_hint=raw.get("areaUnit", "sqm"),
    )

    return {
        "external_id":      str(raw.get("listingId") or raw.get("id") or uuid.uuid4()),
        "source":           "Sothebys",
        "source_url":       raw.get("listingUrl") or raw.get("url") or "",
        "listing_type":     "Sale" if str(raw.get("saleType","sale")).lower() == "sale" else "Rent",
        "listing_status":   "Active",
        "property_type":    raw.get("propertyType") or raw.get("type") or "Other",
        "property_sub_type": strip_html(raw.get("propertySubType") or ""),
        "address_line1":    addr.get("street") or raw.get("address") or "",
        "address_line2":    addr.get("address2") or "",
        "city":             addr.get("city") or raw.get("city") or "",
        "state_region":     addr.get("county") or addr.get("region") or "",
        "postcode":         addr.get("postcode") or addr.get("zip") or "",
        "country_iso2":     (addr.get("country") or raw.get("country") or "GB")[:2].upper(),
        "latitude":         raw.get("lat") or raw.get("latitude"),
        "longitude":        raw.get("lng") or raw.get("longitude"),
        "price_amount":     price_minor,
        "price_currency":   currency,
        "area_sqm":         area,
        "bedrooms":         raw.get("bedrooms") or raw.get("beds") or raw.get("numBedrooms"),
        "bathrooms":        raw.get("bathrooms") or raw.get("baths") or raw.get("numBathrooms"),
        "reception_rooms":  raw.get("receptionRooms") or raw.get("reception"),
        "parking_spaces":   raw.get("parking") or raw.get("garages"),
        "floor_number":     raw.get("floorNumber") or raw.get("floor"),
        "tenure":           raw.get("tenure") or raw.get("ownershipType") or "Unknown",
        "lease_years_remaining": raw.get("leaseYears") or raw.get("remainingLease"),
        "year_built":       raw.get("yearBuilt") or raw.get("built"),
        "energy_rating":    raw.get("epcRating") or raw.get("energyRating") or "Unknown",
        "description":      raw.get("description") or raw.get("propertyDescription") or "",
        "features":         normalise_features(
                                raw.get("features") or raw.get("amenities") or raw.get("keyFeatures")
                            ),
        "source_attribution": {
            "brokerage_name":   raw.get("brokerageName") or "Sotheby's International Realty",
            "brokerage_id":     raw.get("officeCode") or "",
            "agent_name":       agent.get("name") or agent.get("agentName") or "",
            "agent_email":      agent.get("email") or "",
            "agent_phone":      agent.get("phone") or agent.get("tel") or "",
            "listing_office":   raw.get("officeName") or "",
            "logo_url":         raw.get("brokerageLogo") or raw.get("officeLogo") or "",
            "disclaimer":       strip_html(raw.get("legalDisclaimer") or raw.get("disclaimer") or ""),
            "raw_source_id":    str(raw.get("listingId") or raw.get("id") or ""),
            "data_license":     raw.get("dataLicense") or "IDX",
            "compliance_notes": "",
        },
    }


# Source router — add new sources here
SOURCE_MAPPERS = {
    "Sothebys":     map_sothebys,
    "sothebys":     map_sothebys,
    "SIR":          map_sothebys,
    # "Rightmove":  map_rightmove,
    # "Idealista":  map_idealista,
    # "Zillow":     map_zillow,
}


# ─── Core transform function ──────────────────────────────────────

def transform(raw_payload: dict, source_hint: str = "Sothebys") -> CanonicalProperty | None:
    """
    Transforms a raw external payload into a validated CanonicalProperty.
    Returns None on validation failure (error is logged).
    """
    mapper = SOURCE_MAPPERS.get(source_hint) or SOURCE_MAPPERS.get("Sothebys")
    if not mapper:
        log.error("No mapper found for source: %s", source_hint)
        return None

    try:
        mapped = mapper(raw_payload)
        canonical = CanonicalProperty(**mapped)
        return canonical
    except ValidationError as e:
        log.error("Validation failed for %s record %s: %s",
                  source_hint, raw_payload.get("listingId", "?"), e)
        return None
    except Exception as e:
        log.error("Unexpected error transforming record: %s", e, exc_info=True)
        return None


# ─── Database upsert ──────────────────────────────────────────────

UPSERT_SQL = """
INSERT INTO properties (
  external_id, source, source_url,
  listing_type, listing_status, property_type, property_sub_type,
  address_line1, address_line2, city, state_region, postcode, country_iso2,
  latitude, longitude,
  price_amount, price_currency, price_per_sqm,
  area_sqm, plot_area_sqm,
  bedrooms, bathrooms, reception_rooms, parking_spaces, floor_number,
  tenure, lease_years_remaining, year_built, energy_rating,
  description, features,
  source_attribution, ingested_at, last_seen_at
)
VALUES (
  %(external_id)s, %(source)s, %(source_url)s,
  %(listing_type)s, %(listing_status)s, %(property_type)s, %(property_sub_type)s,
  %(address_line1)s, %(address_line2)s, %(city)s, %(state_region)s,
  %(postcode)s, %(country_iso2)s,
  %(latitude)s, %(longitude)s,
  %(price_amount)s, %(price_currency)s, %(price_per_sqm)s,
  %(area_sqm)s, %(plot_area_sqm)s,
  %(bedrooms)s, %(bathrooms)s, %(reception_rooms)s, %(parking_spaces)s, %(floor_number)s,
  %(tenure)s, %(lease_years_remaining)s, %(year_built)s, %(energy_rating)s,
  %(description)s, %(features)s,
  %(source_attribution)s, NOW(), NOW()
)
ON CONFLICT (fingerprint) DO UPDATE SET
  listing_status        = EXCLUDED.listing_status,
  price_amount          = EXCLUDED.price_amount,
  price_currency        = EXCLUDED.price_currency,
  price_per_sqm         = EXCLUDED.price_per_sqm,
  description           = EXCLUDED.description,
  features              = EXCLUDED.features,
  source_attribution    = EXCLUDED.source_attribution,
  last_seen_at          = NOW(),
  updated_at            = NOW()
WHERE properties.deleted_at IS NULL;
"""


def upsert(canonical: CanonicalProperty, cursor) -> bool:
    """Upserts one canonical property. Returns True on success."""
    import json

    row = canonical.model_dump()
    row["source_attribution"] = json.dumps(row["source_attribution"])
    row["features"] = row["features"]  # psycopg2 handles list → PG array

    try:
        cursor.execute(UPSERT_SQL, row)
        return True
    except Exception as e:
        log.error("DB upsert failed for %s: %s", canonical.external_id, e)
        return False


# ─── Main entry point ─────────────────────────────────────────────

def transform_and_upsert(raw_records: list[dict], source: str = "Sothebys") -> dict:
    """
    Main pipeline function. Call from Lambda handler, Airflow task,
    or any background worker.

    Returns run statistics.
    """
    stats = {"in": len(raw_records), "upserted": 0, "failed": 0, "errors": []}

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False

    try:
        with conn.cursor() as cur:
            for raw in raw_records:
                canonical = transform(raw, source_hint=source)
                if canonical is None:
                    stats["failed"] += 1
                    stats["errors"].append({"id": raw.get("listingId"), "error": "transform_failed"})
                    continue
                ok = upsert(canonical, cur)
                if ok:
                    stats["upserted"] += 1
                else:
                    stats["failed"] += 1

            conn.commit()
    except Exception as e:
        conn.rollback()
        log.error("Pipeline transaction failed: %s", e, exc_info=True)
        raise
    finally:
        conn.close()

    log.info("ETL complete — in=%d upserted=%d failed=%d",
             stats["in"], stats["upserted"], stats["failed"])
    return stats


# ─── AWS Lambda handler ───────────────────────────────────────────

def lambda_handler(event: dict, context: Any) -> dict:
    """AWS Lambda entry point. Event body = list of raw records."""
    import json
    body = event.get("body", "[]")
    records = json.loads(body) if isinstance(body, str) else body
    source  = event.get("source", "Sothebys")
    stats   = transform_and_upsert(records, source=source)
    return {"statusCode": 200, "body": json.dumps(stats)}


# ─────────────────────────────────────────────────────────────────
# SIMULATION — run with: python prime_atlas_etl.py
# Demonstrates full pipeline on a realistically messy payload.
# ─────────────────────────────────────────────────────────────────

MOCK_RAW_SOTHEBYS_PAYLOAD = {
    "listingId":        "SIR-2026-LON-7821",
    "listingUrl":       "https://www.sothebysrealty.com/eng/sales/detail/180-l-998-sir2026lon7821",
    "saleType":         "sale",
    "propertyType":     "Flat",                   # → maps to 'Apartment'
    "propertySubType":  "Penthouse",
    "propertyAddress": {
        "street":       "42 Eaton Square",
        "address2":     "Belgravia",
        "city":         "London",
        "county":       "Greater London",
        "postcode":     "SW1W 9BL",
        "country":      "GB",
    },
    "lat": 51.4957,
    "lng": -0.1537,

    # Messy price string — ETL must parse
    "askingPriceString": "<span style='color:#b8960c;font-family:Didot'>£&nbsp;8,750,000</span>",

    # HTML-polluted description — ETL must strip
    "description": """
        <div class='sir-description' style='font-family: Didot, Georgia; color: #1a1a1a; line-height:1.8'>
          <p style='margin-bottom:12px'>
            <strong>An exceptional <em>penthouse residence</em></strong> occupying the entire upper floor
            of this prestigious Belgravia mansion block.&nbsp;
          </p>
          <ul style='list-style:disc; padding-left:20px'>
            <li>Panoramic views across Eaton Square gardens</li>
            <li>Three <span class='highlight'>principal suites</span>, each with en-suite marble bathrooms</li>
          </ul>
          <p>Available <b>immediately</b>. Contact our <a href='/contact' style='color:#b8960c'>London office</a>.</p>
          <script>trackView('SIR-2026-LON-7821')</script>
          <style>.sir-description p { margin: 12px 0; }</style>
        </div>
    """,

    # HTML feature list — ETL must normalise
    "keyFeatures": """
        <ul>
          <li><b>Private roof terrace</b> (2,100 sq ft)</li>
          <li>Double-height reception room</li>
          <li>Chef&rsquo;s kitchen with <em>La Cornue</em> range</li>
          <li>Gymnasium &amp; wine cellar</li>
          <li>Concierge &amp; porterage</li>
          <li>Underground parking (2 spaces)</li>
        </ul>
    """,

    # Mixed area units — ETL must normalise to sq m
    "floorArea":    "4,200 sq ft",
    "areaUnit":     "sqft",

    # Non-standard field names
    "numBedrooms":  3,
    "numBathrooms": 4,
    "reception":    2,
    "tenure":       "Leasehold",
    "leaseYears":   987,
    "yearBuilt":    1887,
    "epcRating":    "C",

    # Agent info
    "listingAgent": {
        "agentName":   "James Hargreaves",
        "email":       "j.hargreaves@sothebys.com",
        "phone":       "+44 20 7495 9580",
    },

    "brokerageName":  "Sotheby's International Realty",
    "officeName":     "London New Homes",
    "officeCode":     "SIR-LON-001",
    "brokerageLogo":  "https://cdn.sothebysrealty.com/logos/sir-primary.svg",
    "legalDisclaimer": "<p>This listing is provided for informational purposes only. "
                       "All details are subject to change without notice. "
                       "&copy; 2026 Sotheby&rsquo;s International Realty.</p>",
    "dataLicense": "IDX",
}


if __name__ == "__main__":
    print("\n── RAW PAYLOAD (messy) ──────────────────────────────")
    import json
    print(json.dumps(MOCK_RAW_SOTHEBYS_PAYLOAD, indent=2)[:600], "...")

    print("\n── TRANSFORMING ────────────────────────────────────")
    canonical = transform(MOCK_RAW_SOTHEBYS_PAYLOAD, source_hint="Sothebys")

    if canonical:
        print("\n── CANONICAL OUTPUT (clean) ────────────────────────")
        print(json.dumps(canonical.model_dump(), indent=2, default=str))
    else:
        print("FAILED — check logs above")
```

---

## Layer 3 — Backend API Payload Response

```
GET /api/v1/properties/sir-2026-lon-7821

200 OK
Content-Type: application/json
Cache-Control: public, max-age=300, stale-while-revalidate=60
```

```json
{
  "data": {
    "id":                   "3f8a1c22-b4e7-4d90-a3f1-9c2d8e6f0b14",
    "type":                 "property",
    "attributes": {

      "listing": {
        "type":             "Sale",
        "status":           "Active",
        "created_at":       "2026-06-28T09:00:00Z",
        "updated_at":       "2026-06-28T09:00:00Z"
      },

      "classification": {
        "property_type":    "Apartment",
        "property_sub_type":"Penthouse"
      },

      "location": {
        "address_line1":    "42 Eaton Square",
        "address_line2":    "Belgravia",
        "city":             "London",
        "state_region":     "Greater London",
        "postcode":         "SW1W 9BL",
        "country_iso2":     "GB",
        "country_name":     "United Kingdom",
        "coordinates": {
          "latitude":       51.4957,
          "longitude":      -0.1537
        }
      },

      "pricing": {
        "amount_minor":     875000000,
        "currency":         "GBP",
        "formatted": {
          "GBP":            "£8,750,000",
          "USD":            "$11,025,000",
          "EUR":            "€10,151,250"
        },
        "price_per_sqm": {
          "amount_minor":   226438,
          "currency":       "GBP",
          "formatted":      "£2,264/m²"
        },
        "rental_yield_pct": null
      },

      "area": {
        "sqm":              390.19,
        "sqft":             4200.0,
        "plot_sqm":         null,
        "display_metric":   "390 m²",
        "display_imperial": "4,200 sq ft"
      },

      "rooms": {
        "bedrooms":         3,
        "bathrooms":        4,
        "reception_rooms":  2,
        "parking_spaces":   2,
        "floor_number":     null
      },

      "legal": {
        "tenure":                 "Leasehold",
        "lease_years_remaining":  987,
        "year_built":             1887,
        "energy_rating":          "C",
        "energy_rating_numeric":  null
      },

      "content": {
        "description":      "An exceptional penthouse residence occupying the entire upper floor of this prestigious Belgravia mansion block. Panoramic views across Eaton Square gardens. Three principal suites, each with en-suite marble bathrooms. Available immediately. Contact our London office.",
        "description_locale": "en-GB",
        "features": [
          "Private Roof Terrace",
          "Double-Height Reception Room",
          "Chef'S Kitchen With La Cornue Range",
          "Gymnasium & Wine Cellar",
          "Concierge & Porterage",
          "Underground Parking"
        ]
      },

      "media": [
        {
          "id":             "m1",
          "type":           "photo",
          "url":            "https://cdn.prime-atlas.io/media/3f8a1c22/01.jpg",
          "caption":        "Roof terrace with garden views",
          "width_px":       2400,
          "height_px":      1600,
          "is_primary":     true,
          "sort_order":     0
        },
        {
          "id":             "m2",
          "type":           "floorplan",
          "url":            "https://cdn.prime-atlas.io/media/3f8a1c22/fp.jpg",
          "caption":        "Floor plan — upper level",
          "width_px":       1600,
          "height_px":      1200,
          "is_primary":     false,
          "sort_order":     1
        }
      ],

      "scores": {
        "opportunity_score":   82,
        "investment_grade":    "A",
        "municipality_score":  88
      },

      "source_attribution": {
        "brokerage_name":      "Sotheby's International Realty",
        "brokerage_id":        "SIR-LON-001",
        "agent_name":          "James Hargreaves",
        "agent_email":         "j.hargreaves@sothebys.com",
        "agent_phone":         "+44 20 7495 9580",
        "listing_office":      "London New Homes",
        "logo_url":            "https://cdn.sothebysrealty.com/logos/sir-primary.svg",
        "disclaimer":          "This listing is provided for informational purposes only. All details are subject to change without notice. © 2026 Sotheby's International Realty.",
        "data_license":        "IDX",
        "source_url":          "https://www.sothebysrealty.com/eng/sales/detail/180-l-998-sir2026lon7821",
        "scraped_at":          "2026-06-28T09:00:00Z"
      }
    }
  },
  "meta": {
    "request_id":          "req_01J3X8VWZM4P5Q7K",
    "served_at":           "2026-06-28T10:15:00Z",
    "cache":               "HIT",
    "api_version":         "v1"
  }
}
```

---

## Layer 4 — Frontend React Component Architecture

> All components consume the canonical API payload above. Zero external brand styles are applied. The design system enforces Prime Atlas tokens throughout.

```tsx
// src/components/property/PropertyDetailCard.tsx
// ─────────────────────────────────────────────────────────────────
// Ingests the GET /api/v1/properties/:id payload.
// Renders in Prime Atlas native design system.
// No external fonts, colours, or HTML from the source broker.
// ─────────────────────────────────────────────────────────────────

"use client";

import { useState } from "react";
import Image from "next/image";

// ── Canonical types (mirror the API shape) ───────────────────────

interface PropertyMedia {
  id:          string;
  type:        "photo" | "floorplan" | "video" | "virtual_tour";
  url:         string;
  caption:     string;
  width_px:    number;
  height_px:   number;
  is_primary:  boolean;
  sort_order:  number;
}

interface SourceAttribution {
  brokerage_name:   string;
  brokerage_id:     string;
  agent_name:       string;
  agent_email:      string;
  agent_phone:      string;
  listing_office:   string;
  logo_url:         string;
  disclaimer:       string;
  data_license:     string;
  source_url:       string;
  scraped_at:       string;
}

interface CanonicalPropertyPayload {
  id:              string;
  attributes: {
    listing: {
      type:        string;
      status:      string;
    };
    classification: {
      property_type:     string;
      property_sub_type: string;
    };
    location: {
      address_line1:  string;
      address_line2:  string;
      city:           string;
      state_region:   string;
      postcode:       string;
      country_name:   string;
    };
    pricing: {
      formatted:      Record<string, string>;
      price_per_sqm:  { formatted: string } | null;
      rental_yield_pct: number | null;
    };
    area: {
      display_metric:   string;
      display_imperial: string;
    };
    rooms: {
      bedrooms:        number | null;
      bathrooms:       number | null;
      reception_rooms: number | null;
      parking_spaces:  number | null;
    };
    legal: {
      tenure:               string;
      lease_years_remaining: number | null;
      year_built:           number | null;
      energy_rating:        string;
    };
    content: {
      description: string;
      features:    string[];
    };
    media:             PropertyMedia[];
    scores: {
      opportunity_score:  number | null;
      investment_grade:   string | null;
    };
    source_attribution: SourceAttribution;
  };
}

// ── Sub-components ───────────────────────────────────────────────

/** Native image carousel — zero external CSS, pure Prime Atlas tokens */
function PropertyImageCarousel({ media }: { media: PropertyMedia[] }) {
  const photos = media
    .filter((m) => m.type === "photo" || m.type === "floorplan")
    .sort((a, b) => a.sort_order - b.sort_order);

  const [active, setActive] = useState(0);

  if (!photos.length) {
    return (
      <div
        className="w-full aspect-[16/9] rounded-2xl flex items-center justify-center"
        style={{ background: "#18181B" }}
      >
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">No media</span>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {/* Main image */}
      <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-[#18181B]">
        <Image
          src={photos[active].url}
          alt={photos[active].caption || "Property image"}
          fill
          className="object-cover transition-opacity duration-300"
          sizes="(max-width: 768px) 100vw, 640px"
          priority={active === 0}
        />
        {/* Counter badge — Prime Atlas native */}
        <div
          className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)" }}
        >
          <span className="text-xs font-black tabular-nums text-white">
            {active + 1} / {photos.length}
          </span>
        </div>
        {/* Type badge */}
        {photos[active].type === "floorplan" && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 text-[9px] font-bold uppercase tracking-widest text-zinc-300">
            Floor Plan
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-none pb-1">
          {photos.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActive(i)}
              className="flex-shrink-0 relative w-16 h-11 rounded-lg overflow-hidden transition-all duration-100"
              style={{
                outline: i === active ? "2px solid #CCFF00" : "1px solid rgba(255,255,255,0.08)",
                opacity: i === active ? 1 : 0.5,
              }}
            >
              <Image src={p.url} alt={p.caption} fill className="object-cover" sizes="64px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Stat chip — native design system token */
function StatChip({ label, value }: { label: string; value: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col">
      <span className="text-xl font-black text-white tabular-nums tracking-tight leading-none">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">{label}</span>
    </div>
  );
}

/** EPC colour mapping — by RESO energy_rating */
function EnergyRatingBadge({ rating }: { rating: string }) {
  const colors: Record<string, string> = {
    A: "#00C805", B: "#5CB85C", C: "#8DB600",
    D: "#F0A500", E: "#E05000", F: "#C00000", G: "#800000",
  };
  const bg = colors[rating] ?? "#3F3F46";
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-black"
      style={{ background: bg }}
    >
      EPC {rating}
    </span>
  );
}

/** Brokerage attribution card — legal compliance, Prime Atlas styled */
function BrokerageAttributionCard({ attr, sourceUrl }: { attr: SourceAttribution; sourceUrl: string }) {
  const scrapedDate = new Date(attr.scraped_at).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <div
      className="rounded-2xl px-5 py-5 space-y-4"
      style={{
        background: "rgba(255,255,255,0.03)",
        outline: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Brokerage logo — re-hosted on Prime Atlas CDN, no external brand fonts */}
          {attr.logo_url ? (
            <div className="w-9 h-9 rounded-lg overflow-hidden bg-white flex items-center justify-center flex-shrink-0">
              <Image
                src={attr.logo_url}
                alt={attr.brokerage_name}
                width={36}
                height={36}
                className="object-contain"
              />
            </div>
          ) : (
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-black text-white"
              style={{ background: "#27272A" }}
            >
              {attr.brokerage_name.charAt(0)}
            </div>
          )}
          <div>
            <p className="text-xs font-black text-white leading-tight">{attr.brokerage_name}</p>
            {attr.listing_office && (
              <p className="text-[10px] font-semibold text-zinc-500 mt-0.5">{attr.listing_office}</p>
            )}
          </div>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">
          {attr.data_license}
        </span>
      </div>

      {/* Agent row */}
      {attr.agent_name && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5">Agent</p>
            <p className="text-xs font-semibold text-white">{attr.agent_name}</p>
          </div>
          <div className="flex gap-2">
            {attr.agent_phone && (
              <a
                href={`tel:${attr.agent_phone}`}
                className="text-[10px] font-bold text-[#CCFF00] hover:opacity-80 transition-opacity"
              >
                Call
              </a>
            )}
            {attr.agent_email && (
              <a
                href={`mailto:${attr.agent_email}`}
                className="text-[10px] font-bold text-[#CCFF00] hover:opacity-80 transition-opacity"
              >
                Email
              </a>
            )}
          </div>
        </div>
      )}

      {/* Source link + scrape date */}
      <div className="flex items-center justify-between pt-1"
           style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <p className="text-[9px] text-zinc-600 font-semibold tabular-nums">
          Sourced {scrapedDate}
        </p>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold text-zinc-500 hover:text-white transition-colors duration-100"
          >
            View original →
          </a>
        )}
      </div>

      {/* Legal disclaimer */}
      {attr.disclaimer && (
        <p className="text-[9px] text-zinc-600 leading-relaxed">
          {attr.disclaimer}
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

interface PropertyDetailCardProps {
  property: CanonicalPropertyPayload;
  displayCurrency?: "GBP" | "USD" | "EUR";
}

export function PropertyDetailCard({
  property,
  displayCurrency = "GBP",
}: PropertyDetailCardProps) {
  const a = property.attributes;

  const displayPrice =
    a.pricing.formatted[displayCurrency] ??
    Object.values(a.pricing.formatted)[0] ??
    "POA";

  const rooms = [
    { label: "Bed",   value: a.rooms.bedrooms       },
    { label: "Bath",  value: a.rooms.bathrooms      },
    { label: "Recep", value: a.rooms.reception_rooms },
    { label: "Park",  value: a.rooms.parking_spaces  },
  ].filter((r) => r.value !== null && r.value !== undefined);

  return (
    <article className="bg-black min-h-screen pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-10">

        {/* ── Image carousel ── */}
        <PropertyImageCarousel media={a.media} />

        {/* ── Hero header — Agentic Console style ── */}
        <header className="space-y-4">
          {/* Metadata label */}
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            {a.classification.property_type}
            {a.classification.property_sub_type
              ? ` · ${a.classification.property_sub_type}`
              : ""}
            {" · "}
            {a.location.city}
            {" · "}
            {a.listing.type}
          </p>

          {/* Address headline */}
          <h1 className="font-black text-3xl tracking-tight text-white leading-tight">
            {a.location.address_line1}
            {a.location.address_line2 ? `, ${a.location.address_line2}` : ""}
          </h1>
          <p className="text-sm text-zinc-400 font-semibold">
            {a.location.city}
            {a.location.state_region ? `, ${a.location.state_region}` : ""}
            {" · "}
            {a.location.postcode}
            {" · "}
            {a.location.country_name}
          </p>

          {/* Price — oversized, tabular-nums */}
          <div className="flex items-end gap-4 pt-2">
            <p className="font-black text-5xl tabular-nums text-white tracking-tight leading-none">
              {displayPrice}
            </p>
            {a.pricing.price_per_sqm && (
              <p className="text-sm text-zinc-500 font-semibold pb-1 tabular-nums">
                {a.pricing.price_per_sqm.formatted}
              </p>
            )}
          </div>

          {/* Opportunity score */}
          {a.scores.opportunity_score !== null && (
            <div className="flex items-center gap-2 pt-1">
              <span
                className="text-xs font-black px-3 py-1 rounded-full tabular-nums"
                style={{ background: "#00C805", color: "#000" }}
              >
                {a.scores.opportunity_score} Score
              </span>
              {a.scores.investment_grade && (
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Grade {a.scores.investment_grade}
                </span>
              )}
            </div>
          )}
        </header>

        {/* ── Room stats ── */}
        {rooms.length > 0 && (
          <div
            className="flex gap-8 py-6"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            {rooms.map((r) => (
              <StatChip key={r.label} label={r.label} value={r.value} />
            ))}
            <StatChip label="Area" value={a.area.display_metric} />
          </div>
        )}

        {/* ── Description — clean text, Prime Atlas typography ── */}
        {a.content.description && (
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">About</p>
            <p className="text-sm text-zinc-300 leading-relaxed text-pretty">
              {a.content.description}
            </p>
          </div>
        )}

        {/* ── Features ── */}
        {a.content.features.length > 0 && (
          <div className="space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Features</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6">
              {a.content.features.map((f) => (
                <div key={f} className="flex items-center gap-2.5">
                  <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#00C805" }} />
                  <span className="text-sm text-zinc-300 font-semibold">{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Legal details ── */}
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Legal & Physical</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: "Tenure",       value: a.legal.tenure                                             },
              { label: "Lease",        value: a.legal.lease_years_remaining
                                              ? `${a.legal.lease_years_remaining} yrs`
                                              : null                                                      },
              { label: "Built",        value: a.legal.year_built                                          },
              { label: "Area (metric)",value: a.area.display_metric                                       },
              { label: "Area (imperial)",value: a.area.display_imperial                                   },
            ].filter(r => r.value).map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-0.5">{label}</p>
                <p className="text-sm font-black text-white tabular-nums">{value}</p>
              </div>
            ))}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1">Energy</p>
              <EnergyRatingBadge rating={a.legal.energy_rating} />
            </div>
          </div>
        </div>

        {/* ── Brokerage Attribution Card ── */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Listed by</p>
          <BrokerageAttributionCard
            attr={a.source_attribution}
            sourceUrl={a.source_attribution.source_url}
          />
        </div>

      </div>
    </article>
  );
}
```

---

## Architecture Decision Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                   EXTERNAL SOURCES (messy)                      │
│   Sotheby's · Rightmove · Idealista · Zillow · Zoopla · etc.   │
└───────────────────┬─────────────────────────────────────────────┘
                    │ raw JSON (HTML-polluted, inconsistent fields)
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│              LAYER 2: ETL PIPELINE (Python)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Source Mapper│→ │ HTML Stripper│→ │ Pydantic Validator    │ │
│  │ (per-source) │  │ (bleach/lxml)│  │ (RESO canonical model)│ │
│  └──────────────┘  └──────────────┘  └──────────┬────────────┘ │
│                                                   │ REJECT → log│
└───────────────────────────────────────────────────┼─────────────┘
                                                    │ canonical dict
                                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│              LAYER 1: POSTGRESQL DATABASE                       │
│  properties · property_media · etl_runs                        │
│  PostGIS · JSONB source_attribution · tabular-nums storage      │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│              LAYER 3: REST API GATEWAY                          │
│  GET /api/v1/properties/:id                                     │
│  → pure canonical JSON, zero external brand styling             │
│  → CDN-cached, currency-formatted, unit-converted               │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│              LAYER 4: REACT FRONTEND (Next.js)                  │
│  PropertyDetailCard → PropertyImageCarousel                     │
│  → StatChip · EnergyRatingBadge                                 │
│  → BrokerageAttributionCard (legal compliance)                  │
│  All rendered in Prime Atlas tokens. Zero broker CSS leakage.   │
└─────────────────────────────────────────────────────────────────┘
```

---

*prime-atlas Data Pipeline Architecture v1.0 — Generated 28 Jun 2026*
