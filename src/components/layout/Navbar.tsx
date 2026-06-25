"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

// ─── Static market tree ───────────────────────────────────────────────────────

const MARKETS = [
  {
    flag: "🇬🇧", label: "United Kingdom", code: "UK",
    cities: [
      { name: "London",      slug: "london"           },
      { name: "Manchester",  slug: "manchester"       },
      { name: "Cambridge",   slug: "cambridge"        },
      { name: "Birmingham",  slug: "birmingham"       },
      { name: "Bristol",     slug: "bristol"          },
      { name: "Edinburgh",   slug: "edinburgh"        },
      { name: "Oxford",      slug: "oxford"           },
      { name: "Leeds",       slug: "leeds"            },
      { name: "Glasgow",     slug: "glasgow"          },
      { name: "Liverpool",   slug: "liverpool"        },
      { name: "Cardiff",     slug: "cardiff"          },
      { name: "Sheffield",   slug: "sheffield"        },
      { name: "Nottingham",  slug: "nottingham"       },
      { name: "Leicester",   slug: "leicester"        },
    ],
  },
  {
    flag: "🇺🇸", label: "United States", code: "US",
    cities: [
      { name: "New York City",  slug: "new-york-ny"        },
      { name: "Los Angeles",    slug: "los-angeles-ca"     },
      { name: "Chicago",        slug: "chicago-il"         },
      { name: "Houston",        slug: "houston-tx"         },
      { name: "Miami",          slug: "miami-fl"           },
      { name: "Seattle",        slug: "seattle-wa"         },
      { name: "Boston",         slug: "boston-ma"          },
      { name: "San Francisco",  slug: "san-francisco-ca"   },
      { name: "Austin",         slug: "austin-tx"          },
      { name: "Nashville",      slug: "nashville-tn"       },
      { name: "Raleigh",        slug: "raleigh-nc"         },
      { name: "Phoenix",        slug: "phoenix-az"         },
      { name: "Denver",         slug: "denver-co"          },
      { name: "Charlotte",      slug: "charlotte-nc"       },
      { name: "Tampa",          slug: "tampa-fl"           },
    ],
  },
  {
    flag: "🇦🇺", label: "Australia", code: "AU",
    cities: [
      { name: "Sydney",         slug: "sydney-nsw"         },
      { name: "Melbourne",      slug: "melbourne-vic"      },
      { name: "Brisbane",       slug: "brisbane-qld"       },
      { name: "Perth",          slug: "perth-wa"           },
      { name: "Adelaide",       slug: "adelaide-sa"        },
      { name: "Gold Coast",     slug: "gold-coast-qld"     },
      { name: "Canberra",       slug: "canberra-act"       },
      { name: "Geelong",        slug: "geelong-vic"        },
      { name: "Sunshine Coast", slug: "sunshine-coast-qld" },
      { name: "Newcastle",      slug: "newcastle-nsw"      },
      { name: "Wollongong",     slug: "wollongong-nsw"     },
      { name: "Hobart",         slug: "hobart-tas"         },
    ],
  },
  {
    flag: "🇨🇦", label: "Canada", code: "CA",
    cities: [
      { name: "Toronto",     slug: "toronto-on"    },
      { name: "Vancouver",   slug: "vancouver-bc"  },
      { name: "Montreal",    slug: "montreal-qc"   },
      { name: "Calgary",     slug: "calgary-ab"    },
      { name: "Ottawa",      slug: "ottawa-on"     },
      { name: "Edmonton",    slug: "edmonton-ab"   },
      { name: "Halifax",     slug: "halifax-ns"    },
      { name: "Hamilton",    slug: "hamilton-on"   },
      { name: "Kelowna",     slug: "kelowna-bc"    },
      { name: "Victoria",    slug: "victoria-bc"   },
      { name: "Saskatoon",   slug: "saskatoon-sk"  },
    ],
  },
  {
    flag: "🇪🇸", label: "Spain", code: "ES",
    cities: [
      { name: "Madrid",          slug: "madrid"           },
      { name: "Barcelona",       slug: "barcelona"        },
      { name: "Valencia",        slug: "valencia"         },
      { name: "Seville",         slug: "seville"          },
      { name: "Bilbao",          slug: "bilbao"           },
      { name: "Torrevieja",      slug: "torrevieja"       },
      { name: "Alicante",        slug: "alicante"         },
      { name: "Benidorm",        slug: "benidorm"         },
      { name: "Dénia",           slug: "denia"            },
      { name: "Sagunto",         slug: "sagunto"          },
      { name: "Orihuela Costa",  slug: "orihuela-costa"   },
    ],
  },
];

const CATEGORIES = [
  { label: "Build-to-Rent (BTR)",         href: "/opportunities?category=BTR"                },
  { label: "Student Housing (PBSA)",       href: "/opportunities?category=PBSA"               },
  { label: "Affordable Housing",           href: "/opportunities?category=Affordable+Housing" },
  { label: "Commercial Office",            href: "/opportunities?category=Commercial"          },
  { label: "Industrial / Warehouse",       href: "/opportunities?category=Industrial"          },
  { label: "Mixed-use",                    href: "/opportunities?category=Mixed-use"           },
  { label: "Land & Development",           href: "/opportunities?category=Land"               },
];

interface NavbarProps {
  user?: { email?: string } | null;
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [openCountry,   setOpenCountry]   = useState<string | null>(null);
  const [marketsOpen,   setMarketsOpen]   = useState(false);
  const [oppsOpen,      setOppsOpen]      = useState(false);

  const close = () => { setDrawerOpen(false); setOpenCountry(null); };

