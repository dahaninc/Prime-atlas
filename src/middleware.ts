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

const FREE_TIERS = new Set(["free"]);

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // ── Strip Stripe session_id from dashboard URL ───────────────────────────
  if (path === "/dashboard" && request.nextUrl.searchParams.has("session_id")) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("session_id");
    return NextResponse.redirect(clean);
  }

  // Only run Supabase auth for routes that actually need it.
  // CRITICAL: @supabase/ssr v0.3.0 uses cookies.get/set/remove (NOT getAll/setAll).
  // Using getAll/setAll causes getItem() to return undefined on every call →
  // session is never found → session wipe on every response.
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
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          // Must set on both request (for downstream reads) and response (for browser)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          request.cookies.set(name, value);
          supabaseResponse = NextResponse.next({ request });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabaseResponse.cookies.set(name, value, options as any);
        },
        remove(name: string, options: Record<string, unknown>) {
          request.cookies.set(name, "");
          supabaseResponse = NextResponse.next({ request });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabaseResponse.cookies.set(name, "", { ...(options as any), maxAge: 0 });
        },
      },
    }
  );

  // getUser() validates the JWT with GoTrue and refreshes if needed.
  // With the correct cookie API above, the session is now readable.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Auth guard ────────────────────────────────────────────────────────────
  const isProtected = PROTECTED_ROUTES.some((r) => path.startsWith(r));
  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("redirect", path);
    return NextResponse.redirect(loginUrl);
  }

  // ── Subscription tier guard ───────────────────────────────────────────────
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

    supabaseResponse.headers.set("x-subscription-tier", tier);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
