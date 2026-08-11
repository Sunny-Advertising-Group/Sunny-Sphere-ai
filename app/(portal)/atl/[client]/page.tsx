import { notFound, redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { AtlClientTabs } from "./AtlClientTabs";

export default async function AtlClientPage({ params }: { params: Promise<{ client: string }> }) {
  const { client: rawClient } = await params;
  const visibility = await getVisibility();
  if (!visibility || !visibility.canSee("atl")) redirect("/");

  const clientName = decodeURIComponent(rawClient);
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, colour, wip_doc_url, wip_cadence, is_active")
    .eq("name", clientName)
    .single();

  if (!client) notFound();

  const [{ data: links }, { data: liveMaterial }] = await Promise.all([
    supabase
      .from("atl_links")
      .select("id, kind, title, url, version_label, cadence, drive_modified_at, drive_modified_by")
      .eq("client_id", client.id)
      .order("sort_order"),
    supabase
      .from("live_material")
      .select("id, partner, channel, asset_name, status, due_date, synced_at, source_kind")
      .eq("client_id", client.id)
      .order("due_date"),
  ]);

  return (
    <div>
      <PageHeader
        title={client.name}
        description={!client.is_active ? "Inactive client" : "Drive links only — the master files live in Drive, not here."}
        backHref="/atl"
        backLabel="Back to ATL"
      />

      <div className="p-8">
        <AtlClientTabs links={links ?? []} liveMaterial={liveMaterial ?? []} />
      </div>
    </div>
  );
}
