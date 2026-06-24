import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * @supabase/ssr v0.3.0 storage adapter uses cookies.get / cookies.set / cookies.remove
 * (NOT getAll/setAll which were introduced in v0.4+).
 * Providing getAll/setAll causes getItem() to silently return undefined on every
 * session lookup → "Auth session missing!" on all server-side auth checks.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cookieStore.set(name, value, options as any);
          } catch {
            // Server Component context — cookies will be set by middleware response
          }
        },
        remove(name: string, options: Record<string, unknown>) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cookieStore.set(name, "", { ...(options as any), maxAge: 0 });
          } catch {
            // Server Component context — cookies will be cleared by middleware response
          }
        },
      },
    }
  );
}
