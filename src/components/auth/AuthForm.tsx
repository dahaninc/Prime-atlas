"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface AuthFormProps {
  mode: "login" | "signup";
  redirectTo?: string;
}

export function AuthForm({ mode, redirectTo }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setSuccess("Check your email for a confirmation link.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = redirectTo ?? "/dashboard";
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(
        message.includes("Invalid login") ? "Invalid email or password." :
        message.includes("Email not confirmed") ? "Please confirm your email first." :
        message.includes("already registered") ? "An account with this email already exists." :
        message.includes("Password should") ? "Password must be at least 6 characters." :
        message
      );
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="p-5 rounded-lg border border-pa-green/30 bg-pa-green/5 text-center">
        <div className="w-10 h-10 rounded-full bg-pa-green/10 border border-pa-green/30 flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-pa-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-medium text-foreground mb-1">Check your inbox</p>
        <p className="text-xs text-muted-foreground">{success}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === "signup" && (
        <div>
          <label htmlFor="name" className="block text-sm text-muted-foreground mb-1.5">
            Full name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pa-green/50 focus:border-pa-green/50 transition-colors"
          />
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm text-muted-foreground mb-1.5">
          Email address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
          {mode === "login" && (
            <a href="/auth/reset-password" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Forgot password?
            </a>
          )}
        </div>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
          required
          minLength={6}
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
        disabled={loading}
        className="w-full bg-pa-green text-pa-navy font-semibold py-2.5 rounded-lg hover:bg-pa-green/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading && (
          <span className="w-4 h-4 border-2 border-pa-navy border-t-transparent rounded-full animate-spin" />
        )}
        {mode === "login" ? "Sign in" : "Create account"}
      </button>

      {/* Divider */}
      <div className="relative flex items-center gap-3 py-1">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Magic link */}
      <MagicLinkButton email={email} />
    </form>
  );
}

function MagicLinkButton({ email }: { email: string }) {
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
    <button
      type="button"
      onClick={sendMagicLink}
      disabled={loading || sent}
      className="w-full border border-border text-foreground text-sm py-2.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {sent ? "Magic link sent — check your inbox" : loading ? "Sending…" : "Sign in with magic link"}
    </button>
  );
}
