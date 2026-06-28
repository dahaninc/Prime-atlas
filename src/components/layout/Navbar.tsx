"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

// ─── Data ────────────────────────────────────────────────────────────────────

const MARKETS = [
  {
    flag: "🇬🇧", label: "United Kingdom", code: "UK",
    cities: [
      { name: "London",      slug: "london"      },
      { name: "Manchester",  slug: "manchester"  },
      { name: "Cambridge",   slug: "cambridge"   },
      { name: "Birmingham",  slug: "birmingham"  },
      { name: "Bristol",     slug: "bristol"     },
      { name: "Edinburgh",   slug: "edinburgh"   },
      { name: "Oxford",      slug: "oxford"      },
      { name: "Leeds",       slug: "leeds"       },
    ],
  },
  {
    flag: "🇺🇸", label: "United States", code: "US",
    cities: [
      { name: "New York",     slug: "new-york-ny"      },
      { name: "Los Angeles",  slug: "los-angeles-ca"   },
      { name: "Chicago",      slug: "chicago-il"       },
      { name: "Miami",        slug: "miami-fl"         },
      { name: "Seattle",      slug: "seattle-wa"       },
      { name: "Austin",       slug: "austin-tx"        },
      { name: "Boston",       slug: "boston-ma"        },
      { name: "San Francisco",slug: "san-francisco-ca" },
    ],
  },
  {
    flag: "🇦🇺", label: "Australia", code: "AU",
    cities: [
      { name: "Sydney",    slug: "sydney-nsw"    },
      { name: "Melbourne", slug: "melbourne-vic" },
      { name: "Brisbane",  slug: "brisbane-qld"  },
      { name: "Perth",     slug: "perth-wa"      },
    ],
  },
  {
    flag: "🇨🇦", label: "Canada", code: "CA",
    cities: [
      { name: "Toronto",   slug: "toronto-on"   },
      { name: "Vancouver", slug: "vancouver-bc" },
      { name: "Montreal",  slug: "montreal-qc"  },
    ],
  },
  {
    flag: "🇪🇸", label: "Spain", code: "ES",
    cities: [
      { name: "Madrid",    slug: "madrid"    },
      { name: "Barcelona", slug: "barcelona" },
      { name: "Valencia",  slug: "valencia"  },
    ],
  },
];

const CATEGORIES = [
  { label: "Build-to-Rent",    href: "/opportunities?category=BTR"      },
  { label: "Student Housing",  href: "/opportunities?category=PBSA"     },
  { label: "Commercial",       href: "/opportunities?category=Commercial"},
  { label: "Industrial",       href: "/opportunities?category=Industrial"},
  { label: "Land & Dev",       href: "/opportunities?category=Land"     },
];

interface NavbarProps {
  user?: { email?: string } | null;
}

// ─── Desktop Markets mega-menu ───────────────────────────────────────────────

