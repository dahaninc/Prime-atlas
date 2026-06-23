import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

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

  const successResponse = NextResponse.redirect(new URL(redirectTo, origin), { status: 303 });

  const cookiesSet: string[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookiesSet.push(name);
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

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  console.log("[signin] error:", error?.message ?? "none");
  console.log("[signin] user:", data?.session?.user?.id ?? "NULL");
  console.log("[signin] setAll called with cookies:", cookiesSet);
  console.log("[signin] response Set-Cookie count:", successResponse.cookies.getAll().length);
  console.log("[signin] response cookie names:", successResponse.cookies.getAll().map(c => c.name));

  if (error) {
    const msg =
      error.message.includes("Invalid") ? "Invalid email or password." :
      error.message.includes("not confirmed") ? "Please confirm your email first." :
      error.message;
    return errorRedirect(msg);
  }

  return successResponse;
}
