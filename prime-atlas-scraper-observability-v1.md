# Prime Atlas — Scraper Observability Layer v1.0

> **Scope**: End-to-end monitoring, logging, validation, and alerting for all Prime Atlas web scrapers. Designed to detect broken selectors within one scrape cycle and surface full health status to an internal admin dashboard.

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                    SCRAPER CONFIGURATION REGISTRY                    │
│              PostgreSQL: scraper_targets + scraper_fields            │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ config loaded at runtime
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    SCRAPER EXECUTION WRAPPER                         │
│              ScraperSession — structured logging + timing            │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ raw records
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    FIELD VALIDATION LAYER                            │
│              ScraperValidator — critical field checks                │
│              Halt-on-null · FieldFailureError · run audit            │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ clean records only
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    ETL PIPELINE (Layer 2)                            │
│              transform() → upsert() → PostgreSQL                     │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ aggregated run stats
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY DASHBOARD API                       │
│              GET /api/v1/admin/scraper-health                        │
│              Real-time health · failure rates · alert flags          │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1 — Configuration Registry

### Design Principles
- Every scraper target is a row, not a hardcoded config file.
- `scraper_fields` stores the exact CSS/XPath selectors and marks which are **critical** — meaning a null value on a critical field triggers an immediate halt and alert.
- `status` is machine-managed: the system auto-sets `degraded` or `broken` based on failure rate thresholds.
- Changing a selector is a DB update, not a code deployment.

### PostgreSQL Schema

```sql
-- ─────────────────────────────────────────────────────────────────
-- ENUM: scraper lifecycle states
-- ─────────────────────────────────────────────────────────────────

CREATE TYPE scraper_status_enum AS ENUM (
  'active',      -- running normally, failure rate < 5%
  'degraded',    -- partial failures, 5–25% field extraction failures
  'broken',      -- critical field failures, import halted
  'paused',      -- manually disabled (e.g. site maintenance)
  'retired'      -- source no longer supported
);

CREATE TYPE scraper_method_enum AS ENUM (
  'html_scrape',    -- HTML CSS/XPath selector
  'api_rest',       -- JSON REST API
  'api_graphql',    -- GraphQL API
  'rss_feed',       -- RSS/Atom feed
  'sitemap_xml'     -- XML sitemap
);

-- ─────────────────────────────────────────────────────────────────
-- TABLE: scraper_targets
-- Central registry for every external data source
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE scraper_targets (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  scraper_id            TEXT          NOT NULL UNIQUE,
  -- e.g. 'zillow-us', 'rightmove-uk', 'idealista-es', 'sothebys-global'

  -- Identity
  display_name          TEXT          NOT NULL,
  source_domain         TEXT          NOT NULL,       -- e.g. 'www.zillow.com'
  source_enum           TEXT          NOT NULL,       -- matches data_source_enum in properties
  method                scraper_method_enum NOT NULL DEFAULT 'html_scrape',
  country_iso2          CHAR(2)       NOT NULL,
  base_url              TEXT          NOT NULL,       -- entry point URL(s)

  -- Schedule
  cron_expression       TEXT          NOT NULL,       -- '0 3 * * *' = 3am UTC daily
  timezone              TEXT          NOT NULL DEFAULT 'UTC',
  rate_limit_rps        NUMERIC(4,1)  NOT NULL DEFAULT 1.0,  -- requests per second
  concurrent_workers    SMALLINT      NOT NULL DEFAULT 3,

  -- Health thresholds
  degraded_threshold_pct  NUMERIC(5,2) NOT NULL DEFAULT 5.0,
  -- auto-set to 'degraded' if field failure rate exceeds this
  broken_threshold_pct    NUMERIC(5,2) NOT NULL DEFAULT 25.0,
  -- auto-set to 'broken' if field failure rate exceeds this
  min_records_per_run   INTEGER       NOT NULL DEFAULT 10,
  -- alert if fewer records returned than this

  -- Current status (machine-managed)
  status                scraper_status_enum NOT NULL DEFAULT 'active',
  last_run_at           TIMESTAMPTZ,
  last_success_at       TIMESTAMPTZ,
  last_failure_at       TIMESTAMPTZ,
  consecutive_failures  SMALLINT      NOT NULL DEFAULT 0,

  -- Alert routing
  alert_email           TEXT,
  alert_slack_webhook   TEXT,
  alert_pagerduty_key   TEXT,

  -- Metadata
  requires_proxy        BOOLEAN       NOT NULL DEFAULT TRUE,
  requires_js_render    BOOLEAN       NOT NULL DEFAULT FALSE,
  -- TRUE = needs Playwright/Puppeteer, not requests
  notes                 TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
-- TABLE: scraper_fields
-- Per-source field selector map with criticality flags
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE scraper_fields (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  scraper_id          TEXT    NOT NULL REFERENCES scraper_targets(scraper_id) ON DELETE CASCADE,
  canonical_field     TEXT    NOT NULL,
  -- must match a CanonicalProperty field name from Layer 2
  -- e.g. 'price_amount', 'address_line1', 'bedrooms', 'description'

  selector_type       TEXT    NOT NULL CHECK (selector_type IN ('css','xpath','json_path','regex','constant')),
  selector_value      TEXT    NOT NULL,
  -- e.g. 'span[data-testid="price"]' or '//div[@class="price"]/text()'

  -- Fallback selector (used if primary fails)
  fallback_selector   TEXT,

  -- Criticality — drives halt/alert logic
  is_critical         BOOLEAN NOT NULL DEFAULT FALSE,
  -- TRUE = halt record import if this field is null/empty

  -- Validation rules
  expected_type       TEXT    NOT NULL DEFAULT 'string',
  -- 'string' | 'integer' | 'float' | 'url' | 'date' | 'array'
  min_length          INTEGER,
  max_length          INTEGER,
  regex_pattern       TEXT,

  -- Health tracking (updated after each run)
  last_success_at     TIMESTAMPTZ,
  last_failure_at     TIMESTAMPTZ,
  failure_count_24h   INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT uq_scraper_field UNIQUE (scraper_id, canonical_field)
);

-- ─────────────────────────────────────────────────────────────────
-- TABLE: scraper_runs
-- Append-only audit log — one row per scraper execution
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE scraper_runs (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scraper_id            TEXT        NOT NULL REFERENCES scraper_targets(scraper_id),
  run_id                TEXT        NOT NULL UNIQUE,
  -- e.g. 'zillow-us-20260628-030000'

  -- Timing
  started_at            TIMESTAMPTZ NOT NULL,
  finished_at           TIMESTAMPTZ,
  duration_ms           INTEGER     GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000
  ) STORED,

  -- Volume
  pages_fetched         INTEGER     NOT NULL DEFAULT 0,
  records_attempted     INTEGER     NOT NULL DEFAULT 0,
  records_passed        INTEGER     NOT NULL DEFAULT 0,    -- passed validation
  records_failed        INTEGER     NOT NULL DEFAULT 0,    -- failed validation
  records_upserted      INTEGER     NOT NULL DEFAULT 0,    -- written to properties

  -- Field-level stats (JSON: { "field_name": { "failures": N, "pct": X.X } })
  field_failure_stats   JSONB       NOT NULL DEFAULT '{}',

  -- Error log (array of structured error objects)
  error_log             JSONB       NOT NULL DEFAULT '[]',

  -- Outcome
  exit_status           TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (exit_status IN ('pending','success','degraded','failed','aborted')),
  abort_reason          TEXT,       -- populated if exit_status = 'aborted'

  -- Infrastructure
  triggered_by          TEXT        NOT NULL DEFAULT 'cron',  -- 'cron'|'manual'|'webhook'
  worker_id             TEXT,       -- Lambda request ID or Airflow task ID
  proxy_credits_used    INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX idx_runs_scraper_started ON scraper_runs (scraper_id, started_at DESC);
CREATE INDEX idx_runs_exit_status     ON scraper_runs (exit_status, started_at DESC);
```

