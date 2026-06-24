import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * /auth/callback
 *
 * Handles all Supabase auth redirects that use the PKCE code exchange flow:
 *  - Email confirmation (signup)
 *  - Magic link login
 *  - Password recovery (when redirectTo includes ?next=/auth/update-password)
 *
 * Supabase GoTrue appends ?code=<pkce_code> to this URL after processing
 * the initial token hash. We exchange the code for a server-side session,
 * which writes the auth cookies, then redirect the user to `next` or /dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get("code");
  const next  = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Supabase passes error params when the link is expired or already used
  if (error) {
    const message = errorDescription
      ? encodeURIComponent(errorDescription)
      : encodeURIComponent("This link has expired or is invalid. Please try again.");
    return NextResponse.redirect(`${origin}/auth/login?error=${message}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      const message = encodeURIComponent(
        exchangeError.message.includes("expired")
          ? "This link has expired. Please request a new one."
          : "Authentication failed. Please try again."
      );
      return NextResponse.redirect(`${origin}/auth/login?error=${message}`);
    }

    // Code exchanged successfully — redirect to intended destination.
    // For recovery flow, next = /auth/update-password.
    return NextResponse.redirect(`${origin}${next}`);
  }

  // No code and no error — invalid callback invocation
  return NextResponse.redirect(
    `${origin}/auth/login?error=${encodeURIComponent("Invalid authentication link.")}`
  );
}
