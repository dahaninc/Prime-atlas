"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

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
  const pathname = usePathname();
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
        className={`fixed top-0 left-0 bottom-0 z-[56] w-72 bg-card border-r border-border flex flex-col
          transition-transform duration-200 ease-out
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-border shrink-0">
          <span className="text-primary font-bold text-sm tracking-tight">prime-atlas</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-foreground transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 py-6 px-3 space-y-8">

          {/* Markets */}
          <section>
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest px-3 mb-2">Markets</p>
            {MARKETS.map((mkt) => (
              <Link
                key={mkt.code}
                href={`/opportunities/${mkt.cities[0].slug}`}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-foreground hover:bg-secondary transition-colors"
              >
                <span className="text-base w-6 text-center">{mkt.flag}</span>
                {mkt.label}
                <svg className="w-3.5 h-3.5 text-zinc-500 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </section>

          {/* Platform */}
          <section>
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest px-3 mb-2">Platform</p>
            {[
              { label: "Live Listings",  href: "/listings",    dot: "#2563eb" },
              { label: "Market Feed",    href: "/market-feed", dot: "#3b82f6" },
              { label: "Deal Board",     href: "/deal-board",  dot: null      },
            ].map(({ label, href, dot }) => (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  pathname.startsWith(href)
                    ? "text-foreground bg-secondary active-glow"
                    : "text-zinc-400 hover:text-foreground hover:bg-secondary"
                )}
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
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest px-3 mb-2">By Category</p>
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-zinc-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      className="absolute top-full left-0 mt-2 w-[820px] glass-panel rounded-2xl p-6 grid grid-cols-5 gap-4 z-50"
    >
      {MARKETS.map((mkt) => (
        <div key={mkt.code}>
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <span>{mkt.flag}</span>{mkt.label}
          </p>
          <div className="space-y-0.5">
            {mkt.cities.map((c) => (
              <Link
                key={c.slug}
                href={`/opportunities/${c.slug}`}
                onClick={onClose}
                className="block text-xs text-zinc-400 hover:text-primary px-2 py-1.5 rounded-lg hover:bg-primary/10 transition-all duration-100"
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

// ─── Account menu (signed-in workspace) ──────────────────────────────────────

const ACCOUNT_LINKS = [
  { href: "/dashboard",  label: "Dashboard",   desc: "Your overview & saved markets" },
  { href: "/deal-board", label: "Deal Board",  desc: "Underwrite & export IC memos" },
  { href: "/watchlists", label: "Watchlists",  desc: "Saved markets & deal alerts" },
  { href: "/portfolio",  label: "Portfolio",   desc: "Monitor assets you own" },
  { href: "/pricing",    label: "Plan & billing", desc: "Manage your subscription" },
];

function AccountMenu({ email }: { email?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = (email?.[0] ?? "?").toUpperCase();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 group"
        aria-label="Account menu"
      >
        <span className="w-8 h-8 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center">
          {initial}
        </span>
        <svg className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 glass-panel rounded-xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Signed in</p>
            <p className="text-sm text-foreground font-medium truncate">{email}</p>
          </div>
          <div className="py-1">
            {ACCOUNT_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex flex-col px-4 py-2 hover:bg-secondary transition-colors"
              >
                <span className="text-sm font-medium text-foreground">{l.label}</span>
                <span className="text-[11px] text-zinc-500">{l.desc}</span>
              </Link>
            ))}
          </div>
          <form action="/auth/signout" method="post" className="border-t border-border">
            <button type="submit" className="w-full text-left px-4 py-2.5 text-sm text-zinc-500 hover:bg-secondary hover:text-foreground transition-colors">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Navbar({ user: initialUser }: NavbarProps) {
  const pathname = usePathname();
  // When no server-verified user is passed (cached/static pages), resolve the
  // session client-side so public pages stay CDN-cacheable.
  const [user, setUser] = useState<{ email?: string } | null>(initialUser ?? null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? { email: session.user.email } : null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { email: session.user.email } : null);
    });
    return () => subscription.unsubscribe();
  }, []);
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
        pathname.startsWith(href) ? "text-primary bg-primary/10" : "text-zinc-400 hover:text-foreground hover:bg-secondary"
      )}
    >
      {label}
    </Link>
  );

  return (
    <>
      {/* ── Nav bar ── */}
      <nav className="sticky top-0 z-50 glass border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-3">

          {/* LEFT: Hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 -ml-1 text-zinc-500 hover:text-foreground transition-colors shrink-0"
            aria-label="Open navigation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-primary font-bold text-[15px] tracking-tight">prime-atlas</span>
          </Link>

          {/* ── Desktop center links ── */}
          <div className="hidden md:flex items-center gap-1 ml-4 flex-1">
            <div className="relative">
              <button
                onClick={() => setMarketsOpen(v => !v)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-100",
                  marketsOpen || pathname.startsWith("/opportunities")
                    ? "text-primary bg-primary/10"
                    : "text-zinc-400 hover:text-foreground hover:bg-secondary"
                )}
              >
                Markets
                <svg className={`w-3.5 h-3.5 opacity-60 transition-transform duration-150 ${marketsOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <MarketsDropdown open={marketsOpen} onClose={() => setMarketsOpen(false)} />
            </div>

            {navLink("/listings",    "Listings")}
            {navLink("/market-feed", "Live Feed")}
            {navLink("/deal-board",  "Deal Board")}
            {navLink("/underpriced", "Underpriced")}
            {navLink("/screener", "Screener")}
          </div>

          {/* ── Desktop auth ── */}
          <div className="hidden md:flex items-center gap-3 ml-auto">
            {user ? (
              <AccountMenu email={user.email} />
            ) : (
              <>
                <Link href="/auth/login" className="text-sm text-zinc-400 hover:text-foreground transition-colors">Log in</Link>
                <Link href="/auth/signup" className="bg-primary text-white text-sm font-semibold px-4 py-1.5 rounded-lg hover:bg-primary/85 transition-colors">
                  Get started
                </Link>
              </>
            )}
          </div>

          {/* ── Mobile right ── */}
          <div className="md:hidden flex items-center gap-2 ml-auto">
            {!user && (
              <Link href="/auth/signup" className="text-xs font-semibold bg-primary text-white px-3 py-1.5 rounded-lg">
                Get started
              </Link>
            )}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1.5 text-zinc-500 hover:text-foreground transition-colors" aria-label="Menu">
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
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
          "md:hidden fixed inset-0 z-40 bg-background transition-opacity duration-200",
          mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        style={{ top: "56px" }}
      >
        <div className="overflow-y-auto h-full pb-36 px-5 pt-8 space-y-10">

          <section>
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Navigate</p>
            <div className="space-y-1">
              {[
                { href: "/",            label: "Home"      },
                { href: "/listings",    label: "Listings"  },
                { href: "/market-feed", label: "Live Feed" },
                { href: "/deal-board",  label: "Deal Board"},
                { href: "/underpriced", label: "Underpriced"},
                { href: "/screener", label: "Screener"},
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={closeMobile}
                  className={cn(
                    "flex items-center justify-between px-4 py-4 rounded-2xl text-base font-semibold transition-colors",
                    pathname === href ? "text-primary bg-primary/10" : "text-foreground hover:bg-secondary"
                  )}
                >
                  {label}
                  <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Markets</p>
            <div className="space-y-1">
              {MARKETS.map((mkt) => (
                <div key={mkt.code}>
                  <button
                    onClick={() => setOpenCountry(openCountry === mkt.code ? null : mkt.code)}
                    className="w-full flex items-center justify-between px-4 py-4 rounded-2xl text-base font-medium text-foreground hover:bg-secondary transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-lg">{mkt.flag}</span>
                      {mkt.label}
                    </span>
                    <svg
                      className={cn("w-4 h-4 text-zinc-500 transition-transform duration-150", openCountry === mkt.code && "rotate-180")}
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
                          className="px-4 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-primary hover:bg-primary/10 transition-colors"
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
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-4">By Category</p>
            <div className="grid grid-cols-2 gap-1">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.href}
                  href={cat.href}
                  onClick={closeMobile}
                  className="px-4 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  {cat.label}
                </Link>
              ))}
            </div>
          </section>

          {user ? (
            <section className="pt-2">
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Your workspace</p>
              <div className="space-y-1 mb-4">
                {ACCOUNT_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={closeMobile}
                    className={cn(
                      "flex items-center justify-between px-4 py-3.5 rounded-2xl text-base font-semibold transition-colors",
                      pathname === l.href ? "text-primary bg-primary/10" : "text-foreground hover:bg-secondary"
                    )}
                  >
                    {l.label}
                    <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
              <p className="text-xs text-zinc-500 px-1 mb-3">{user.email}</p>
              <form action="/auth/signout" method="post">
                <button type="submit" className="w-full text-left px-4 py-4 rounded-2xl text-sm font-medium text-zinc-500 hover:bg-secondary transition-colors">
                  Sign out
                </button>
              </form>
            </section>
          ) : (
            <section className="flex flex-col gap-3">
              <Link href="/auth/login" onClick={closeMobile} className="px-4 py-4 rounded-2xl text-base font-medium text-zinc-400 hover:bg-secondary transition-colors">
                Log in
              </Link>
              <Link href="/auth/signup" onClick={closeMobile} className="px-4 py-4 rounded-lg text-base font-semibold bg-primary text-white text-center hover:bg-primary/85 transition-colors">
                Get started — free
              </Link>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
