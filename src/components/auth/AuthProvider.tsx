"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * AuthProvider — mounts once at the root layout.
 *
 * Subscribes to Supabase onAuthStateChange and keeps the Next.js router in
 * sync with the server-side session:
 *
 *  SIGNED_IN        → router.refresh() so Server Components re-fetch with the
 *                      new session cookie. No redirect — the user is already on
 *                      the right page after the hard-navigate in AuthForm.
 *
 *  SIGNED_OUT       → push to /auth/login and refresh so server clears
 *                      protected-route caches.
 *
 *  PASSWORD_RECOVERY → push to /auth/update-password so the user can set a
 *                      new password while their recovery session is active.
 *
 *  TOKEN_REFRESHED  → router.refresh() so any Server Components holding the
 *                      old access token re-fetch with the rotated one.
 *
 *  USER_UPDATED     → router.refresh() to re-render profile-dependent UI.
 *
 * This component renders no UI — it only manages side-effects.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router  = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      switch (event) {
        case "SIGNED_IN":
          // Refresh Server Components so they pick up the new cookie.
          // AuthForm already hard-navigates to /dashboard; this handles any
          // edge case where the session is restored from a stored cookie.
          router.refresh();
          break;

        case "SIGNED_OUT":
          router.push("/auth/login");
          router.refresh();
          break;

        case "PASSWORD_RECOVERY":
          // Supabase fires this when a recovery link is followed.
          // The session is set client-side; redirect to the update form.
          router.push("/auth/update-password");
          break;

        case "TOKEN_REFRESHED":
          // Access token silently rotated — refresh server state.
          router.refresh();
          break;

        case "USER_UPDATED":
          router.refresh();
          break;

        default:
          break;
      }

      // Suppress unused-variable lint warning; session is intentionally
      // available for future use (e.g. logging, analytics).
      void session;
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  return <>{children}</>;
}
