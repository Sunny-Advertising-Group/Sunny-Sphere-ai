"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Monthly Wraps are Lily's alone to publish — enforced here and, as the real
// boundary, by the monthly_wraps RLS policies (is_monthly_wraps_owner()).
const WRAPS_OWNER_EMAIL = "lily@sunnyadvertising.com.au";

export async function uploadMonthlyWrap(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== WRAPS_OWNER_EMAIL) return { error: "Not authorized." };

  const month = String(formData.get("month") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const file = formData.get("file");

  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Choose a month." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an HTML file to upload." };
  if (!/\.html?$/i.test(file.name)) return { error: "Only .html files are supported." };

  const wrapMonth = `${month}-01`;
  const path = `${crypto.randomUUID()}/${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("monthly_wraps")
    .upload(path, file, { contentType: "text/html" });
  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  const { error } = await supabase
    .from("monthly_wraps")
    .upsert(
      { wrap_month: wrapMonth, title: title || null, file_path: path, uploaded_by: user.id },
      { onConflict: "wrap_month" },
    );
  if (error) return { error: error.message };

  revalidatePath("/agency/monthly-wraps");
  redirect("/agency/monthly-wraps");
}

export async function deleteMonthlyWrap(id: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== WRAPS_OWNER_EMAIL) return { error: "Not authorized." };

  const { data: wrap } = await supabase.from("monthly_wraps").select("file_path").eq("id", id).single();
  if (wrap?.file_path) await supabase.storage.from("monthly_wraps").remove([wrap.file_path]);

  const { error } = await supabase.from("monthly_wraps").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/agency/monthly-wraps");
  return { success: true };
}