  return (
    <>
      {/* ── Main nav bar ── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0" onClick={close}>
            <span className="text-pa-green font-mono font-bold text-base tracking-tight">prime-atlas</span>
            <span className="hidden sm:inline text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 font-mono">
              conviction terminal
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5">
            <Link
              href="/deal-board"
              className={cn("px-3 py-1.5 rounded-md text-sm transition-colors",
                pathname === "/deal-board" ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              Deal Board
            </Link>

            {/* Markets dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setMarketsOpen(true)}
              onMouseLeave={() => setMarketsOpen(false)}
            >
              <button className={cn("flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-colors",
                pathname.startsWith("/opportunities") ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}>
                Markets
                <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {marketsOpen && (
                <div className="absolute top-full left-0 mt-1 w-[860px] bg-background border border-border rounded-xl shadow-xl p-4 grid grid-cols-5 gap-3 z-50">
                  {MARKETS.map((mkt) => (
                    <div key={mkt.code}>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1">
                        <span>{mkt.flag}</span> {mkt.code}
                      </p>
                      <div className="space-y-0.5">
                        {mkt.cities.map((c) => (
                          <Link
                            key={c.slug}
                            href={`/opportunities/${c.slug}`}
                            className="block text-xs text-muted-foreground hover:text-pa-green hover:bg-secondary/50 px-1.5 py-1 rounded transition-colors"
                          >
                            {c.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Opportunities dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setOppsOpen(true)}
              onMouseLeave={() => setOppsOpen(false)}
            >
              <button className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
                Opportunities
                <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {oppsOpen && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-background border border-border rounded-xl shadow-xl py-2 z-50">
                  {CATEGORIES.map((cat) => (
                    <Link
                      key={cat.href}
                      href={cat.href}
                      className="block px-4 py-2 text-sm text-muted-foreground hover:text-pa-green hover:bg-secondary/50 transition-colors"
                    >
                      {cat.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/reports/undersupplied-markets"
              className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              Reports
            </Link>
          </div>

          {/* Right — auth */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <Link href="/deal-board" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {user.email?.split("@")[0]}
                </Link>
                <form action="/auth/signout" method="post">
                  <button type="submit" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign out</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign in</Link>
                <Link href="/auth/signup" className="bg-pa-green text-pa-navy font-semibold text-sm px-4 py-1.5 rounded-md hover:bg-pa-green/90 transition-colors">
                  Get access
                </Link>
              </>
            )}
          </div>

          {/* Hamburger */}
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setDrawerOpen(!drawerOpen)}
            aria-label="Toggle menu"
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
      </nav>

      {/* ── Mobile drawer ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex flex-col" style={{ top: "56px" }}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={close} />

          {/* Drawer panel */}
          <div className="relative w-full bg-background border-b border-border overflow-y-auto max-h-[calc(100vh-56px)] shadow-2xl">
            <div className="px-4 py-4 space-y-1">

              {/* Deal Board */}
              <Link href="/deal-board" onClick={close}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
              >
                <span className="text-pa-green">⬛</span> Deal Board
                <span className="ml-auto text-xs text-muted-foreground">All markets ranked</span>
              </Link>

              {/* Divider */}
              <div className="py-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 mb-2">Markets</p>
              </div>

              {/* Country/city tree */}
              {MARKETS.map((mkt) => (
                <div key={mkt.code}>
                  <button
                    onClick={() => setOpenCountry(openCountry === mkt.code ? null : mkt.code)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors"
                  >
                    <span className="text-base">{mkt.flag}</span>
                    <span className="font-medium">{mkt.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{mkt.cities.length} cities</span>
                    <svg
                      className={cn("w-4 h-4 text-muted-foreground transition-transform", openCountry === mkt.code && "rotate-180")}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {openCountry === mkt.code && (
                    <div className="ml-9 mt-1 mb-2 grid grid-cols-2 gap-0.5">
                      {mkt.cities.map((c) => (
                        <Link
                          key={c.slug}
                          href={`/opportunities/${c.slug}`}
                          onClick={close}
                          className="px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-pa-green hover:bg-secondary/50 transition-colors"
                        >
                          {c.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Opportunities by category */}
              <div className="py-1 pt-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 mb-2">By Category</p>
              </div>
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.href}
                  href={cat.href}
                  onClick={close}
                  className="block px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-pa-green hover:bg-secondary/50 transition-colors"
                >
                  {cat.label}
                </Link>
              ))}

              {/* Reports */}
              <div className="py-1 pt-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 mb-2">Reports</p>
              </div>
              <Link href="/reports/undersupplied-markets" onClick={close}
                className="block px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-pa-green hover:bg-secondary/50 transition-colors"
              >
                25 Most Undersupplied Markets Q2 2026
              </Link>

              {/* Auth */}
              <div className="border-t border-border mt-3 pt-3 flex flex-col gap-1">
                {user ? (
                  <>
                    <p className="px-3 py-1 text-xs text-muted-foreground">{user.email}</p>
                    <Link href="/deal-board" onClick={close} className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Deal Board</Link>
                    <form action="/auth/signout" method="post">
                      <button type="submit" className="w-full text-left px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Sign out</button>
                    </form>
                  </>
                ) : (
                  <>
                    <Link href="/auth/login" onClick={close} className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Sign in</Link>
                    <Link href="/auth/signup" onClick={close} className="px-3 py-2 rounded-lg text-sm bg-pa-green text-pa-navy font-semibold hover:bg-pa-green/90 transition-colors">
                      Get access — free
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