function MarketsMenu({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[780px] bg-background border border-border rounded-2xl shadow-2xl p-6 grid grid-cols-5 gap-4 z-50">
      {MARKETS.map((mkt) => (
        <div key={mkt.code}>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <span>{mkt.flag}</span>{mkt.label}
          </p>
          <div className="space-y-0.5">
            {mkt.cities.map((c) => (
              <Link
                key={c.slug}
                href={`/opportunities/${c.slug}`}
                className="block text-xs text-muted-foreground hover:text-pa-green px-2 py-1.5 rounded-lg hover:bg-pa-green/5 transition-all duration-100"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const [marketsOpen, setMarketsOpen] = useState(false);
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [openCountry, setOpenCountry] = useState<string | null>(null);

  const close = () => { setDrawerOpen(false); setOpenCountry(null); };

  const navLink = (href: string, label: string, exact = false) => (
    <Link
      href={href}
      className={cn(
        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-100",
        (exact ? pathname === href : pathname.startsWith(href))
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );

  return (
    <>
      {/* ── Nav bar ── */}
      <nav className="sticky top-0 z-50 bg-[#0c0d14]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex items-center h-14 gap-6">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0 mr-2" onClick={close}>
            <span className="text-pa-green font-mono font-bold text-[15px] tracking-tight">prime-atlas</span>
          </Link>

          {/* ── Desktop links ── */}
          <div className="hidden md:flex items-center gap-1 flex-1">

            {/* Markets */}
            <div
              className="relative"
              onMouseEnter={() => setMarketsOpen(true)}
              onMouseLeave={() => setMarketsOpen(false)}
            >
              <button className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-100",
                pathname.startsWith("/opportunities")
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}>
                Markets
                <svg className="w-3.5 h-3.5 opacity-50 mt-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <MarketsMenu open={marketsOpen} />
            </div>

            {navLink("/listings",    "Listings")}
            {navLink("/market-feed", "Live Feed")}
            {navLink("/deal-board",  "Deal Board")}
          </div>

          {/* ── Desktop auth ── */}
          <div className="hidden md:flex items-center gap-3 ml-auto">
            {user ? (
              <>
                <span className="text-sm text-muted-foreground">{user.email?.split("@")[0]}</span>
                <form action="/auth/signout" method="post">
                  <button type="submit" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Log in
                </Link>
                <Link
                  href="/auth/signup"
                  className="bg-[#00c805] text-black text-sm font-bold px-4 py-1.5 rounded-full hover:bg-[#00c805]/90 transition-colors"
                >
                  Get access
                </Link>
              </>
            )}
          </div>

          {/* ── Mobile: auth action + hamburger ── */}
          <div className="md:hidden flex items-center gap-3 ml-auto">
            {!user && (
              <Link
                href="/auth/signup"
                className="text-xs font-bold bg-[#00c805] text-black px-3 py-1.5 rounded-full hover:bg-[#00c805]/90 transition-colors"
              >
                Get access
              </Link>
            )}
            <button
              onClick={() => setDrawerOpen(!drawerOpen)}
              className="p-1.5 -mr-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Menu"
            >
              {drawerOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

        </div>
      </nav>

      {/* ── Mobile full-screen drawer ── */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-40 bg-[#0c0d14] transition-opacity duration-200",
          drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        style={{ top: "56px" }}
      >
        <div className="overflow-y-auto h-full pb-36 px-5 pt-8 space-y-10">

          {/* Quick links */}
          <section>
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-4">Navigate</p>
            <div className="space-y-1">
              {[
                { href: "/",            label: "Home"      },
                { href: "/listings",    label: "Listings"  },
                { href: "/market-feed", label: "Live Feed" },
                { href: "/deal-board",  label: "Deal Board"},
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={close}
                  className={cn(
                    "flex items-center justify-between px-4 py-4 rounded-2xl text-base font-semibold transition-colors",
                    pathname === href
                      ? "text-[#00c805] bg-[#00c805]/8"
                      : "text-white hover:bg-zinc-900"
                  )}
                >
                  {label}
                  <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </section>

          {/* Markets by country */}
          <section>
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-4">Markets</p>
            <div className="space-y-1">
              {MARKETS.map((mkt) => (
                <div key={mkt.code}>
                  <button
                    onClick={() => setOpenCountry(openCountry === mkt.code ? null : mkt.code)}
                    className="w-full flex items-center justify-between px-4 py-4 rounded-2xl text-base font-medium text-white hover:bg-zinc-900 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-lg">{mkt.flag}</span>
                      {mkt.label}
                    </span>
                    <svg
                      className={cn("w-4 h-4 text-zinc-600 transition-transform duration-150", openCountry === mkt.code && "rotate-180")}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {openCountry === mkt.code && (
                    <div className="mt-1 mb-2 ml-5 grid grid-cols-2 gap-1">
                      {mkt.cities.map((c) => (
                        <Link
                          key={c.slug}
                          href={`/opportunities/${c.slug}`}
                          onClick={close}
                          className="px-4 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-[#00c805] hover:bg-[#00c805]/5 transition-colors"
                        >
                          {c.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Categories */}
          <section>
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-4">By Category</p>
            <div className="grid grid-cols-2 gap-1">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.href}
                  href={cat.href}
                  onClick={close}
                  className="px-4 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-[#00c805] hover:bg-[#00c805]/5 transition-colors"
                >
                  {cat.label}
                </Link>
              ))}
            </div>
          </section>

          {/* Auth footer */}
          {user ? (
            <section className="pt-2">
              <p className="text-xs text-zinc-600 px-1 mb-3">{user.email}</p>
              <form action="/auth/signout" method="post">
                <button type="submit" className="w-full text-left px-4 py-4 rounded-2xl text-sm font-medium text-zinc-400 hover:bg-zinc-900 transition-colors">
                  Sign out
                </button>
              </form>
            </section>
          ) : (
            <section className="flex flex-col gap-3">
              <Link href="/auth/login" onClick={close} className="px-4 py-4 rounded-2xl text-base font-medium text-zinc-400 hover:bg-zinc-900 transition-colors">
                Log in
              </Link>
              <Link href="/auth/signup" onClick={close} className="px-4 py-4 rounded-full text-base font-bold bg-[#00c805] text-black text-center hover:bg-[#00c805]/90 transition-colors">
                Get access — free
              </Link>
            </section>
          )}

        </div>
      </div>
    </>
  );
}
