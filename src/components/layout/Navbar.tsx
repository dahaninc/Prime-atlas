"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// ─── Data ────────────────────────────────────────────────────────────────────

const MARKETS = [
  {
    flag: "🇬🇧", label: "United Kingdom", code: "UK",
    cities: [
      { name: "London",       slug: "london"       },
      { name: "Manchester",   slug: "manchester"   },
      { name: "Cambridge",    slug: "cambridge"    },
      { name: "Birmingham",   slug: "birmingham"   },
      { name: "Bristol",      slug: "bristol"      },
      { name: "Edinburgh",    slug: "edinburgh"    },
      { name: "Oxford",       slug: "oxford"       },
      { name: "Leeds",        slug: "leeds"        },
    ],
  },
  {
    flag: "🇺🇸", label: "United States", code: "US",
    cities: [
      { name: "New York",      slug: "new-york-ny"      },
      { name: "Los Angeles",   slug: "los-angeles-ca"   },
      { name: "Chicago",       slug: "chicago-il"       },
      { name: "Miami",         slug: "miami-fl"         },
      { name: "Seattle",       slug: "seattle-wa"       },
      { name: "Austin",        slug: "austin-tx"        },
      { name: "Boston",        slug: "boston-ma"        },
      { name: "San Francisco", slug: "san-francisco-ca" },
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
  { label: "Build-to-Rent",   href: "/opportunities?category=BTR"       },
  { label: "Student Housing", href: "/opportunities?category=PBSA"      },
  { label: "Commercial",      href: "/opportunities?category=Commercial" },
  { label: "Industrial",      href: "/opportunities?category=Industrial" },
  { label: "Land & Dev",      href: "/opportunities?category=Land"      },
];

interface NavbarProps {
  user?: { email?: string } | null;
}

// ─── Left sidebar ─────────────────────────────────────────────────────────────

function LeftSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[55] bg-black/60 transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 left-0 bottom-0 z-[56] w-72 bg-[#111114] flex flex-col
          transition-transform duration-200 ease-out
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-white/[0.06] shrink-0">
          <span className="text-[#00c805] font-mono font-bold text-sm tracking-tight">prime-atlas</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 py-6 px-3 space-y-8">

          {/* Markets */}
          <section>
            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-3 mb-2">Markets</p>
            {MARKETS.map((mkt) => (
              <Link
                key={mkt.code}
                href={`/opportunities/${mkt.cities[0].slug}`}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <span className="text-base w-6 text-center">{mkt.flag}</span>
                {mkt.label}
                <svg className="w-3.5 h-3.5 text-zinc-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </section>

          {/* Platform */}
          <section>
            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-3 mb-2">Platform</p>
            {[
              { label: "Live Listings",  href: "/listings",    dot: "#00c805" },
              { label: "Market Feed",    href: "/market-feed", dot: "#3b82f6" },
              { label: "Deal Board",     href: "/deal-board",  dot: null      },
            ].map(({ label, href, dot }) => (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                {dot ? (
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dot }} />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 shrink-0" />
                )}
                {label}
              </Link>
            ))}
          </section>

          {/* Opportunities */}
          <section>
            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-3 mb-2">By Category</p>
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-300 hover:text-[#00c805] hover:bg-[#00c805]/5 transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-zinc-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {cat.label}
              </Link>
            ))}
          </section>

        </div>
      </div>
    </>
  );
}

// ─── Desktop Markets dropdown ─────────────────────────────────────────────────