### Seed Data — Active Scrapers

```sql
INSERT INTO scraper_targets (
  scraper_id, display_name, source_domain, source_enum, method,
  country_iso2, base_url, cron_expression, rate_limit_rps,
  requires_proxy, requires_js_render, alert_email,
  degraded_threshold_pct, broken_threshold_pct, min_records_per_run
) VALUES
  ('zillow-us',      'Zillow US',                  'www.zillow.com',
   'Zillow',         'html_scrape', 'US',
   'https://www.zillow.com/homes/for_sale/',
   '0 3 * * *', 0.5, TRUE, FALSE, 'ops@prime-atlas.io', 5.0, 25.0, 50),

  ('rightmove-uk',   'Rightmove UK',               'www.rightmove.co.uk',
   'Rightmove',      'html_scrape', 'GB',
   'https://www.rightmove.co.uk/property-for-sale/',
   '0 3 * * *', 1.0, TRUE, FALSE, 'ops@prime-atlas.io', 5.0, 20.0, 100),

  ('idealista-es',   'Idealista Spain',            'www.idealista.com',
   'Idealista',      'html_scrape', 'ES',
   'https://www.idealista.com/venta-viviendas/',
   '0 4 * * *', 0.3, TRUE, TRUE,  'ops@prime-atlas.io', 8.0, 30.0, 50),

  ('zoopla-uk',      'Zoopla UK',                  'www.zoopla.co.uk',
   'Zoopla',         'html_scrape', 'GB',
   'https://www.zoopla.co.uk/for-sale/',
   '0 3 * * *', 1.0, TRUE, FALSE, 'ops@prime-atlas.io', 5.0, 20.0, 50),

  ('sothebys-global','Sotheby''s International',   'www.sothebysrealty.com',
   'Sothebys',       'html_scrape', 'GB',
   'https://www.sothebysrealty.com/eng/sales/',
   '0 5 * * *', 0.5, TRUE, FALSE, 'ops@prime-atlas.io', 10.0, 35.0, 5),

  ('onthemarket-uk', 'OnTheMarket UK',             'www.onthemarket.com',
   'OnTheMarket',    'html_scrape', 'GB',
   'https://www.onthemarket.com/for-sale/',
   '30 3 * * *', 1.0, TRUE, FALSE,'ops@prime-atlas.io', 5.0, 20.0, 50);

-- Field selectors for Zillow (example — add all sources)
INSERT INTO scraper_fields (scraper_id, canonical_field, selector_type, selector_value, fallback_selector, is_critical, expected_type) VALUES
  ('zillow-us', 'price_amount',   'css', 'span[data-testid="price"]',              '[class*="Price"]',               TRUE,  'string'),
  ('zillow-us', 'address_line1',  'css', 'h1[data-testid="bdp-building-address"]', '[class*="streetAddress"]',       TRUE,  'string'),
  ('zillow-us', 'city',           'css', 'span[data-testid="bdp-city-state-zip"]', '[class*="cityState"]',           TRUE,  'string'),
  ('zillow-us', 'bedrooms',       'css', 'span[data-testid="bed-bath-item"] strong','[class*="bed"] strong',          FALSE, 'integer'),
  ('zillow-us', 'bathrooms',      'css', 'span[data-testid="bed-bath-item"] strong','[class*="bath"] strong',         FALSE, 'integer'),
  ('zillow-us', 'area_sqm',       'css', 'span[data-testid="sqft"]',               '[class*="sqft"]',                FALSE, 'string'),
  ('zillow-us', 'description',    'css', 'div[data-testid="description"]',         '[class*="Description"]',         FALSE, 'string'),
  ('zillow-us', 'property_type',  'css', '[data-testid="home-type-chip"]',         'span[class*="HomeType"]',        FALSE, 'string'),
  ('zillow-us', 'media',          'css', 'div[data-testid="photo-gallery"] img',   '[class*="photo"] img',           TRUE,  'array');
```

### Equivalent JSON Config (for Lambda/worker bootstrap)

```json
{
  "scraper_id":              "zillow-us",
  "display_name":            "Zillow US",
  "source_domain":           "www.zillow.com",
  "source_enum":             "Zillow",
  "method":                  "html_scrape",
  "country_iso2":            "US",
  "base_url":                "https://www.zillow.com/homes/for_sale/",
  "cron_expression":         "0 3 * * *",
  "rate_limit_rps":          0.5,
  "requires_proxy":          true,
  "requires_js_render":      false,
  "degraded_threshold_pct":  5.0,
  "broken_threshold_pct":    25.0,
  "min_records_per_run":     50,
  "alert_email":             "ops@prime-atlas.io",
  "fields": [
    { "canonical_field": "price_amount",  "selector_type": "css", "selector_value": "span[data-testid=\"price\"]",              "fallback": "[class*=\"Price\"]",          "is_critical": true,  "expected_type": "string"  },
    { "canonical_field": "address_line1", "selector_type": "css", "selector_value": "h1[data-testid=\"bdp-building-address\"]", "fallback": "[class*=\"streetAddress\"]",   "is_critical": true,  "expected_type": "string"  },
    { "canonical_field": "city",          "selector_type": "css", "selector_value": "span[data-testid=\"bdp-city-state-zip\"]", "fallback": "[class*=\"cityState\"]",       "is_critical": true,  "expected_type": "string"  },
    { "canonical_field": "bedrooms",      "selector_type": "css", "selector_value": "span[data-testid=\"bed-bath-item\"] strong","fallback": "[class*=\"bed\"] strong",     "is_critical": false, "expected_type": "integer" },
    { "canonical_field": "area_sqm",      "selector_type": "css", "selector_value": "span[data-testid=\"sqft\"]",               "fallback": "[class*=\"sqft\"]",            "is_critical": false, "expected_type": "string"  },
    { "canonical_field": "media",         "selector_type": "css", "selector_value": "div[data-testid=\"photo-gallery\"] img",   "fallback": "[class*=\"photo\"] img",       "is_critical": true,  "expected_type": "array"   }
  ]
}
```

