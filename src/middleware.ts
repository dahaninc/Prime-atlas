import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Routes that require authentication */
const PROTECTED_ROUTES = [
  "/dashboard",
  "/watchlists",
  "/signals",
  "/opportunities/finder",
];

/** Routes that require Pro+ subscription */
const PRO_ROUTES = [
  "/opportunities/finder",
  "/signals",
];

/** Investor+ routes (reserved for Step 6) */
// const INVESTOR_ROUTES: string[] = [];

const FREE_TIERS = new Set(["free"]);

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // ── 3. Strip Stripe redirect params from URL after success ───────────────
  if (path === "/dashboard" && request.nextUrl.searchParams.has("session_id")) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("session_id");
    return NextResponse.redirect(clean);
  }

  // Only create Supabase client + call getUser() for routes that need auth.
  // Calling getUser() unconditionally on every request causes the SDK to clear
  // the session cookies when the GoTrue /user call fails, which breaks auth on
  // all subsequent server-component reads via cookies().
  const needsAuth =
    PROTECTED_ROUTES.some((r) => path.startsWith(r)) ||
    PRO_ROUTES.some((r) => path.startsWith(r));

  if (!needsAuth) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: object }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // ── 1. Auth guard ────────────────────────────────────────────────────────
  const isProtected = PROTECTED_ROUTES.some((r) => path.startsWith(r));
  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("redirect", path);
    return NextResponse.redirect(loginUrl);
  }

  // ── 2. Subscription tier guard ───────────────────────────────────────────
  if (user && PRO_ROUTES.some((r) => path.startsWith(r))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();

    const tier = profile?.subscription_tier ?? "free";

    if (FREE_TIERS.has(tier)) {
      const upgradeUrl = request.nextUrl.clone();
      upgradeUrl.pathname = "/pricing";
      upgradeUrl.searchParams.set("upgrade", "pro");
      upgradeUrl.searchParams.set("source", path.replace(/\//g, ""));
      return NextResponse.redirect(upgradeUrl);
    }

    // Forward tier as response header — readable by layouts without extra DB hit
    supabaseResponse.headers.set("x-subscription-tier", tier);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