function MarketsDropdown({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-2 w-[820px] bg-[#111114] rounded-2xl shadow-2xl border border-white/[0.06] p-6 grid grid-cols-5 gap-4 z-50"
    >
      {MARKETS.map((mkt) => (
        <div key={mkt.code}>
          <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <span>{mkt.flag}</span>{mkt.label}
          </p>
          <div className="space-y-0.5">
            {mkt.cities.map((c) => (
              <Link
                key={c.slug}
                href={`/opportunities/${c.slug}`}
                onClick={onClose}
                className="block text-xs text-zinc-400 hover:text-[#00c805] px-2 py-1.5 rounded-lg hover:bg-[#00c805]/5 transition-all duration-100"
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

// ─── Main component ───────────────────────────────────────────────────────────

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [marketsOpen,  setMarketsOpen]  = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openCountry, setOpenCountry]   = useState<string | null>(null);

  const closeMobile = () => { setMobileMenuOpen(false); setOpenCountry(null); };

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={cn(
        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-100",
        pathname.startsWith(href) ? "text-white" : "text-zinc-400 hover:text-white"
      )}
    >
      {label}
    </Link>
  );

  return (
    <>
      {/* ── Nav bar ── */}
      <nav className="sticky top-0 z-50 bg-[#0c0d14]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-3">

          {/* LEFT: Hamburger (all viewports) */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 -ml-1 text-zinc-400 hover:text-white transition-colors shrink-0"
            aria-label="Open navigation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-[#00c805] font-mono font-bold text-[15px] tracking-tight">prime-atlas</span>
          </Link>

          {/* ── Desktop center links ── */}
          <div className="hidden md:flex items-center gap-1 ml-4 flex-1">

            {/* Markets — click dropdown */}
            <div className="relative">
              <button
                onClick={() => setMarketsOpen(v => !v)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-100",
                  marketsOpen || pathname.startsWith("/opportunities")
                    ? "text-white bg-zinc-800"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                Markets
                <svg
                  className={`w-3.5 h-3.5 opacity-60 transition-transform duration-150 ${marketsOpen ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <MarketsDropdown open={marketsOpen} onClose={() => setMarketsOpen(false)} />
            </div>

            {navLink("/listings",    "Listings")}
            {navLink("/market-feed", "Live Feed")}
            {navLink("/deal-board",  "Deal Board")}
          </div>

          {/* ── Desktop auth ── */}
          <div className="hidden md:flex items-center gap-3 ml-auto">
            {user ? (
              <>
                <span className="text-sm text-zinc-400">{user.email?.split("@")[0]}</span>
                <form action="/auth/signout" method="post">
                  <button type="submit" className="text-sm text-zinc-400 hover:text-white transition-colors">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="text-sm text-zinc-400 hover:text-white transition-colors">
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

          {/* ── Mobile right: auth + hamburger ── */}
          <div className="md:hidden flex items-center gap-2 ml-auto">
            {!user && (
              <Link
                href="/auth/signup"
                className="text-xs font-bold bg-[#00c805] text-black px-3 py-1.5 rounded-full"
              >
                Get access
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-zinc-400 hover:text-white transition-colors"
              aria-label="Menu"
            >
              {mobileMenuOpen ? (
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

      {/* ── Left sidebar (all viewports) ── */}
      <LeftSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ── Mobile full-screen menu ── */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-40 bg-[#0c0d14] transition-opacity duration-200",
          mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        style={{ top: "56px" }}
      >
        <div className="overflow-y-auto h-full pb-36 px-5 pt-8 space-y-10">

          <section>
            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-4">Navigate</p>
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
                  onClick={closeMobile}
                  className={cn(
                    "flex items-center justify-between px-4 py-4 rounded-2xl text-base font-semibold transition-colors",
                    pathname === href ? "text-[#00c805] bg-[#00c805]/8" : "text-white hover:bg-zinc-900"
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

          <section>
            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-4">Markets</p>
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
                          onClick={closeMobile}
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

          <section>
            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-4">By Category</p>
            <div className="grid grid-cols-2 gap-1">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.href}
                  href={cat.href}
                  onClick={closeMobile}
                  className="px-4 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-[#00c805] hover:bg-[#00c805]/5 transition-colors"
                >
                  {cat.label}
                </Link>
              ))}
            </div>
          </section>

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
              <Link href="/auth/login" onClick={closeMobile} className="px-4 py-4 rounded-2xl text-base font-medium text-zinc-400 hover:bg-zinc-900 transition-colors">
                Log in
              </Link>
              <Link href="/auth/signup" onClick={closeMobile} className="px-4 py-4 rounded-full text-base font-bold bg-[#00c805] text-black text-center hover:bg-[#00c805]/90 transition-colors">
                Get access — free
              </Link>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
