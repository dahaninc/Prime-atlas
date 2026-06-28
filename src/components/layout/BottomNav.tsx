"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* ─── icons ─────────────────────────────────────────────────────── */

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function MarketsIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  );
}

function FeedIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
    </svg>
  );
}

function ListingsIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function AccountIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

/* ─── tab config ─────────────────────────────────────────────────── */

const TABS = [
  { href: "/",            label: "Home",     Icon: HomeIcon     },
  { href: "/deal-board",  label: "Markets",  Icon: MarketsIcon  },
  { href: "/market-feed", label: "Feed",     Icon: FeedIcon     },
  { href: "/listings",    label: "Listings", Icon: ListingsIcon },
  { href: "/auth/login",  label: "Account",  Icon: AccountIcon  },
];

/* ─── component ─────────────────────────────────────────────────── */

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Glass background */}
      <div className="
        border-t border-border/60
        bg-background/90 backdrop-blur-xl
        flex items-stretch
      ">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/"
            ? pathname === "/"
            : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] relative"
            >
              {/* Active indicator dot */}
              {active && (
                <span className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-pa-green" />
              )}

              <span className={`transition-colors duration-100 ${
                active ? "text-pa-green" : "text-muted-foreground"
              }`}>
                <Icon active={active} />
              </span>

              <span className={`text-[10px] font-semibold tracking-tight transition-colors duration-100 ${
                active ? "text-pa-green" : "text-muted-foreground"
              }`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
