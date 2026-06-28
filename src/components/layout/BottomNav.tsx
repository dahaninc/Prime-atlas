"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-[22px] h-[22px]" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}
function MarketsIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-[22px] h-[22px]" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M3 20h18" />
    </svg>
  );
}
function FeedIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-[22px] h-[22px]" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ListingsIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-[22px] h-[22px]" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}
function IntegrationsIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-[22px] h-[22px]" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M4 6h16M4 10h16M4 14h10M4 18h6" />
      <circle cx="19" cy="16" r="3" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 13v-1M19 22v-3" />
    </svg>
  );
}

function AccountIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-[22px] h-[22px]" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

const TABS = [
  { href: "/",               label: "Home",   Icon: HomeIcon         },
  { href: "/deal-board",     label: "Markets", Icon: MarketsIcon     },
  { href: "/market-feed",    label: "Feed",    Icon: FeedIcon        },
  { href: "/integrations",   label: "Apps",    Icon: IntegrationsIcon },
  { href: "/auth/login",     label: "Account", Icon: AccountIcon     },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-[#27272A]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[60px] transition-colors"
            >
              {/* Active indicator */}
              {active && (
                <span className="absolute top-0 w-8 h-[2px] rounded-full bg-[#00C805]" style={{ marginTop: 0 }} />
              )}
              <span className={active ? "text-[#00C805]" : "text-[#A1A1AA]"}>
                <Icon active={active} />
              </span>
              <span className={`text-[9px] font-semibold tracking-wide ${active ? "text-[#00C805]" : "text-[#A1A1AA]"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
