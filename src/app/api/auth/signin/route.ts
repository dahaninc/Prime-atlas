import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth/signin
 *
 * Returns tokens as JSON. The client calls supabase.auth.setSession() which
 * writes the cookie in exactly the format @supabase/ssr expects to read.
 * This avoids all manual cookie-crafting / format mismatch issues.
 */

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email    = (formData.get("email")    as string) ?? "";
  const password = (formData.get("password") as string) ?? "";

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

    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const raw = String(data.error_description ?? data.msg ?? data.error ?? "Sign in failed");
      console.log("[signin] auth error:", raw);
      return NextResponse.json(
        { error: raw.toLowerCase().includes("invalid") ? "Invalid email or password." : raw },
        { status: 401 }
      );
    }

    console.log("[signin] authenticated user:", (data.user as { id?: string })?.id ?? "NULL");
    return NextResponse.json({
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
    });
  } catch (err) {
    console.error("[signin] fetch error:", err);
    return NextResponse.json({ error: "Network error. Please try again." }, { status: 500 });
  }
}
