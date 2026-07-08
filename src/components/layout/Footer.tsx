import Link from "next/link";

const INDEXES = [
  { href: "/market-feed", label: "Market Feed" },
  { href: "/deal-board", label: "Deal Board" },
  { href: "/reports/undersupplied-markets", label: "Undersupplied Markets Report" },
];

const PRODUCT = [
  { href: "/opportunities", label: "Opportunities" },
  { href: "/pricing", label: "Pricing" },
];

const COMPANY = [
  { href: "/about", label: "About" },
  { href: "/methodology", label: "Methodology" },
  { href: "/auth/signup", label: "Get started" },
];

export function Footer() {
  return (
    <footer className="border-t border-border mt-24">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
        {/* Brand */}
        <div className="col-span-2 md:col-span-1">
          <span className="text-primary font-mono font-bold text-base tracking-tight">prime-atlas</span>
          <p className="text-muted-foreground text-xs mt-3 leading-relaxed max-w-xs">
            Institutional investment intelligence for USA + UK property markets. Live deal flow,
            conviction scores, and exit projections — under one platform.
          </p>
        </div>

        {/* Indexes */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Platform</p>
          <ul className="space-y-2">
            {INDEXES.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Product */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Product</p>
          <ul className="space-y-2">
            {PRODUCT.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Company */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Company</p>
          <ul className="space-y-2">
            {COMPANY.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">© 2026 prime-atlas. All rights reserved.</p>
          <p className="text-xs text-muted-foreground">
            Scores are algorithmic estimates, not financial advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