---

## Layer 2 — Enterprise Logging & Tracking Wrapper

```python
"""
prime_atlas_scraper_session.py
──────────────────────────────────────────────────────────────────
ScraperSession: context-manager wrapper for every scraper run.

Responsibilities:
  - Generate a unique run_id for correlation across all log systems
  - Emit structured JSON log lines (compatible with CloudWatch, Datadog,
    Grafana Loki, or any log aggregator)
  - Track per-field failure counts in real time
  - On exit, write a complete audit row to scraper_runs
  - Fire alerts (email / Slack / PagerDuty) on status thresholds

Usage:
  with ScraperSession(config=config, db_conn=conn) as session:
      for page_html in fetch_pages():
          session.record_page_fetched()
          record = parse_page(page_html)
          session.record_attempt()
          validated = session.validate(record)
          if validated:
              session.record_success()
              upsert(validated)
          # failures are recorded automatically inside validate()
"""

from __future__ import annotations

import json
import logging
import os
import smtplib
import time
import traceback
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.mime.text import MIMEText
from typing import Any

import httpx  # for Slack webhook; pip install httpx

# ─── Structured JSON formatter ────────────────────────────────────
# Emits one JSON object per log line — ingested directly by
# CloudWatch Insights, Datadog, Grafana Loki, or Splunk.

class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts":          datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level":       record.levelname,
            "logger":      record.name,
            "message":     record.getMessage(),
            "service":     "prime-atlas-scraper",
        }
        # Merge any extra fields attached to the record
        for key, val in record.__dict__.items():
            if key.startswith("pa_"):  # our custom fields prefix
                payload[key[3:]] = val  # strip 'pa_' prefix in output
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)

def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.DEBUG)
    return logger

log = get_logger("prime_atlas.scraper")

# ─── Data classes ─────────────────────────────────────────────────

@dataclass
class FieldFailure:
    """One field extraction failure event."""
    canonical_field:  str
    record_external_id: str
    selector_used:    str
    raw_value:        Any
    failure_reason:   str
    is_critical:      bool
    timestamp:        str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_dict(self) -> dict:
        return {
            "canonical_field":     self.canonical_field,
            "record_external_id":  self.record_external_id,
            "selector_used":       self.selector_used,
            "raw_value":           repr(self.raw_value)[:200],
            "failure_reason":      self.failure_reason,
            "is_critical":         self.is_critical,
            "timestamp":           self.timestamp,
        }

@dataclass
class ScraperConfig:
    """Loaded from scraper_targets + scraper_fields tables."""
    scraper_id:              str
    display_name:            str
    source_domain:           str
    source_enum:             str
    degraded_threshold_pct:  float = 5.0
    broken_threshold_pct:    float = 25.0
    min_records_per_run:     int   = 10
    alert_email:             str   = ""
    alert_slack_webhook:     str   = ""
    alert_pagerduty_key:     str   = ""
    fields:                  list  = field(default_factory=list)

# ─── ScraperSession ───────────────────────────────────────────────

class ScraperSession:
    """
    Context manager that wraps one complete scraper run.
    All scraper code runs inside this context.

    Provides:
      - Unique run_id for log correlation
      - Real-time per-field failure tracking
      - Automatic status calculation on exit
      - DB audit row write on exit
      - Alert dispatch on degraded/broken status
    """

    def __init__(self, config: ScraperConfig, db_conn):
        self.config    = config
        self.db        = db_conn
        self.run_id    = self._make_run_id()
        self._started  = datetime.now(timezone.utc)
        self._log      = get_logger(f"prime_atlas.scraper.{config.scraper_id}")

        # Counters
        self.pages_fetched      = 0
        self.records_attempted  = 0
        self.records_passed     = 0
        self.records_failed     = 0
        self.records_upserted   = 0
        self.proxy_credits_used = 0

        # Per-field failure tracking: { "price_amount": [FieldFailure, ...] }
        self._field_failures: dict[str, list[FieldFailure]] = {}

        self.exit_status  = "pending"
        self.abort_reason: str | None = None

    def _make_run_id(self) -> str:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        return f"{self.config.scraper_id}-{ts}"

    # ── Lifecycle ──────────────────────────────────────────────────

    def __enter__(self) -> "ScraperSession":
        self._log.info(
            "Scraper run started",
            extra={
                "pa_run_id":    self.run_id,
                "pa_scraper_id": self.config.scraper_id,
                "pa_domain":    self.config.source_domain,
                "pa_event":     "run_start",
            }
        )
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        finished = datetime.now(timezone.utc)
        duration_ms = int((finished - self._started).total_seconds() * 1000)

        # Determine exit status
        if exc_type is not None:
            self.exit_status  = "failed"
            self.abort_reason = f"{exc_type.__name__}: {exc_val}"
        else:
            self.exit_status = self._calculate_status()

        field_stats = self._build_field_stats()
        error_log   = self._build_error_log()

        # Structured summary log — always emitted
        self._log.info(
            "Scraper run complete",
            extra={
                "pa_run_id":            self.run_id,
                "pa_scraper_id":        self.config.scraper_id,
                "pa_domain":            self.config.source_domain,
                "pa_event":             "run_complete",
                "pa_exit_status":       self.exit_status,
                "pa_duration_ms":       duration_ms,
                "pa_pages_fetched":     self.pages_fetched,
                "pa_records_attempted": self.records_attempted,
                "pa_records_passed":    self.records_passed,
                "pa_records_failed":    self.records_failed,
                "pa_records_upserted":  self.records_upserted,
                "pa_proxy_credits":     self.proxy_credits_used,
                "pa_field_stats":       field_stats,
            }
        )

        # Write audit row
        self._write_run_record(finished, duration_ms, field_stats, error_log)

        # Update scraper_targets status
        self._update_target_status()

        # Fire alerts if degraded or broken
        if self.exit_status in ("degraded", "failed", "aborted"):
            self._dispatch_alert(
                level="warning",
                message=f"Scraper {self.config.scraper_id} is {self.exit_status}. "
                        f"Field failures: {self.records_failed}/{self.records_attempted}. "
                        f"Run: {self.run_id}"
            )
        elif self.exit_status == "broken":
            self._dispatch_alert(
                level="critical",
                message=f"🚨 BROKEN: {self.config.display_name} ({self.config.scraper_id}). "
                        f"Critical fields are returning null — possible site layout change. "
                        f"Import HALTED. Run: {self.run_id}"
            )

        # Suppress exception if it was an expected scraper abort
        # (let unexpected exceptions propagate)
        return False

    # ── Counter methods (called by scraper code) ───────────────────

    def record_page_fetched(self, count: int = 1) -> None:
        self.pages_fetched += count

    def record_attempt(self, count: int = 1) -> None:
        self.records_attempted += count

    def record_success(self, count: int = 1) -> None:
        self.records_passed += count

    def record_upserted(self, count: int = 1) -> None:
        self.records_upserted += count

    def record_proxy_credits(self, credits: int) -> None:
        self.proxy_credits_used += credits

    def record_field_failure(self, failure: FieldFailure) -> None:
        """Called by ScraperValidator on every null/invalid field."""
        field = failure.canonical_field
        if field not in self._field_failures:
            self._field_failures[field] = []
        self._field_failures[field].append(failure)

        level = logging.ERROR if failure.is_critical else logging.WARNING
        self._log.log(
            level,
            f"Field extraction failure: {field}",
            extra={
                "pa_run_id":          self.run_id,
                "pa_scraper_id":      self.config.scraper_id,
                "pa_event":           "field_failure",
                "pa_field":           failure.canonical_field,
                "pa_is_critical":     failure.is_critical,
                "pa_reason":          failure.failure_reason,
                "pa_record_id":       failure.record_external_id,
                "pa_selector":        failure.selector_used,
            }
        )

    # ── Internal helpers ───────────────────────────────────────────

    def _calculate_status(self) -> str:
        if self.records_attempted == 0:
            # No records at all — assume broken
            return "broken"

        if self.records_attempted < self.config.min_records_per_run:
            # Too few records returned — likely site structure change
            self._log.warning(
                "Fewer records than minimum threshold",
                extra={
                    "pa_run_id":   self.run_id,
                    "pa_event":    "low_record_count",
                    "pa_actual":   self.records_attempted,
                    "pa_minimum":  self.config.min_records_per_run,
                }
            )
            return "degraded"

        failure_rate = (self.records_failed / self.records_attempted) * 100

        if failure_rate >= self.config.broken_threshold_pct:
            return "broken"
        if failure_rate >= self.config.degraded_threshold_pct:
            return "degraded"
        return "success"

    def _build_field_stats(self) -> dict:
        stats = {}
        for fname, failures in self._field_failures.items():
            attempted = self.records_attempted or 1
            pct = round((len(failures) / attempted) * 100, 2)
            stats[fname] = {
                "failures":    len(failures),
                "pct":         pct,
                "is_critical": failures[0].is_critical if failures else False,
            }
        return stats

    def _build_error_log(self) -> list[dict]:
        errors = []
        for failures in self._field_failures.values():
            # Cap to first 50 failures per field to prevent log bloat
            for f in failures[:50]:
                errors.append(f.to_dict())
        return errors

    def _write_run_record(self, finished, duration_ms, field_stats, error_log) -> None:
        try:
            with self.db.cursor() as cur:
                cur.execute("""
                    INSERT INTO scraper_runs (
                      scraper_id, run_id, started_at, finished_at,
                      pages_fetched, records_attempted, records_passed,
                      records_failed, records_upserted,
                      field_failure_stats, error_log,
                      exit_status, abort_reason,
                      triggered_by, proxy_credits_used
                    ) VALUES (
                      %(scraper_id)s, %(run_id)s, %(started_at)s, %(finished_at)s,
                      %(pages_fetched)s, %(records_attempted)s, %(records_passed)s,
                      %(records_failed)s, %(records_upserted)s,
                      %(field_stats)s, %(error_log)s,
                      %(exit_status)s, %(abort_reason)s,
                      'cron', %(proxy_credits)s
                    )
                """, {
                    "scraper_id":       self.config.scraper_id,
                    "run_id":           self.run_id,
                    "started_at":       self._started,
                    "finished_at":      finished,
                    "pages_fetched":    self.pages_fetched,
                    "records_attempted":self.records_attempted,
                    "records_passed":   self.records_passed,
                    "records_failed":   self.records_failed,
                    "records_upserted": self.records_upserted,
                    "field_stats":      json.dumps(field_stats),
                    "error_log":        json.dumps(error_log),
                    "exit_status":      self.exit_status,
                    "abort_reason":     self.abort_reason,
                    "proxy_credits":    self.proxy_credits_used,
                })
            self.db.commit()
        except Exception as e:
            self._log.error("Failed to write run record: %s", e, exc_info=True)

    def _update_target_status(self) -> None:
        try:
            with self.db.cursor() as cur:
                cur.execute("""
                    UPDATE scraper_targets SET
                      status               = %(status)s,
                      last_run_at          = NOW(),
                      last_success_at      = CASE WHEN %(ok)s THEN NOW()
                                             ELSE last_success_at END,
                      last_failure_at      = CASE WHEN NOT %(ok)s THEN NOW()
                                             ELSE last_failure_at END,
                      consecutive_failures = CASE WHEN %(ok)s THEN 0
                                             ELSE consecutive_failures + 1 END,
                      updated_at           = NOW()
                    WHERE scraper_id = %(scraper_id)s
                """, {
                    "status":     self.exit_status,
                    "ok":         self.exit_status == "success",
                    "scraper_id": self.config.scraper_id,
                })
            self.db.commit()
        except Exception as e:
            self._log.error("Failed to update target status: %s", e, exc_info=True)

    def _dispatch_alert(self, level: str, message: str) -> None:
        """Fire alerts. Non-blocking — failures are logged but don't crash the run."""
        self._log.warning("Dispatching alert: %s", message, extra={
            "pa_run_id": self.run_id,
            "pa_event":  "alert_dispatch",
            "pa_level":  level,
        })
        if self.config.alert_slack_webhook:
            self._send_slack(message, level)
        if self.config.alert_email:
            self._send_email(message, level)
        if self.config.alert_pagerduty_key and level == "critical":
            self._send_pagerduty(message)

    def _send_slack(self, message: str, level: str) -> None:
        icon = "🚨" if level == "critical" else "⚠️"
        try:
            httpx.post(
                self.config.alert_slack_webhook,
                json={
                    "text": f"{icon} *Prime Atlas Scraper Alert*",
                    "blocks": [
                        {"type": "section", "text": {"type": "mrkdwn", "text": f"{icon} *Prime Atlas Scraper Alert*\n{message}"}},
                        {"type": "context", "elements": [
                            {"type": "mrkdwn", "text": f"Run ID: `{self.run_id}` · Domain: `{self.config.source_domain}`"}
                        ]},
                    ]
                },
                timeout=5.0,
            )
        except Exception as e:
            self._log.warning("Slack alert failed: %s", e)

    def _send_email(self, message: str, level: str) -> None:
        subject = f"[{'CRITICAL' if level == 'critical' else 'WARNING'}] Prime Atlas Scraper: {self.config.scraper_id}"
        msg = MIMEText(f"{message}\n\nRun ID: {self.run_id}")
        msg["Subject"] = subject
        msg["From"]    = "alerts@prime-atlas.io"
        msg["To"]      = self.config.alert_email
        try:
            smtp_host = os.environ.get("SMTP_HOST", "localhost")
            smtp_port = int(os.environ.get("SMTP_PORT", 587))
            smtp_user = os.environ.get("SMTP_USER", "")
            smtp_pass = os.environ.get("SMTP_PASS", "")
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                if smtp_user:
                    server.login(smtp_user, smtp_pass)
                server.send_message(msg)
        except Exception as e:
            self._log.warning("Email alert failed: %s", e)

    def _send_pagerduty(self, message: str) -> None:
        try:
            httpx.post(
                "https://events.pagerduty.com/v2/enqueue",
                json={
                    "routing_key":   self.config.alert_pagerduty_key,
                    "event_action":  "trigger",
                    "dedup_key":     self.run_id,
                    "payload": {
                        "summary":   message,
                        "severity":  "critical",
                        "source":    "prime-atlas-scraper",
                        "component": self.config.scraper_id,
                        "custom_details": {"run_id": self.run_id},
                    },
                },
                timeout=5.0,
            )
        except Exception as e:
            self._log.warning("PagerDuty alert failed: %s", e)
```

