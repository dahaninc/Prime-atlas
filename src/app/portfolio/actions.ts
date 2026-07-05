"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addPortfolioAsset(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const municipalityId = String(formData.get("municipality_id") ?? "");
  const priceRaw = String(formData.get("purchase_price") ?? "").replace(/[^\d.]/g, "");
  const currency = String(formData.get("currency_code") ?? "USD");
  const purchaseDate = String(formData.get("purchase_date") ?? "");

  const { error } = await supabase.from("portfolio_assets").insert({
    user_id: user.id,
    name,
    municipality_id: municipalityId || null,
    address: String(formData.get("address") ?? "").trim() || null,
    purchase_price: priceRaw ? Math.round(parseFloat(priceRaw) * 100) : null,
    currency_code: currency === "GBP" ? "GBP" : "USD",
    purchase_date: purchaseDate || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) console.error("[addPortfolioAsset]", error.message);
  revalidatePath("/portfolio");
}

export async function removePortfolioAsset(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // Scope to the caller even though RLS already enforces it — defense-in-depth.
  const { error } = await supabase
    .from("portfolio_assets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) console.error("[removePortfolioAsset]", error.message);
  revalidatePath("/portfolio");
}
