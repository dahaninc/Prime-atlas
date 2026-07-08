import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/auth/admins";

/** Routes that require authentication */
const PROTECTED_ROUTES = [
  "/dashboard",
  "/watchlists",
  "/signals",
  "/opportunities/finder",
  "/admin",
  "/portfolio",
  "/screener",
  "/reports/market",
];
// /deal-board is DELIBERATELY not in this list (2026-07-09): its All-Markets
// view is the public top-of-funnel teaser previously served by /underpriced
// (aggregate counts + waitlist CTA, no listing data, no real market
// screening) — the whole reason /underpriced merged into Deal Board was to
// preserve that anonymous preview, not wall it off. The page component
// itself (src/app/deal-board/page.tsx) branches on auth: anonymous visitors
// get a deliberately light, teaser-only fetch and are locked into All
// Markets / free-tier view; every authed feature (per-market screening,
// financing, memo/brochure export) still requires a real session, enforced
// independently by each API route (/api/deal-board/listings,
// /api/export/ic-memo, /api/export/deal-brochure all 401 without a user) —
// removing this route from middleware does not weaken those.

/** Routes that require a paid subscription */
const PAID_ROUTES = ["/opportunities/finder", "/signals"];

/** Routes that require admin access (checked on top of auth) */
const ADMIN_ROUTES = ["/admin"];

const FREE_TIERS = new Set(["free"]);

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Full path + query, for building a post-login redirect target that
  // preserves deep-link params (e.g. /deal-board?view=all — the
  // /underpriced -> Deal Board All-Markets redirect relies on this so an
  // anonymous visit to /underpriced still lands in the right view mode
  // after login, not just the bare route).
  const pathWithQuery = path + request.nextUrl.search;

  // ── Strip Stripe session_id from dashboard URL ───────────────────────────
  if (path === "/dashboard" && request.nextUrl.searchParams.has("session_id")) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("session_id");
    return NextResponse.redirect(clean);
  }

  // ── Anonymous fast-path ───────────────────────────────────────────────────
  // Visitors with no Supabase auth cookies can't have a session to refresh.
  // Skip the auth round-trip entirely on public routes so anonymous traffic
  // never touches Supabase (protected routes still fall through to the
  // login redirect below).
  const hasAuthCookies = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-"));
  const isProtectedPath = PROTECTED_ROUTES.some((r) => path.startsWith(r));

  if (!hasAuthCookies) {
    if (!isProtectedPath) {
      return NextResponse.next({ request });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("redirect", pathWithQuery);
    return NextResponse.redirect(loginUrl);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the JWT with GoTrue and refreshes it when expired.
  // This must run on EVERY matched request (not just protected routes) so
  // sessions stay alive while users browse public pages.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Any redirect we return must carry the refreshed session cookies,
  // otherwise the browser keeps the stale token and loops.
  const redirectWithCookies = (url: URL) => {
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  };

  // ── Auth guard ────────────────────────────────────────────────────────────
  if (isProtectedPath && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("redirect", pathWithQuery);
    return redirectWithCookies(loginUrl);
  }

  // ── Admin guard ───────────────────────────────────────────────────────────
  if (user && ADMIN_ROUTES.some((r) => path.startsWith(r))) {
    if (!isAdminEmail(user.email)) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      homeUrl.search = "";
      return redirectWithCookies(homeUrl);
    }
  }

  // ── Subscription tier guard ───────────────────────────────────────────────
  if (user && PAID_ROUTES.some((r) => path.startsWith(r))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();

    const tier = profile?.subscription_tier ?? "free";

    if (FREE_TIERS.has(tier)) {
      const upgradeUrl = request.nextUrl.clone();
      upgradeUrl.pathname = "/pricing";
      upgradeUrl.search = "";
      upgradeUrl.searchParams.set("upgrade", "1");
      upgradeUrl.searchParams.set("source", path.replace(/\//g, ""));
      return redirectWithCookies(upgradeUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
