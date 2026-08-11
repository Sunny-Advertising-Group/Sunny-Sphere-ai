"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function submitAiRequest(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const task = String(formData.get("task") ?? "").trim();
  if (!task) return { error: "Describe the task you'd like AI'd." };

  const { error } = await supabase.from("ai_requests").insert({
    submitted_by: user.id,
    task,
    frequency: String(formData.get("frequency") ?? "").trim() || null,
    hours_estimate: String(formData.get("hours_estimate") ?? "").trim() || null,
    clients_affected: String(formData.get("clients_affected") ?? "").trim() || null,
    ideal_outcome: String(formData.get("ideal_outcome") ?? "").trim() || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/could-this-be-aid");
  return { success: true };
}
