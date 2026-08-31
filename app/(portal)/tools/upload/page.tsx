import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { UploadToolForm } from "./UploadToolForm";

export default async function UploadToolPage() {
  const visibility = await getVisibility();
  if (!visibility) redirect("/login");

  const supabase = await createClient();
  const { data: categories } = await supabase.from("tool_categories").select("id, name").order("name");

  return <UploadToolForm categories={categories ?? []} />;
}
