import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth/signin
 *
 * Root cause of ALL previous failures: Vercel's edge network strips Set-Cookie
 * headers from 3xx redirect responses before they reach the browser.
 * Every approach that returned a 303/307 redirect with cookies failed for this reason.
 *
 * Fix: return HTTP 200 with the Set-Cookie header, then redirect via inline JS.
 * The browser stores cookies from the 200 response, then window.location fires,
 * and the subsequent GET /dashboard carries the auth cookie to the server.
 */

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const PROJECT_REF = SUPABASE_URL.match(/https?:\/\/([^.]+)/)?.[1] ?? "";
const AUTH_COOKIE = `sb-${PROJECT_REF}-auth-token`;
const CHUNK_SIZE  = 3180;

function chunkString(str: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += size) chunks.push(str.slice(i, i + size));
  return chunks;
}

function htmlRedirect(to: string, errorMsg?: string): NextResponse {
  const dest = errorMsg
    ? `/auth/login?error=${encodeURIComponent(errorMsg)}&redirect=${encodeURIComponent(to)}`
    : to;
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>prime-atlas</title>` +
    `<script>window.location.replace(${JSON.stringify(dest)})</script>` +
    `</head><body></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function POST(request: NextRequest) {
  const formData   = await request.formData();
  const email      = (formData.get("email")      as string) ?? "";
  const password   = (formData.get("password")   as string) ?? "";
  const redirectTo = (formData.get("redirectTo") as string) || "/dashboard";

  // ── 1. Authenticate with Supabase REST API ──────────────────────────────────
  let authData: Record<string, unknown>;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "apikey":        SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email, password }),
    });

    authData = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const raw = String(authData.error_description ?? authData.msg ?? authData.error ?? "");
      console.log("[signin] auth error:", raw);
      return htmlRedirect(
        redirectTo,
        raw.toLowerCase().includes("invalid") ? "Invalid email or password." : raw || "Sign in failed"
      );
    }
  } catch (err) {
    console.error("[signin] fetch error:", err);
    return htmlRedirect(redirectTo, "Network error. Please try again.");
  }

  const userId    = (authData.user as { id?: string })?.id ?? "NULL";
  const expiresIn = (authData.expires_in as number) ?? 3600;
  console.log("[signin] authenticated user:", userId);

  // ── 2. Build 200 response with Set-Cookie ───────────────────────────────────
  // Returning 200 (not 3xx) so Vercel's edge does NOT strip the Set-Cookie header.
  const response = htmlRedirect(redirectTo); // no error → redirects to dashboard

  const sessionValue = JSON.stringify(authData);
  const chunks       = chunkString(sessionValue, CHUNK_SIZE);

  const cookieOptions = {
    path:     "/",
    httpOnly: false,
    sameSite: "lax" as const,
    secure:   true,
    maxAge:   expiresIn,
  };

  if (chunks.length === 1) {
    response.cookies.set(AUTH_COOKIE, sessionValue, cookieOptions);
  } else {
    chunks.forEach((chunk, i) =>
      response.cookies.set(`${AUTH_COOKIE}.${i}`, chunk, cookieOptions)
    );
  }

  console.log("[signin] set-cookie (200):", response.cookies.getAll().map((c) => c.name));
  return response;
}
