import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { LinkButton, PageHeader } from "@/components/ui";
import { ToolsBrowser } from "./ToolsBrowser";

export default async function ToolsPage() {
  const visibility = await getVisibility();
  if (!visibility) redirect("/login");

  const supabase = await createClient();
  const { data: tools } = await supabase
    .from("tools")
    .select("id, name, tool_type, category, description, how_to_use, link_url, file_path, status, use_count, owner_id")
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="Tools"
        description="Find the right AI tool — all your favourite tools and templates in one place."
        action={<LinkButton href="/tools/upload">+ Submit a tool</LinkButton>}
      />
      <ToolsBrowser tools={tools ?? []} />
    </div>
  );
}