---

## Layer 3 — Field Validation & Broken Scraper Detection

```python
"""
prime_atlas_scraper_validator.py
──────────────────────────────────────────────────────────────────
ScraperValidator: validates raw records BEFORE they enter the ETL.

Core rules:
  1. CRITICAL fields (price_amount, address_line1, city, media):
     If null/empty → record is HALTED (not passed to ETL).
     FieldFailure is logged. Session records_failed incremented.

  2. NON-CRITICAL fields (bedrooms, bathrooms, description, etc.):
     If null/empty → field is cleared to None.
     FieldFailure is logged. Record still passes to ETL.

  3. Type validation: unexpected types are coerced where safe,
     or flagged as failures where not.

  4. Structural anomaly detection: if >N% of a field fails across
     the run, a SELECTOR_DRIFT event is emitted — this means the
     external site's HTML structure has likely changed.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from prime_atlas_scraper_session import FieldFailure, ScraperSession, log

# ─── Field spec (loaded from scraper_fields table) ────────────────

@dataclass
class FieldSpec:
    canonical_field:  str
    selector_value:   str
    fallback_selector: str | None
    is_critical:      bool
    expected_type:    str            # 'string'|'integer'|'float'|'url'|'array'
    min_length:       int | None     = None
    max_length:       int | None     = None
    regex_pattern:    str | None     = None

# ─── Validation helpers ───────────────────────────────────────────

_URL_RE    = re.compile(r"^https?://[^\s]{3,}", re.IGNORECASE)
_INT_RE    = re.compile(r"^\d+$")
_FLOAT_RE  = re.compile(r"^\d+(\.\d+)?$")

def _is_empty(value: Any) -> bool:
    """Returns True for None, empty string, empty list, 0 (for area/price)."""
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    if isinstance(value, (list, dict)) and len(value) == 0:
        return True
    return False

def _coerce(value: Any, expected_type: str) -> tuple[Any, str | None]:
    """
    Attempts type coercion. Returns (coerced_value, error_message).
    error_message is None on success.
    """
    if _is_empty(value):
        return None, "empty_value"

    if expected_type == "integer":
        try:
            return int(str(value).strip().replace(",", "")), None
        except (ValueError, TypeError):
            return None, f"cannot_coerce_to_int: {repr(value)[:50]}"

    if expected_type == "float":
        try:
            return float(str(value).strip().replace(",", "")), None
        except (ValueError, TypeError):
            return None, f"cannot_coerce_to_float: {repr(value)[:50]}"

    if expected_type == "url":
        s = str(value).strip()
        if not _URL_RE.match(s):
            return None, f"invalid_url_format: {s[:80]}"
        return s, None

    if expected_type == "array":
        if isinstance(value, list):
            return value if len(value) > 0 else None, (None if len(value) > 0 else "empty_array")
        # Single item — wrap in list
        return [value], None

    # Default: string
    return str(value).strip() or None, (None if str(value).strip() else "empty_string")

# ─── Main validator ───────────────────────────────────────────────

class ScraperValidator:
    """
    Validates one raw record against a list of FieldSpec rules.

    Usage:
        validator = ScraperValidator(field_specs=specs, session=session)
        clean_record, passed = validator.validate(raw_record, external_id="SIR-123")
        if passed:
            transform_and_upsert(clean_record)
    """

    # Selector drift detection: if this % of records fail on a single
    # field, emit a SELECTOR_DRIFT warning.
    DRIFT_THRESHOLD_PCT = 30.0

    def __init__(self, field_specs: list[FieldSpec], session: ScraperSession):
        self.specs   = {spec.canonical_field: spec for spec in field_specs}
        self.session = session

        # Running totals for drift detection
        self._field_attempt_counts: dict[str, int]  = {}
        self._field_failure_counts: dict[str, int]  = {}

    def validate(
        self,
        raw: dict,
        external_id: str = "unknown",
    ) -> tuple[dict, bool]:
        """
        Validates a single raw record.

        Returns:
            (clean_record, passed)
            - clean_record: dict with invalid non-critical fields set to None
            - passed: False if any critical field failed → caller should HALT this record
        """
        clean    = dict(raw)
        passed   = True
        critical_failures = []

        for field_name, spec in self.specs.items():
            raw_value = raw.get(field_name)
            self._field_attempt_counts[field_name] = \
                self._field_attempt_counts.get(field_name, 0) + 1

            coerced, error = _coerce(raw_value, spec.expected_type)

            # Regex pattern check (only if coercion passed)
            if error is None and spec.regex_pattern and coerced is not None:
                if not re.match(spec.regex_pattern, str(coerced)):
                    error = f"regex_mismatch: pattern={spec.regex_pattern[:40]}"
                    coerced = None

            # Length checks (strings only)
            if error is None and spec.expected_type == "string" and coerced:
                if spec.min_length and len(coerced) < spec.min_length:
                    error = f"too_short: len={len(coerced)} min={spec.min_length}"
                    coerced = None
                elif spec.max_length and len(coerced) > spec.max_length:
                    # Truncate rather than fail for non-critical long strings
                    coerced = coerced[:spec.max_length] if not spec.is_critical else None
                    if spec.is_critical and coerced is None:
                        error = f"too_long: len={len(str(raw_value))} max={spec.max_length}"

            if error is not None:
                # Record field failure
                failure = FieldFailure(
                    canonical_field=    field_name,
                    record_external_id= external_id,
                    selector_used=      spec.selector_value,
                    raw_value=          raw_value,
                    failure_reason=     error,
                    is_critical=        spec.is_critical,
                )
                self.session.record_field_failure(failure)

                self._field_failure_counts[field_name] = \
                    self._field_failure_counts.get(field_name, 0) + 1

                # Check for selector drift
                self._check_drift(field_name, spec)

                if spec.is_critical:
                    critical_failures.append(field_name)
                    clean[field_name] = None
                    passed = False
                else:
                    # Non-critical: set to None, continue processing record
                    clean[field_name] = None
            else:
                clean[field_name] = coerced

        # Emit structured halt log for critical failures
        if critical_failures:
            log.error(
                "Record HALTED — critical field failures",
                extra={
                    "pa_run_id":          self.session.run_id,
                    "pa_scraper_id":      self.session.config.scraper_id,
                    "pa_event":           "record_halted",
                    "pa_record_id":       external_id,
                    "pa_critical_fields": critical_failures,
                    "pa_action":          "record_excluded_from_etl",
                }
            )
            self.session.records_failed += 1

        return clean, passed

    def _check_drift(self, field_name: str, spec: FieldSpec) -> None:
        """Emits SELECTOR_DRIFT event if failure rate exceeds threshold."""
        attempts = self._field_attempt_counts.get(field_name, 1)
        failures = self._field_failure_counts.get(field_name, 0)

        # Only evaluate after at least 10 attempts (avoid noise at run start)
        if attempts < 10:
            return

        failure_pct = (failures / attempts) * 100
        if failure_pct >= self.DRIFT_THRESHOLD_PCT:
            log.error(
                "SELECTOR_DRIFT detected — external site may have changed layout",
                extra={
                    "pa_run_id":      self.session.run_id,
                    "pa_scraper_id":  self.session.config.scraper_id,
                    "pa_event":       "selector_drift",
                    "pa_field":       field_name,
                    "pa_selector":    spec.selector_value,
                    "pa_is_critical": spec.is_critical,
                    "pa_failure_pct": round(failure_pct, 1),
                    "pa_attempts":    attempts,
                    "pa_failures":    failures,
                    "pa_action":      "review_selector_immediately",
                }
            )


# ─────────────────────────────────────────────────────────────────
# FULL PIPELINE INTEGRATION EXAMPLE
# ─────────────────────────────────────────────────────────────────

def example_run(config: "ScraperConfig", db_conn, raw_records: list[dict]) -> None:
    """
    Shows how ScraperSession + ScraperValidator wrap the ETL call.
    This is what your cron job or Lambda actually calls.
    """
    from prime_atlas_etl import transform, upsert

    # Build field specs from DB (or loaded config dict)
    field_specs = [
        FieldSpec("price_amount",  'span[data-testid="price"]',              None, is_critical=True,  expected_type="string"),
        FieldSpec("address_line1", 'h1[data-testid="bdp-building-address"]', None, is_critical=True,  expected_type="string"),
        FieldSpec("city",          'span[data-testid="bdp-city-state-zip"]', None, is_critical=True,  expected_type="string"),
        FieldSpec("media",         'div[data-testid="photo-gallery"] img',   None, is_critical=True,  expected_type="array"),
        FieldSpec("bedrooms",      'span[data-testid="bed-bath-item"]',      None, is_critical=False, expected_type="integer"),
        FieldSpec("bathrooms",     'span[data-testid="bed-bath-item"]',      None, is_critical=False, expected_type="integer"),
        FieldSpec("area_sqm",      'span[data-testid="sqft"]',               None, is_critical=False, expected_type="string"),
        FieldSpec("description",   'div[data-testid="description"]',         None, is_critical=False, expected_type="string", min_length=20),
    ]

    with ScraperSession(config=config, db_conn=db_conn) as session:
        validator = ScraperValidator(field_specs=field_specs, session=session)

        with db_conn.cursor() as cur:
            for raw in raw_records:
                session.record_attempt()
                external_id = str(raw.get("listingId") or raw.get("id") or "unknown")

                # ── Validate BEFORE ETL ──
                clean_record, passed = validator.validate(raw, external_id=external_id)

                if not passed:
                    # Critical field failed → skip ETL entirely for this record
                    continue

                # ── ETL transform ──
                canonical = transform(clean_record, source_hint=config.source_enum)
                if canonical is None:
                    session.records_failed += 1
                    continue

                # ── Upsert ──
                ok = upsert(canonical, cur)
                if ok:
                    session.record_success()
                    session.record_upserted()
                else:
                    session.records_failed += 1

            db_conn.commit()
```

