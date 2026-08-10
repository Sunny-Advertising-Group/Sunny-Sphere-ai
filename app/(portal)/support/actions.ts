"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function submitTicket(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Describe what's going on." };

  const { error } = await supabase.from("support_tickets").insert({
    raised_by: user.id,
    category: String(formData.get("category") ?? "").trim() || null,
    urgency: String(formData.get("urgency") ?? "").trim() || null,
    body,
  });
  if (error) return { error: error.message };

  revalidatePath("/support");
  return { success: true };
}
