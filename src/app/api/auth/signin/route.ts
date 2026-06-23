import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth/signin
 *
 * Bypasses @supabase/ssr entirely — calls the Supabase Auth REST API directly,
 * then writes the session cookie in the exact format @supabase/ssr@0.3.x reads.
 *
 * Root cause of all previous failures: @supabase/ssr@0.3.0 never fires setAll()
 * after signInWithPassword() in a Route Handler context, so the cookie was always
 * empty. This approach has zero dependency on that broken code path.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Extract project ref from URL: https://<ref>.supabase.co
const PROJECT_REF = SUPABASE_URL.match(/https?:\/\/([^.]+)/)?.[1] ?? "";
const AUTH_COOKIE = `sb-${PROJECT_REF}-auth-token`;

// @supabase/ssr uses 3180 chars per chunk to stay under the 4KB cookie limit
const CHUNK_SIZE = 3180;

function chunkString(str: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email    = (formData.get("email")      as string) ?? "";
  const password = (formData.get("password")   as string) ?? "";
  const redirectTo = (formData.get("redirectTo") as string) || "/dashboard";
  const origin = request.nextUrl.origin;

  const errorRedirect = (msg: string) =>
    NextResponse.redirect(
      new URL(
        `/auth/login?error=${encodeURIComponent(msg)}&redirect=${encodeURIComponent(redirectTo)}`,
        origin
      ),
      { status: 303 }
    );

  // ── 1. Call Supabase Auth REST API ──────────────────────────────────────────
  let authData: Record<string, unknown>;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email, password }),
    });

    authData = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      const errMsg = String(
        authData.error_description ?? authData.msg ?? authData.error ?? "Sign in failed"
      );
      console.log("[signin] auth error:", errMsg);
      return errorRedirect(
        errMsg.toLowerCase().includes("invalid") ? "Invalid email or password." : errMsg
      );
    }
  } catch (err) {
    console.error("[signin] fetch failed:", err);
    return errorRedirect("Network error. Please try again.");
  }

  const userId    = (authData.user as { id?: string })?.id ?? "NULL";
  const expiresIn = (authData.expires_in as number) ?? 3600;
  console.log("[signin] success — user:", userId);

  // ── 2. Serialize session into cookie(s) ─────────────────────────────────────
  // @supabase/ssr reads cookies named:
  //   sb-<ref>-auth-token          (if session JSON fits in one cookie)
  //   sb-<ref>-auth-token.0 / .1 … (if it needs to be chunked)
  const sessionValue = JSON.stringify(authData);
  const chunks = chunkString(sessionValue, CHUNK_SIZE);

  console.log("[signin] cookie:", AUTH_COOKIE, "| length:", sessionValue.length, "| chunks:", chunks.length);

  const cookieOptions = {
    path: "/",
    httpOnly: false,           // false so createBrowserClient can read the same cookie
    sameSite: "lax" as const,
    secure: true,
    maxAge: expiresIn,
  };

  const response = NextResponse.redirect(new URL(redirectTo, origin), { status: 303 });

  if (chunks.length === 1) {
    response.cookies.set(AUTH_COOKIE, sessionValue, cookieOptions);
  } else {
    chunks.forEach((chunk, i) => {
      response.cookies.set(`${AUTH_COOKIE}.${i}`, chunk, cookieOptions);
    });
  }

  console.log("[signin] set-cookie names:", response.cookies.getAll().map((c) => c.name));
  return response;
}
