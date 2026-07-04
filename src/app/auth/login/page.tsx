import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const params = await searchParams;

  if (user) redirect(params.redirect ?? "/dashboard");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="text-primary font-mono font-bold text-xl tracking-tight">prime-atlas</span>
          </Link>
          <p className="text-muted-foreground text-sm mt-2">Sign in to your account</p>
        </div>

        {params.error && (
          <div className="mb-4 p-3 rounded-lg border border-pa-red/30 bg-pa-red/5 text-pa-red text-sm">
            {decodeURIComponent(params.error)}
          </div>
        )}

        <AuthForm mode="login" redirectTo={params.redirect} />

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="text-primary hover:underline">
            Get started free
          </Link>
        </p>
      </div>
    </div>
  );
}
