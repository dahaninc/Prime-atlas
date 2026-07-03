import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient as createSsrClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Dashboard | Prime Atlas",
};

const ADMIN_EMAILS = ["admin@prime-atlas.io"];

const TIER_COLORS: Record<string, string> = {
  institutional: "text-green-700 bg-green-50 border-green-200",
  analyst:       "text-blue-700 bg-blue-50 border-blue-200",
  explorer:      "text-purple-700 bg-purple-50 border-purple-200",
  free:          "text-gray-500 bg-gray-50 border-gray-200",
};

export default async function AdminDashboardPage() {
  // ── Auth gate ──────────────────────────────────────────────────
  const ssrClient = await createSsrClient();
  const { data: { user } } = await ssrClient.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email ?? "")) redirect("/auth/login");

  // ── Service-role client ────────────────────────────────────────
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // ── Fetch all users via auth admin API ─────────────────────────
  const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 500 });
  const authUsers = authData?.users ?? [];

  // ── Fetch all profiles ─────────────────────────────────────────
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, subscription_tier, created_at, alert_preferences");

  const profileMap = Object.fromEntries(
    (profiles ?? []).map(p => [p.id, p])
  );

  // ── Join ───────────────────────────────────────────────────────
  const users = authUsers.map(u => ({
    id:         u.id,
    email:      u.email ?? "—",
    created_at: u.created_at,
    last_sign_in: u.last_sign_in_at ?? null,
    confirmed:  !!u.email_confirmed_at,
    tier:       (profileMap[u.id]?.subscription_tier as string) ?? "free",
  })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // ── Stats ──────────────────────────────────────────────────────
  const totalUsers    = users.length;
  const members       = users.filter(u => u.tier !== "free").length;
  const confirmed     = users.filter(u => u.confirmed).length;
  const institutional = users.filter(u => u.tier === "institutional").length;
  const analyst       = users.filter(u => u.tier === "analyst").length;
  const explorer      = users.filter(u => u.tier === "explorer").length;

  function fmt(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric"
    });
  }

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-gray-200">

      {/* Nav */}
      <nav className="border-b border-[#1E2D40] bg-[#0B0F1A]/95 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-mono text-xs text-[#4A9EFF] tracking-widest uppercase font-bold">
              PRIME ATLAS
            </Link>
            <span className="text-[#1E2D40]">|</span>
            <span className="text-xs text-gray-400 font-mono uppercase tracking-widest">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin/scrapers" className="text-xs text-gray-400 hover:text-[#4A9EFF] transition-colors">
              Scraper Health →
            </Link>
            <span className="text-[9px] text-gray-600 font-mono">{user.email}</span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <p className="font-mono text-xs text-[#4A9EFF] tracking-widest uppercase mb-2">
            Prime Atlas · Admin Dashboard
          </p>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
          {[
            { label: "Total users",    value: totalUsers,    color: "text-white" },
            { label: "Email confirmed",value: confirmed,     color: "text-[#4A9EFF]" },
            { label: "Members (paid)", value: members,       color: "text-emerald-400" },
            { label: "Institutional",  value: institutional, color: "text-emerald-400" },
            { label: "Analyst",        value: analyst,       color: "text-blue-400" },
            { label: "Explorer",       value: explorer,      color: "text-purple-400" },
          ].map(s => (
            <div key={s.label} className="border border-[#1E2D40] rounded-xl p-4 bg-[#0D1221] text-center">
              <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
              <p className="text-[9px] text-gray-500 mt-1 uppercase tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>

        {/* User table */}
        <div className="border border-[#1E2D40] rounded-xl overflow-hidden">

          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-4 py-3 border-b border-[#1E2D40] bg-[#0D1221]">
            {["Email", "Tier", "Joined", "Last sign-in", "Status"].map(h => (
              <span key={h} className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{h}</span>
            ))}
          </div>

          {/* Rows */}
          {users.map((u, i) => (
            <div
              key={u.id}
              className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-4 py-3 border-b border-[#1A2535] items-center ${
                i % 2 === 0 ? "bg-[#0B0F1A]" : "bg-[#0D1221]/50"
              }`}
            >
              {/* Email */}
              <div>
                <p className="text-sm text-white font-mono">{u.email}</p>
                <p className="text-[9px] text-gray-600 mt-0.5 font-mono">{u.id.slice(0, 8)}…</p>
              </div>

              {/* Tier badge */}
              <div>
                <span className={`text-[9px] font-bold border rounded px-2 py-0.5 uppercase tracking-wider ${TIER_COLORS[u.tier] ?? TIER_COLORS.free}`}>
                  {u.tier}
                </span>
              </div>

              {/* Joined */}
              <span className="text-xs text-gray-400 font-mono">{fmt(u.created_at)}</span>

              {/* Last sign-in */}
              <span className="text-xs text-gray-400 font-mono">{fmt(u.last_sign_in)}</span>

              {/* Status */}
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${u.confirmed ? "bg-emerald-400" : "bg-amber-400"}`} />
                <span className="text-[10px] text-gray-500">{u.confirmed ? "Confirmed" : "Pending"}</span>
              </div>
            </div>
          ))}

          {users.length === 0 && (
            <div className="px-4 py-10 text-center text-gray-500 text-sm">No users found</div>
          )}
        </div>

        {/* Tier upgrade note */}
        <div className="mt-6 border border-[#1E2D40] rounded-xl p-4 bg-[#0D1221]">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
            To change a user&apos;s subscription tier
          </p>
          <p className="text-xs text-gray-400 font-mono">
            UPDATE profiles SET subscription_tier = &apos;institutional&apos; WHERE id = &apos;&lt;user-id&gt;&apos;;
          </p>
          <p className="text-[10px] text-gray-600 mt-2">
            Valid tiers: <span className="text-emerald-400">institutional</span> · <span className="text-blue-400">analyst</span> · <span className="text-purple-400">explorer</span> · <span className="text-gray-400">free</span>
          </p>
        </div>

      </main>
    </div>
  );
}
