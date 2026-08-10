"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function submitTip(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Say something!" };

  const isPrompt = formData.get("is_prompt") === "true";
  const title = String(formData.get("title") ?? "").trim();
  if (isPrompt && !title) return { error: "Prompts need a title." };

  const { error } = await supabase.from("tips").insert({
    author_id: user.id,
    category: String(formData.get("category") ?? "").trim() || null,
    body,
    is_prompt: isPrompt,
    title: isPrompt ? title : null,
  });
  if (error) return { error: error.message };

  revalidatePath("/tips");
  return { success: true };
}
