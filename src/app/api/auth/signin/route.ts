import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

/**
 * Native POST → redirect login handler.
 * The browser submits the form, we set session cookies on the redirect response,
 * the browser stores them and follows the redirect to /dashboard.
 * No client-side JS cookie magic — pure HTTP PRG pattern.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = (formData.get("email") as string) ?? "";
  const password = (formData.get("password") as string) ?? "";
  const redirectTo = (formData.get("redirectTo") as string) || "/dashboard";
  const origin = request.nextUrl.origin;

  const errorRedirect = (msg: string) =>
    NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(msg)}&redirect=${encodeURIComponent(redirectTo)}`, origin),
      { status: 303 }
    );

  // Build the success redirect first — we attach cookies to it inside setAll
  const successResponse = NextResponse.redirect(new URL(redirectTo, origin), { status: 303 });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write directly onto the redirect response — guaranteed to reach the browser
          cookiesToSet.forEach(({ name, value, options }) => {
            successResponse.cookies.set(
              name,
              value,
              options as Parameters<typeof successResponse.cookies.set>[2]
            );
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const msg =
      error.message.includes("Invalid") ? "Invalid email or password." :
      error.message.includes("not confirmed") ? "Please confirm your email first." :
      error.message;
    return errorRedirect(msg);
  }

  return successResponse;
}
