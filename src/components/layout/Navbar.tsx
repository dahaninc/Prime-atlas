"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/rankings",              label: "Rankings" },
  { href: "/opportunities",         label: "Opportunities" },
  { href: "/signals",               label: "Signals" },
  { href: "/capital",               label: "Capital" },
];

interface NavbarProps {
  user?: { email?: string } | null;
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <span className="text-pa-green font-mono font-bold text-base tracking-tight">
            prime-atlas
          </span>
          <span className="hidden sm:inline text-pa-green/70 text-xs border border-pa-green/20 rounded px-1.5 py-0.5 font-mono">
            Early Access
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm transition-colors",
                pathname.startsWith(href)
                  ? "text-foreground bg-secondary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Dashboard
              </Link>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="bg-pa-green text-pa-navy font-semibold text-sm px-4 py-1.5 rounded-md hover:bg-pa-green/90 transition-colors"
              >
                Get started free
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-muted-foreground hover:text-foreground"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border px-4 py-3 flex flex-col gap-1 bg-background">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              {label}
            </Link>
          ))}
          <div className="border-t border-border mt-2 pt-2 flex flex-col gap-1">
            {user ? (
              <>
                <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">Dashboard</Link>
                <form action="/auth/signout" method="post">
                  <button type="submit" className="w-full text-left px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">Sign out</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/auth/login" onClick={() => setMenuOpen(false)} className="px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">Sign in</Link>
                <Link href="/auth/signup" onClick={() => setMenuOpen(false)} className="px-3 py-2 rounded-md text-sm bg-pa-green text-pa-navy font-semibold hover:bg-pa-green/90 transition-colors">Get started free</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