### Sample Log Output (CloudWatch / Datadog format)

```jsonl
{"ts":"2026-06-28T03:00:01Z","level":"INFO","logger":"prime_atlas.scraper.zillow-us","message":"Scraper run started","run_id":"zillow-us-20260628-030001","scraper_id":"zillow-us","domain":"www.zillow.com","event":"run_start","service":"prime-atlas-scraper"}

{"ts":"2026-06-28T03:01:14Z","level":"WARNING","logger":"prime_atlas.scraper.zillow-us","message":"Field extraction failure: bedrooms","run_id":"zillow-us-20260628-030001","scraper_id":"zillow-us","event":"field_failure","field":"bedrooms","is_critical":false,"reason":"cannot_coerce_to_int: '3 bds'","record_id":"Z-NYC-88821","selector":"span[data-testid=\"bed-bath-item\"] strong","service":"prime-atlas-scraper"}

{"ts":"2026-06-28T03:02:55Z","level":"ERROR","logger":"prime_atlas.scraper.zillow-us","message":"SELECTOR_DRIFT detected — external site may have changed layout","run_id":"zillow-us-20260628-030001","scraper_id":"zillow-us","event":"selector_drift","field":"price_amount","selector":"span[data-testid=\"price\"]","is_critical":true,"failure_pct":45.2,"attempts":84,"failures":38,"action":"review_selector_immediately","service":"prime-atlas-scraper"}

{"ts":"2026-06-28T03:02:56Z","level":"ERROR","logger":"prime_atlas.scraper.zillow-us","message":"Record HALTED — critical field failures","run_id":"zillow-us-20260628-030001","scraper_id":"zillow-us","event":"record_halted","record_id":"Z-NYC-88822","critical_fields":["price_amount"],"action":"record_excluded_from_etl","service":"prime-atlas-scraper"}

{"ts":"2026-06-28T03:08:41Z","level":"INFO","logger":"prime_atlas.scraper.zillow-us","message":"Scraper run complete","run_id":"zillow-us-20260628-030001","scraper_id":"zillow-us","event":"run_complete","exit_status":"degraded","duration_ms":520432,"pages_fetched":30,"records_attempted":847,"records_passed":612,"records_failed":235,"records_upserted":601,"proxy_credits":2541,"field_stats":{"price_amount":{"failures":235,"pct":27.7,"is_critical":true},"bedrooms":{"failures":12,"pct":1.4,"is_critical":false}},"service":"prime-atlas-scraper"}
```

