#!/usr/bin/env python3
"""
Prime Atlas — end-to-end smoke suite (stdlib only, no deps).

Verifies the platform's core functional blocks against a live deployment:

  1.  Public surface renders (home, pricing, listings, market feed) on the
      obsidian design system with zero non-US/UK market leakage.
  2.  Auth walls hold: /deal-board, /dashboard, /portfolio redirect anonymous
      visitors instead of leaking member data.
  3.  Frictionless signup lifecycle: a test operator account is created via
      the Supabase auth API (the exact call AuthForm makes in the browser)
      and, when a session is returned, member-scoped reads work under RLS.
  4.  Deal Board data engine: market_listing_stats (the "live market pulse"
      revenue math), municipality integrity (US/UK only), inventory floors
      (>= 3,000 properties per country), and gallery dedupe invariants.
  5.  Staleness detection: how much of the inventory has fresh scrape
      timestamps — the analog of idle/stale deal flags.

Usage:
    python3 scripts/qa/e2e_smoke.py [--base https://prime-atlas-weld.vercel.app]

Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local
(anon key is public by definition — it ships in the browser bundle).
Exit code 0 = all pass, 1 = failures.
"""

import argparse
import json
import re
import secrets
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

RESULTS: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    RESULTS.append((name, ok, detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  — {detail}" if detail else ""))


def http(url: str, method: str = "GET", body=None,
         headers=None, follow=True) -> tuple[int, str, dict]:
    req = urllib.request.Request(url, method=method,
                                 data=json.dumps(body).encode() if body else None)
    req.add_header("User-Agent", "prime-atlas-qa/1.0")
    if body:
        req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k):  # noqa: N802
            return None

    opener = urllib.request.build_opener() if follow else urllib.request.build_opener(NoRedirect)
    try:
        with opener.open(req, timeout=30) as res:
            return res.status, res.read().decode(errors="replace"), dict(res.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace"), dict(e.headers)
    except Exception as e:  # noqa: BLE001
        return 0, str(e), {}


def env_from_dotenv(root: Path) -> dict:
    env = {}
    dotenv = root / ".env.local"
    if dotenv.exists():
        for line in dotenv.read_text().splitlines():
            m = re.match(r'([A-Z0-9_]+)="?([^"\n]*)"?$', line.strip())
            if m:
                env[m.group(1)] = m.group(2)
    return env


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="https://prime-atlas-weld.vercel.app")
    args = ap.parse_args()
    base = args.base.rstrip("/")

    root = Path(__file__).resolve().parents[2]
    env = env_from_dotenv(root)
    sb_url = env.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    anon = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    sb_headers = {"apikey": anon, "Authorization": f"Bearer {anon}"}

    print(f"\n== Prime Atlas E2E smoke · target {base} ==\n")

    # ── 1. Public surface ────────────────────────────────────────────────────
    print("[1] Public surface")
    for path in ("/", "/pricing", "/listings", "/market-feed", "/underpriced"):
        code, html, _ = http(base + path)
        check(f"GET {path} renders", code == 200, f"HTTP {code}")
        if path == "/":
            check("obsidian design system live",
                  "bg-background" in html or "09090b" in html.lower(),
                  "dark tokens present in markup")
            leaked = [c for c in ("Sagunto", "Torrevieja", "Valencia", "Toronto", "Calgary")
                      if c in html]
            check("no non-US/UK market leakage on home", not leaked, ",".join(leaked) or "clean")

    # ── 2. Auth walls ────────────────────────────────────────────────────────
    print("\n[2] Auth walls")
    for path in ("/deal-board", "/dashboard", "/portfolio"):
        code, _, hdrs = http(base + path, follow=False)
        loc = hdrs.get("Location", hdrs.get("location", ""))
        check(f"{path} gated for anonymous", code in (301, 302, 303, 307, 308) and "login" in loc,
              f"HTTP {code} -> {loc or '(no redirect)'}")

    # IC memo export must refuse anonymous callers server-side
    code, _, _ = http(base + "/api/export/ic-memo", "POST", {"market": {"name": "x"}})
    check("/api/export/ic-memo blocks anonymous", code == 401, f"HTTP {code}")

    # ── 3. Signup lifecycle (@tycoon_operator) ───────────────────────────────
    print("\n[3] Signup lifecycle")
    if not (sb_url and anon):
        check("supabase env available", False, "missing .env.local keys — skipping auth tests")
    else:
        stamp = int(time.time())
        email = f"qa.tycoon.operator+{stamp}@prime-atlas.com"
        password = secrets.token_urlsafe(18)
        code, body, _ = http(f"{sb_url}/auth/v1/signup", "POST",
                             {"email": email, "password": password,
                              "data": {"handle": "@tycoon_operator", "qa": True}},
                             sb_headers)
        created = code in (200, 201)
        check("signup accepted", created, f"HTTP {code}")
        session = {}
        if created:
            payload = json.loads(body or "{}")
            session = payload if payload.get("access_token") else {}
            if not session:
                # Email-confirmation flow: user exists but no session yet.
                check("session issued on signup", False,
                      "confirmation email required (expected if confirmations are ON)")
            else:
                check("session issued on signup", True, "instant session — zero-friction path")
                token = session["access_token"]
                code, body, _ = http(
                    f"{sb_url}/rest/v1/profiles?select=subscription_tier",
                    headers={"apikey": anon, "Authorization": f"Bearer {token}"})
                rows = json.loads(body) if code == 200 else []
                check("RLS: member reads own profile", code == 200 and len(rows) <= 1,
                      f"HTTP {code}, rows={len(rows)}")

    # ── 4. Deal Board data engine ────────────────────────────────────────────
    print("\n[4] Deal Board data engine")
    if sb_url and anon:
        code, body, _ = http(f"{sb_url}/rest/v1/municipalities?select=country", headers=sb_headers)
        rows = json.loads(body) if code == 200 else []
        countries = {r["country"] for r in rows}
        check("municipality read (anon, public data)", code == 200, f"{len(rows)} markets")
        check("markets strictly US/UK", countries <= {"United Kingdom", "United States"},
              ", ".join(sorted(countries)))

        for iso, label in (("US", "USA"), ("GB", "UK")):
            code, body, hdrs = http(
                f"{sb_url}/rest/v1/properties?select=id&country_iso2=eq.{iso}&limit=1",
                headers={**sb_headers, "Prefer": "count=exact"})
            total = int((hdrs.get("Content-Range", "0/0")).split("/")[-1] or 0)
            check(f"{label} inventory >= 3,000", total >= 3000, f"{total} properties")

        code, body, _ = http(
            f"{sb_url}/rest/v1/market_listing_stats?select=*&limit=3", headers=sb_headers)
        stats = json.loads(body) if code == 200 else []
        check("market_listing_stats view computes (live pulse)", code == 200 and len(stats) > 0,
              f"{len(stats)} sample rows")

        code, body, _ = http(
            f"{sb_url}/rest/v1/properties?select=images&provider=eq.zillow"
            "&gallery_synced_at=not.is.null&limit=5", headers=sb_headers)
        sample = json.loads(body) if code == 200 else []
        dupe_found = False
        for row in sample:
            hashes = [re.search(r"/fp/([0-9a-f]+)", u).group(1)
                      for u in (row.get("images") or []) if re.search(r"/fp/([0-9a-f]+)", u)]
            if len(hashes) != len(set(hashes)):
                dupe_found = True
        check("gallery dedupe invariant (no repeated photos)", sample != [] and not dupe_found,
              f"sampled {len(sample)} synced galleries")

    # ── 5. Staleness / idle detection ────────────────────────────────────────
    print("\n[5] Staleness detection")
    if sb_url and anon:
        code, body, hdrs = http(
            f"{sb_url}/rest/v1/properties?select=id&scraped_at=gte.{time.strftime('%Y-%m-%d', time.gmtime(time.time()-86400*2))}&limit=1",
            headers={**sb_headers, "Prefer": "count=exact"})
        fresh = int((hdrs.get("Content-Range", "0/0")).split("/")[-1] or 0)
        check("inventory freshness (scraped within 48h)", fresh > 1000, f"{fresh} fresh rows")

    # ── Summary ──────────────────────────────────────────────────────────────
    failed = [r for r in RESULTS if not r[1]]
    print(f"\n== {len(RESULTS) - len(failed)}/{len(RESULTS)} passed ==")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
