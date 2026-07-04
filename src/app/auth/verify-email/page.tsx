import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Verify your email | prime-atlas" };

/**
 * /auth/verify-email
 *
 * Shown when a user has signed up but has not yet confirmed their email.
 * Reachable via:
 *  - Redirect from protected routes when email_confirmed_at is null
 *  - Direct link in the signup success screen
 */
export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  const email = searchParams?.email ?? "";

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-primary font-mono font-bold text-xl tracking-tight">
            prime-atlas
          </Link>
        </div>

        <div className="border border-border rounded-2xl bg-card p-8 text-center">
          {/* Email icon */}
          <div className="w-14 h-14 rounded-full bg-pa-green/10 border border-pa-green/30 flex items-center justify-center mx-auto mb-5">
            <svg
              className="w-7 h-7 text-pa-green"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>

          <h1 className="text-xl font-bold mb-2">Verify your email</h1>
          <p className="text-sm text-muted-foreground mb-1">
            We sent a confirmation link to
          </p>
          {email ? (
            <p className="text-sm font-medium text-foreground mb-4">{email}</p>
          ) : (
            <p className="text-sm text-muted-foreground mb-4">your email address.</p>
          )}
          <p className="text-xs text-muted-foreground mb-6">
            Click the link in that email to activate your account. Check your spam folder if you
            don&apos;t see it within a few minutes.
          </p>

          <div className="space-y-3">
            <Link
              href="/auth/login"
              className="block w-full text-center bg-primary text-white font-semibold py-2.5 rounded-lg hover:bg-primary/85 transition-colors text-sm"
            >
              Back to sign in
            </Link>
            <Link
              href="/auth/reset-password"
              className="block w-full text-center border border-border text-foreground py-2.5 rounded-lg hover:bg-secondary transition-colors text-sm"
            >
              Resend via password reset
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
