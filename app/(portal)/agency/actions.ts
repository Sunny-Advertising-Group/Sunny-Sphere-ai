"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Monthly Wraps are admin-only to publish — enforced here and, as the real
// boundary, by the monthly_wraps RLS policies (is_admin()).
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  return { supabase, user, isAdmin: !!isAdmin };
}

// The file itself is uploaded straight from the browser to Supabase Storage
// (see UploadWrapForm) — routing it through this Server Action instead would
// hit Vercel's ~4.5MB hard cap on a serverless function's request body,
// which no next.config.ts setting can raise. This action only ever receives
// the resulting storage path plus the small text fields, so it's nowhere
// near that limit.
export async function finalizeMonthlyWrapUpload(month: string, title: string, filePath: string) {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) return { error: "Not authorized." };

  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Choose a month." };
  if (!filePath) return { error: "Missing uploaded file." };

  const wrapMonth = `${month}-01`;
  const { error } = await supabase
    .from("monthly_wraps")
    .upsert(
      { wrap_month: wrapMonth, title: title.trim() || null, file_path: filePath, uploaded_by: user.id },
      { onConflict: "wrap_month" },
    );
  if (error) return { error: error.message };

  revalidatePath("/agency/monthly-wraps");
  return { success: true };
}

export async function deleteMonthlyWrap(id: number) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Not authorized." };

  const { data: wrap } = await supabase.from("monthly_wraps").select("file_path").eq("id", id).single();
  if (wrap?.file_path) await supabase.storage.from("monthly_wraps").remove([wrap.file_path]);

  const { error } = await supabase.from("monthly_wraps").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/agency/monthly-wraps");
  return { success: true };
}
