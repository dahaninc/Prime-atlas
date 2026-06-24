"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AuthFormProps {
  mode: "login" | "signup";
  redirectTo?: string;
}

/** Maps a raw Supabase/GoTrue error message to a user-friendly string */
function parseAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid email or password") || m.includes("invalid credentials")) {
    return "Incorrect email or password. Please try again.";
  }
  if (m.includes("email not confirmed") || m.includes("not confirmed")) {
    return "EMAIL_NOT_CONFIRMED";
  }
  if (m.includes("rate limit") || m.includes("email rate") || m.includes("too many") || m.includes("429") || m.includes("over_email_send_rate_limit")) {
    return "RATE_LIMITED";
  }
  if (m.includes("user already registered") || m.includes("already registered") || m.includes("already exists")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (m.includes("password should") || m.includes("password must") || m.includes("weak password")) {
    return "Password must be at least 8 characters and include a mix of letters and numbers.";
  }
  if (m.includes("network") || m.includes("fetch") || m.includes("failed to fetch")) {
    return "Network error — check your connection and try again.";
  }
  return message;
}

export function AuthForm({ mode, redirectTo }: AuthFormProps) {
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [name, setName]                 = useState("");
  const [error, setError]               = useState<string | null>(null);
  const [infoMessage, setInfoMessage]   = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [loading, setLoading]           = useState(false);

  const supabase = createClient();

  // ── Password strength meter ──────────────────────────────────────────────
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

  // ── Login handler ────────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        const parsed = parseAuthError(authError.message);
        if (parsed === "EMAIL_NOT_CONFIRMED") {
          setInfoMessage("Your email isn't confirmed yet. Check your inbox for the confirmation link.");
          setLoading(false);
          return;
        }
        if (parsed === "RATE_LIMITED") {
          setInfoMessage("Too many attempts. Please wait a few minutes before trying again.");
          setLoading(false);
          return;
        }
        setError(parsed);
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError("Sign-in completed but no user was returned. Please try again.");
        setLoading(false);
        return;
      }

      // Hard-navigate so the server picks up the new session cookie
      window.location.href = redirectTo ?? "/dashboard";
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(parseAuthError(message));
      setLoading(false);
    }
  }

  // ── Signup handler ───────────────────────────────────────────────────────
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        const parsed = parseAuthError(authError.message);
        if (parsed === "RATE_LIMITED") {
          setInfoMessage(
            "Your account may have been created, but the confirmation email couldn't be sent right now " +
            "due to a sending limit. Try signing in — if that fails, use 'Forgot password' in a few minutes."
          );
          setLoading(false);
          return;
        }
        setError(parsed);
        setLoading(false);
        return;
      }

      setSignupSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(parseAuthError(message));
    } finally {
      setLoading(false);
    }
  }

  // ── Signup success state ─────────────────────────────────────────────────
  if (signupSuccess) {
    return (
      <div className="p-5 rounded-lg border border-pa-green/30 bg-pa-green/5 text-center">
        <div className="w-10 h-10 rounded-full bg-pa-green/10 border border-pa-green/30 flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-pa-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-medium text-foreground mb-1">Check your inbox</p>
        <p className="text-xs text-muted-foreground">
          We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
        </p>
      </div>
    );
  }

  const InfoBanner = infoMessage ? (
    <div className="p-3 rounded-lg border border-pa-amber/30 bg-pa-amber/5 text-pa-amber text-sm">
      {infoMessage}
    </div>
  ) : null;

  const ErrorBanner = error ? (
    <div className="p-3 rounded-lg border border-pa-red/30 bg-pa-red/5 text-pa-red text-sm">
      {error}
    </div>
  ) : null;

  // ── Login form ───────────────────────────────────────────────────────────
  if (mode === "login") {
    return (
      <div className="space-y-4">
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-muted-foreground mb-1.5">
              Email address
            </label>
            <input
              id="email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" required autoComplete="email"
              className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pa-green/50 focus:border-pa-green/50 transition-colors"
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
              id="password" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password" required autoComplete="current-password"
              className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pa-green/50 focus:border-pa-green/50 transition-colors"
            />
          </div>
          {InfoBanner}
          {ErrorBanner}
          <button type="submit" disabled={loading}
            className="w-full bg-pa-green text-pa-navy font-semibold py-2.5 rounded-lg hover:bg-pa-green/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {loading && <span className="w-4 h-4 border-2 border-pa-navy border-t-transparent rounded-full animate-spin" />}
            Sign in
          </button>
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
    <form onSubmit={handleSignup} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm text-muted-foreground mb-1.5">
          Full name <span className="text-pa-red">*</span>
        </label>
        <input
          id="name" type="text" value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name" required minLength={2} autoComplete="name"
          className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pa-green/50 focus:border-pa-green/50 transition-colors"
        />
      </div>
      <div>
        <label htmlFor="email-signup" className="block text-sm text-muted-foreground mb-1.5">Email address</label>
        <input
          id="email-signup" type="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com" required autoComplete="email"
          className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pa-green/50 focus:border-pa-green/50 transition-colors"
        />
      </div>
      <div>
        <label htmlFor="password-signup" className="block text-sm text-muted-foreground mb-1.5">Password</label>
        <input
          id="password-signup" type="password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 8 characters" required minLength={8} autoComplete="new-password"
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
      {InfoBanner}
      {ErrorBanner}
      <button type="submit" disabled={loading}
        className="w-full bg-pa-green text-pa-navy font-semibold py-2.5 rounded-lg hover:bg-pa-green/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        {loading && <span className="w-4 h-4 border-2 border-pa-navy border-t-transparent rounded-full animate-spin" />}
        Create account
      </button>
      <div className="relative flex items-center gap-3 py-1">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 border-t border-border" />
      </div>
      <MagicLinkButton email={email} onEmailChange={setEmail} />
    </form>
  );
}

// ── Magic link sub-component ─────────────────────────────────────────────────
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
        className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pa-green/50 focus:border-pa-green/50 transition-colors"
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
