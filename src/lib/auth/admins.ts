/**
 * Single source of truth for admin access.
 * Set ADMIN_EMAILS in Vercel/`.env.local` as a comma-separated list to
 * override the defaults without a deploy-time code change.
 */
const DEFAULT_ADMIN_EMAILS = ["alpha.richie@outlook.com", "admin@prime-atlas.io"];

export function getAdminEmails(): string[] {
  const fromEnv = process.env.ADMIN_EMAILS;
  if (!fromEnv) return DEFAULT_ADMIN_EMAILS;
  return fromEnv
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}
