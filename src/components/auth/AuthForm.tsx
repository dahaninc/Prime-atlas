"use client";

/**
 * Auth form — progressive enhancement, first-party.
 *
 * Both forms bind DIRECTLY to server actions via <form action={...}> with
 * named inputs. This works with zero client JavaScript: a native POST hits
 * our own origin, the action runs Supabase server-side, and success is a
 * real 303 redirect. Rationale (production incident): a user's browser
 * never hydrated the page — the old onSubmit handler never attached, clicks
 * degraded to bare GETs, and signup "did nothing". Content blockers also
 * can't kill same-origin requests the way they kill *.supabase.co calls.
 *
 * JavaScript, when present, only ENHANCES: pending spinner, password
 * strength meter, magic-link option.
 */

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  loginFormAction, signupFormAction, type AuthFormState,
} from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/client";

interface AuthFormProps {
  mode: "login" | "signup";
  redirectTo?: string;
}

const INITIAL: AuthFormState = { error: null };

const inputClasses =
  "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pa-green/50 focus:border-pa-green/50 transition-colors";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="w-full bg-primary text-white font-semibold py-2.5 rounded-lg hover:bg-primary/85 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
      {pending && <span className="w-4 h-4 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />}
      {label}
    </button>
  );
}

function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="p-3 rounded-lg border border-pa-red/30 bg-pa-red/5 text-pa-red text-sm">
      {error}
    </div>
  );
}

export function AuthForm({ mode, redirectTo }: AuthFormProps) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loginState,  loginDispatch]  = useFormState(loginFormAction,  INITIAL);
  const [signupState, signupDispatch] = useFormState(signupFormAction, INITIAL);

  // ── Password strength meter (pure enhancement) ───────────────────────────
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

  // ── Login form ───────────────────────────────────────────────────────────
  if (mode === "login") {
    return (
      <div className="space-y-4">
        <form action={loginDispatch} className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo ?? "/dashboard"} />
          <div>
            <label htmlFor="email" className="block text-sm text-muted-foreground mb-1.5">
              Email address
            </label>
            <input
              id="email" name="email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" required autoComplete="email"
              className={inputClasses}
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="password" className="block text-sm text-muted-foreground">Password</label>
              <a href="/auth/reset-password" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Forgot password?
              </a>
            </div>
            <input
              id="password" name="password" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password" required autoComplete="current-password"
              className={inputClasses}
            />
          </div>
          <ErrorBanner error={loginState.error} />
          <SubmitButton label="Sign in" />
        </form>
        <div className="relative flex items-center gap-3 py-1">
          <div className="flex-1 border-t border-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 border-t border-border" />
        </div>
        <MagicLinkButton email={email} onEmailChange={setEmail} />
      </div>
    );
  }

  // ── Signup form ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <form action={signupDispatch} className="space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo ?? "/dashboard"} />
        <div>
          <label htmlFor="name" className="block text-sm text-muted-foreground mb-1.5">
            Full name <span className="text-pa-red">*</span>
          </label>
          <input
            id="name" name="fullName" type="text"
            placeholder="Your name" required minLength={2} autoComplete="name"
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor="email-signup" className="block text-sm text-muted-foreground mb-1.5">Email address</label>
          <input
            id="email-signup" name="email" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" required autoComplete="email"
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor="password-signup" className="block text-sm text-muted-foreground mb-1.5">Password</label>
          <input
            id="password-signup" name="password" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 characters" required minLength={8} autoComplete="new-password"
            className={inputClasses}
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
        <ErrorBanner error={signupState.error} />
        <SubmitButton label="Create account" />
      </form>
      <div className="relative flex items-center gap-3 py-1">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 border-t border-border" />
      </div>
      <MagicLinkButton email={email} onEmailChange={setEmail} />
    </div>
  );
}

// ── Magic link sub-component (JS-only convenience path) ─────────────────────
function MagicLinkButton({ email, onEmailChange }: { email: string; onEmailChange: (v: string) => void }) {
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const supabase              = createClient();

  async function sendMagicLink() {
    if (!email) { setError("Enter your email address above first."); return; }
    setLoading(true);
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (otpError) {
      const m = otpError.message.toLowerCase();
      if (m.includes("rate limit") || m.includes("too many") || m.includes("over_email_send_rate_limit")) {
        setError("Email sending limit reached. Please wait a few minutes and try again.");
      } else {
        setError(otpError.message);
      }
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-2">
      <input
        type="email" value={email} onChange={(e) => onEmailChange(e.target.value)}
        placeholder="Email for magic link" autoComplete="email"
        className={inputClasses}
      />
      {error && <p className="text-xs text-pa-red">{error}</p>}
      <button
        type="button" onClick={sendMagicLink} disabled={loading || sent}
        className="w-full border border-border text-foreground text-sm py-2.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
        {sent ? "Magic link sent — check your inbox" : loading ? "Sending…" : "Sign in with magic link"}
      </button>
    </div>
  );
}
