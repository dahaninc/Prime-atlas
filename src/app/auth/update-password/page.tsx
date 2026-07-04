"use client";

/**
 * /auth/update-password
 *
 * Landing page after a Supabase password-recovery link is followed.
 *
 * Two paths to arrive here:
 *
 *  A. PKCE flow (our default — flowType: "pkce" in createBrowserClient):
 *     The recovery email contains a link like:
 *       https://vcnpevcmnobpznikahku.supabase.co/auth/v1/verify
 *         ?redirect_to=<origin>/auth/callback?next=/auth/update-password
 *         &type=recovery&token_hash=xxxx
 *     GoTrue exchanges the token and redirects to /auth/callback?code=xxxx&next=…
 *     /auth/callback exchanges the code → session set in cookies → redirect here.
 *     On arrival the Supabase client already has an active session, so we just
 *     call updateUser({ password }).
 *
 *  B. Implicit flow (magic-link style, fragment-based):
 *     The URL contains #access_token=…&refresh_token=…&type=recovery
 *     AuthProvider catches the PASSWORD_RECOVERY event from onAuthStateChange
 *     and routes to this page. The session is already set in the Supabase client.
 *
 * In both cases we call supabase.auth.updateUser({ password }) which uses the
 * active recovery session.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [sessionReady, setSessionReady] = useState<boolean | null>(null); // null = checking

  const router  = useRouter();
  const supabase = createClient();

  // ── Verify a recovery session is actually present ────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionReady(!!session);
    });
  }, [supabase]);

  // ── Password strength ────────────────────────────────────────────────────
  const pwStrength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8)           s++;
    if (password.length >= 12)          s++;
    if (/[A-Z]/.test(password))         s++;
    if (/[0-9]/.test(password))         s++;
    if (/[^A-Za-z0-9]/.test(password))  s++;
    return s;
  })();
  const pwLabel = ["", "Weak", "Weak", "Fair", "Strong", "Very strong"][pwStrength];
  const pwColor = ["", "bg-pa-red", "bg-pa-red", "bg-pa-amber", "bg-pa-green", "bg-pa-green"][pwStrength];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    // Give the user a moment to read the success message, then redirect.
    setTimeout(() => router.push("/dashboard"), 2500);
  }

  // ── Loading / checking session ───────────────────────────────────────────
  if (sessionReady === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-pa-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── No valid recovery session ────────────────────────────────────────────
  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mb-8">
            <Link href="/" className="text-primary font-mono font-bold text-xl tracking-tight">
              prime-atlas
            </Link>
          </div>
          <div className="border border-border rounded-2xl bg-card p-8">
            <div className="w-12 h-12 rounded-full bg-pa-red/10 border border-pa-red/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-pa-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold mb-2">Link expired or invalid</h1>
            <p className="text-sm text-muted-foreground mb-6">
              This password-reset link has already been used or has expired. Request a new one below.
            </p>
            <Link
              href="/auth/reset-password"
              className="inline-block bg-primary text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-primary/85 transition-colors text-sm"
            >
              Request new reset link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Success state ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mb-8">
            <Link href="/" className="text-primary font-mono font-bold text-xl tracking-tight">
              prime-atlas
            </Link>
          </div>
          <div className="border border-border rounded-2xl bg-card p-8">
            <div className="w-12 h-12 rounded-full bg-pa-green/10 border border-pa-green/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-pa-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-lg font-bold mb-2">Password updated</h1>
            <p className="text-sm text-muted-foreground">
              Redirecting you to your dashboard…
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Set new password form ────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-primary font-mono font-bold text-xl tracking-tight">
            prime-atlas
          </Link>
        </div>

        <div className="border border-border rounded-2xl bg-card p-8">
          <h1 className="text-xl font-bold mb-1">Set new password</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Choose a strong password for your account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="block text-sm text-muted-foreground mb-1.5">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pa-green/50 focus:border-pa-green/50 transition-colors"
              />
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= pwStrength ? pwColor : "bg-secondary"}`} />
                    ))}
                  </div>
                  <p className={`text-xs ${pwStrength <= 2 ? "text-pa-red" : pwStrength === 3 ? "text-pa-amber" : "text-pa-green"}`}>
                    {pwLabel}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm text-muted-foreground mb-1.5">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                required
                autoComplete="new-password"
                className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pa-green/50 focus:border-pa-green/50 transition-colors"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg border border-pa-red/30 bg-pa-red/5 text-pa-red text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || pwStrength < 2}
              className="w-full bg-primary text-white font-semibold py-2.5 rounded-lg hover:bg-primary/85 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <span className="w-4 h-4 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />}
              Update password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
