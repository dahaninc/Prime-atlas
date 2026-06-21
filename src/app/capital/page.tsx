import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { createClient } from "@/lib/supabase/server";
import { CapitalClient } from "./CapitalClient";

export const metadata: Metadata = {
  title: "prime-atlas Capital | Deal Introductions — Spain Property Investment",
  description:
    "Qualified investors gain access to off-market opportunities in Spain — residential, commercial, and development. Introduced by prime-atlas Capital.",
};

export default async function CapitalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <>
      <Navbar user={user} />
      <CapitalClient />
      <Footer />
    </>
  );
}
