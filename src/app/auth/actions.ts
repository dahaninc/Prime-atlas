"use server";

/**
 * First-party auth actions.
 *
 * Signup/login run on OUR domain via server actions instead of the browser
 * calling *.supabase.co directly. Rationale (learned in production): content
 * and privacy blockers silently kill third-party auth requests — the signup
 * form "did nothing" for a real user. Server actions are same-origin, so
 * blockers never see the Supabase call; @supabase/ssr writes the session
 * cookies on the action response.
 *
 * signupAction returns session=true when auto-confirm signed the user
 * straight in (current config; client hard-navigates) — false means email
 * confirmation is enabled and the check-inbox state applies.
 */

import { createClient } from "@/lib/supabase/server";

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "An account with this email already exists — try signing in instead.";
  }
  if (m.includes("password") && m.includes("at least")) {
    return "Password must be at least 8 characters.";
  }
  if (m.includes("rate") || m.includes("too many")) {
    return "Too many attempts — wait a few minutes and try again.";
  }
  if (m.includes("invalid login credentials")) return "Incorrect email or password.";
  if (m.includes("not confirmed")) return "Your email isn't confirmed yet — check your inbox.";
  return message;
}

export async function signupAction(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<{ ok: true; session: boolean } | { ok: false; error: string }> {
  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://prime-atlas-weld.vercel.app";

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: { full_name: input.fullName.trim() },
      emailRedirectTo: `${appUrl}/auth/callback`,
    },
  });

  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, session: !!data.session };
}

export async function loginAction(input: {
  email: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });
  if (error) return { ok: false, error: friendly(error.message) };
  if (!data.user) return { ok: false, error: "Sign-in completed but no user was returned — try again." };
  return { ok: true };
}