---

## Layer 4 — Observability Dashboard API Payload

```
GET /api/v1/admin/scraper-health
Authorization: Bearer <admin_token>

200 OK
Content-Type: application/json
Cache-Control: no-store
```

```json
{
  "meta": {
    "generated_at":     "2026-06-28T10:15:00Z",
    "total_targets":    6,
    "active":           4,
    "degraded":         1,
    "broken":           1,
    "paused":           0,
    "next_run_in_secs": 9847
  },

  "targets": [
    {
      "scraper_id":     "zillow-us",
      "display_name":   "Zillow US",
      "source_domain":  "www.zillow.com",
      "country_iso2":   "US",
      "status":         "broken",
      "status_since":   "2026-06-28T03:08:41Z",
      "consecutive_failures": 3,

      "schedule": {
        "cron_expression":   "0 3 * * *",
        "next_run_at":       "2026-06-29T03:00:00Z",
        "last_run_at":       "2026-06-28T03:00:01Z",
        "last_success_at":   "2026-06-27T03:04:12Z"
      },

      "last_run": {
        "run_id":             "zillow-us-20260628-030001",
        "exit_status":        "broken",
        "duration_ms":        520432,
        "pages_fetched":      30,
        "records_attempted":  847,
        "records_passed":     612,
        "records_failed":     235,
        "records_upserted":   601,
        "failure_rate_pct":   27.7,
        "proxy_credits_used": 2541
      },

      "field_health": [
        {
          "canonical_field":  "price_amount",
          "selector":         "span[data-testid=\"price\"]",
          "is_critical":      true,
          "status":           "broken",
          "failure_count_24h": 235,
          "failure_pct":       27.7,
          "last_success_at":  "2026-06-27T03:04:12Z",
          "last_failure_at":  "2026-06-28T03:02:55Z",
          "alert":            "SELECTOR_DRIFT — likely site layout change"
        },
        {
          "canonical_field":  "address_line1",
          "selector":         "h1[data-testid=\"bdp-building-address\"]",
          "is_critical":      true,
          "status":           "healthy",
          "failure_count_24h": 0,
          "failure_pct":       0.0,
          "last_success_at":  "2026-06-28T03:08:00Z",
          "last_failure_at":  null,
          "alert":            null
        },
        {
          "canonical_field":  "bedrooms",
          "selector":         "span[data-testid=\"bed-bath-item\"] strong",
          "is_critical":      false,
          "status":           "degraded",
          "failure_count_24h": 12,
          "failure_pct":       1.4,
          "last_success_at":  "2026-06-28T03:07:55Z",
          "last_failure_at":  "2026-06-28T03:01:14Z",
          "alert":            null
        }
      ],

      "alerts": [
        {
          "level":      "critical",
          "code":       "SELECTOR_DRIFT",
          "field":      "price_amount",
          "message":    "45.2% of price_amount extractions failed this run. Selector span[data-testid=\"price\"] may be stale.",
          "fired_at":   "2026-06-28T03:02:56Z",
          "run_id":     "zillow-us-20260628-030001",
          "resolved":   false
        }
      ]
    },

    {
      "scraper_id":     "rightmove-uk",
      "display_name":   "Rightmove UK",
      "source_domain":  "www.rightmove.co.uk",
      "country_iso2":   "GB",
      "status":         "active",
      "status_since":   "2026-06-01T03:00:00Z",
      "consecutive_failures": 0,

      "schedule": {
        "cron_expression":   "0 3 * * *",
        "next_run_at":       "2026-06-29T03:00:00Z",
        "last_run_at":       "2026-06-28T03:00:00Z",
        "last_success_at":   "2026-06-28T03:00:00Z"
      },

      "last_run": {
        "run_id":             "rightmove-uk-20260628-030000",
        "exit_status":        "success",
        "duration_ms":        312000,
        "pages_fetched":      50,
        "records_attempted":  1240,
        "records_passed":     1231,
        "records_failed":     9,
        "records_upserted":   1219,
        "failure_rate_pct":   0.73,
        "proxy_credits_used": 3720
      },

      "field_health": [
        {
          "canonical_field":  "price_amount",
          "selector":         ".propertyCard-priceValue",
          "is_critical":      true,
          "status":           "healthy",
          "failure_count_24h": 0,
          "failure_pct":       0.0,
          "last_success_at":  "2026-06-28T03:05:12Z",
          "last_failure_at":  null,
          "alert":            null
        },
        {
          "canonical_field":  "media",
          "selector":         ".propertyCard-img img",
          "is_critical":      true,
          "status":           "healthy",
          "failure_count_24h": 0,
          "failure_pct":       0.0,
          "last_success_at":  "2026-06-28T03:05:12Z",
          "last_failure_at":  null,
          "alert":            null
        }
      ],

      "alerts": []
    },

    {
      "scraper_id":     "idealista-es",
      "display_name":   "Idealista Spain",
      "source_domain":  "www.idealista.com",
      "country_iso2":   "ES",
      "status":         "degraded",
      "status_since":   "2026-06-27T04:00:00Z",
      "consecutive_failures": 2,

      "schedule": {
        "cron_expression":   "0 4 * * *",
        "next_run_at":       "2026-06-29T04:00:00Z",
        "last_run_at":       "2026-06-28T04:00:00Z",
        "last_success_at":   "2026-06-26T04:04:31Z"
      },

      "last_run": {
        "run_id":             "idealista-es-20260628-040000",
        "exit_status":        "degraded",
        "duration_ms":        780000,
        "pages_fetched":      40,
        "records_attempted":  620,
        "records_passed":     565,
        "records_failed":     55,
        "records_upserted":   558,
        "failure_rate_pct":   8.87,
        "proxy_credits_used": 4840
      },

      "field_health": [
        {
          "canonical_field":  "area_sqm",
          "selector":         ".detail-info-feature--area span",
          "is_critical":      false,
          "status":           "degraded",
          "failure_count_24h": 55,
          "failure_pct":       8.9,
          "last_success_at":  "2026-06-28T04:07:22Z",
          "last_failure_at":  "2026-06-28T04:07:55Z",
          "alert":            "Elevated failure rate — monitor next run"
        }
      ],

      "alerts": [
        {
          "level":      "warning",
          "code":       "ELEVATED_FAILURE_RATE",
          "field":      "area_sqm",
          "message":    "Field area_sqm failing on 8.9% of records — above degraded threshold of 8.0%.",
          "fired_at":   "2026-06-28T04:10:00Z",
          "run_id":     "idealista-es-20260628-040000",
          "resolved":   false
        }
      ]
    },

    {
      "scraper_id":     "zoopla-uk",
      "display_name":   "Zoopla UK",
      "source_domain":  "www.zoopla.co.uk",
      "country_iso2":   "GB",
      "status":         "active",
      "status_since":   "2026-06-01T00:00:00Z",
      "consecutive_failures": 0,
      "last_run": {
        "exit_status":        "success",
        "duration_ms":        290000,
        "records_attempted":  890,
        "records_passed":     882,
        "records_failed":     8,
        "failure_rate_pct":   0.90,
        "proxy_credits_used": 2670
      },
      "alerts": []
    },

    {
      "scraper_id":     "sothebys-global",
      "display_name":   "Sotheby's International",
      "source_domain":  "www.sothebysrealty.com",
      "country_iso2":   "GB",
      "status":         "active",
      "status_since":   "2026-06-01T00:00:00Z",
      "consecutive_failures": 0,
      "last_run": {
        "exit_status":        "success",
        "duration_ms":        95000,
        "records_attempted":  48,
        "records_passed":     48,
        "records_failed":     0,
        "failure_rate_pct":   0.0,
        "proxy_credits_used": 240
      },
      "alerts": []
    },

    {
      "scraper_id":     "onthemarket-uk",
      "display_name":   "OnTheMarket UK",
      "source_domain":  "www.onthemarket.com",
      "country_iso2":   "GB",
      "status":         "active",
      "status_since":   "2026-06-01T00:00:00Z",
      "consecutive_failures": 0,
      "last_run": {
        "exit_status":        "success",
        "duration_ms":        265000,
        "records_attempted":  730,
        "records_passed":     726,
        "records_failed":     4,
        "failure_rate_pct":   0.55,
        "proxy_credits_used": 2190
      },
      "alerts": []
    }
  ],

  "system": {
    "total_records_in_db":       48210,
    "records_upserted_24h":      3205,
    "proxy_credits_used_today":  16201,
    "proxy_credits_monthly_cap": 25000,
    "proxy_credits_remaining":   8799,
    "proxy_burn_rate_per_day":   16201,
    "proxy_days_remaining":       0.5,
    "alert": "⚠️ Proxy credits will be exhausted today. Upgrade ScrapeOps plan."
  }
}
```

