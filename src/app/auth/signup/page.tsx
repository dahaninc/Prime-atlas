import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="text-primary font-mono font-bold text-xl tracking-tight">prime-atlas</span>
          </Link>
          <p className="text-muted-foreground text-sm mt-2">
            Find Tomorrow&apos;s Winners Before Everyone Else
          </p>
        </div>

        {/* Value prop chips */}
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {["Free forever", "No card required", "USA + UK Intelligence"].map((t) => (
            <span key={t} className="text-xs border border-border rounded-full px-3 py-1 text-muted-foreground">
              {t}
            </span>
          ))}
        </div>

        <AuthForm mode="signup" />

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>

        <p className="text-center text-xs text-muted-foreground mt-4">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="hover:underline">Terms</Link>{" "}
          and{" "}
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
