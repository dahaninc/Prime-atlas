"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AuthFormProps {
  mode: "login" | "signup";
  redirectTo?: string;
}

export function AuthForm({ mode, redirectTo }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState<string | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);

  const supabase = createClient();

  // Password strength (used for signup UX)
  const pwStrength = (() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  })();
  const pwLabel = ["", "Weak", "Weak", "Fair", "Strong", "Very strong"][pwStrength];
  const pwColor = ["", "bg-pa-red", "bg-pa-red", "bg-pa-amber", "bg-pa-green", "bg-pa-green"][pwStrength];

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSignupLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setSignupSuccess("Check your email for a confirmation link.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(
        message.includes("already registered") ? "An account with this email already exists." :
        message.includes("Password should") ? "Password must be at least 6 characters." :
        message
      );
    } finally {
      setSignupLoading(false);
    }
  }

  if (signupSuccess) {
    return (
      <div className="p-5 rounded-lg border border-pa-green/30 bg-pa-green/5 text-center">
        <div className="w-10 h-10 rounded-full bg-pa-green/10 border border-pa-green/30 flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-pa-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-medium text-foreground mb-1">Check your inbox</p>
        <p className="text-xs text-muted-foreground">{signupSuccess}</p>
      </div>
    );
  }

  // ── LOGIN — native POST form → /api/auth/signin ───────────────────────────
  // The browser submits, the server sets cookies on the redirect response,
  // and the browser stores them before following the redirect. No JS cookie magic.
  if (mode === "login") {
    return (
      <div className="space-y-4">
        <form method="POST" action="/api/auth/signin" className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo ?? "/dashboard"} />

          <div>
            <label htmlFor="email" className="block text-sm text-muted-foreground mb-1.5">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pa-green/50 focus:border-pa-green/50 transition-colors"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="password" className="block text-sm text-muted-foreground">
                Password
              </label>
              <a href="/auth/reset-password" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Forgot password?
              </a>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Your password"
              required
              className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pa-green/50 focus:border-pa-green/50 transition-colors"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-pa-green text-pa-navy font-semibold py-2.5 rounded-lg hover:bg-pa-green/90 transition-colors"
          >
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

  // ── SIGNUP — client-side ──────────────────────────────────────────────────
  return (
    <form onSubmit={handleSignup} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm text-muted-foreground mb-1.5">
          Full name <span className="text-pa-red">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          required
          minLength={2}
          className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pa-green/50 focus:border-pa-green/50 transition-colors"
        />
      </div>

      <div>
        <label htmlFor="email-signup" className="block text-sm text-muted-foreground mb-1.5">
          Email address
        </label>
        <input
          id="email-signup"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pa-green/50 focus:border-pa-green/50 transition-colors"
        />
      </div>

      <div>
        <label htmlFor="password-signup" className="block text-sm text-muted-foreground mb-1.5">
          Password
        </label>
        <input
          id="password-signup"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 8 characters"
          required
          minLength={8}
          className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pa-green/50 focus:border-pa-green/50 transition-colors"
        />
        {password.length > 0 && (
          <div className="mt-2">
            <div className="flex gap-1 mb-1">
              {[1,2,3,4,5].map((s) => (
                <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= pwStrength ? pwColor : "bg-secondary"}`} />
              ))}
            </div>
            <p className={`text-xs ${pwStrength <= 2 ? "text-pa-red" : pwStrength === 3 ? "text-pa-amber" : "text-pa-green"}`}>
              {pwLabel}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-pa-red/30 bg-pa-red/5 text-pa-red text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={signupLoading}
        className="w-full bg-pa-green text-pa-navy font-semibold py-2.5 rounded-lg hover:bg-pa-green/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {signupLoading && (
          <span className="w-4 h-4 border-2 border-pa-navy border-t-transparent rounded-full animate-spin" />
        )}
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

function MagicLinkButton({ email, onEmailChange }: { email: string; onEmailChange: (v: string) => void }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function sendMagicLink() {
    if (!email) { alert("Enter your email address first."); return; }
    setLoading(true);
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="space-y-2">
      {/* Show email input for magic link if login form (uncontrolled) */}
      <input
        type="email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        placeholder="Email for magic link"
        className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pa-green/50 focus:border-pa-green/50 transition-colors"
      />
      <button
        type="button"
        onClick={sendMagicLink}
        disabled={loading || sent}
        className="w-full border border-border text-foreground text-sm py-2.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {sent ? "Magic link sent — check your inbox" : loading ? "Sending…" : "Sign in with magic link"}
      </button>
    </div>
  );
}