---

## SQL Queries for Dashboard Backend

```sql
-- Health summary (used for meta block above)
SELECT
  COUNT(*)                                        AS total_targets,
  COUNT(*) FILTER (WHERE status = 'active')       AS active,
  COUNT(*) FILTER (WHERE status = 'degraded')     AS degraded,
  COUNT(*) FILTER (WHERE status = 'broken')       AS broken,
  COUNT(*) FILTER (WHERE status = 'paused')       AS paused
FROM scraper_targets
WHERE status != 'retired';

-- Last run per scraper (JOIN for dashboard rows)
SELECT DISTINCT ON (r.scraper_id)
  r.scraper_id,
  r.run_id,
  r.exit_status,
  r.duration_ms,
  r.pages_fetched,
  r.records_attempted,
  r.records_passed,
  r.records_failed,
  r.records_upserted,
  ROUND((r.records_failed::numeric / NULLIF(r.records_attempted,0)) * 100, 2) AS failure_rate_pct,
  r.proxy_credits_used,
  r.field_failure_stats,
  r.started_at
FROM scraper_runs r
ORDER BY r.scraper_id, r.started_at DESC;

-- 24h field failure counts (for field_health blocks)
SELECT
  sf.scraper_id,
  sf.canonical_field,
  sf.selector_value,
  sf.is_critical,
  sf.failure_count_24h,
  sf.last_success_at,
  sf.last_failure_at
FROM scraper_fields sf
WHERE sf.failure_count_24h > 0
ORDER BY sf.scraper_id, sf.failure_count_24h DESC;

-- Proxy credit burn rate
SELECT
  SUM(proxy_credits_used) AS credits_today
FROM scraper_runs
WHERE started_at >= NOW() - INTERVAL '24 hours';

-- Records upserted in last 24h
SELECT COUNT(*) AS upserted_24h
FROM properties
WHERE updated_at >= NOW() - INTERVAL '24 hours'
  AND deleted_at IS NULL;
```

---

## Alert Decision Tree

```
After each scraper run:
│
├── exit_status = 'broken'?
│     └── CRITICAL alert → Slack + Email + PagerDuty
│         Message: "Critical fields null. Import HALTED. Site layout may have changed."
│         Action:  Engineer reviews selectors within 1h SLA
│
├── exit_status = 'degraded'?
│     └── WARNING alert → Slack + Email
│         Message: "Elevated failure rate. Records imported but data quality reduced."
│         Action:  Engineer reviews within 4h SLA
│
├── records_attempted < min_records_per_run?
│     └── WARNING alert → Slack + Email
│         Message: "Too few records returned. Pagination or rate-limiting suspected."
│         Action:  Engineer reviews within 4h SLA
│
├── consecutive_failures >= 3?
│     └── CRITICAL alert (even if individual run was 'degraded')
│         Message: "3 consecutive failures. Manual intervention required."
│
└── proxy_credits_remaining < 2000?
      └── BILLING alert → Email
          Message: "ScrapeOps credits nearly exhausted. Upgrade plan."
```

---

*Prime Atlas Scraper Observability Architecture v1.0 — Generated 28 Jun 2026*
