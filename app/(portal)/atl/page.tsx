import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { AtlHub, type LinkRow } from "./AtlHub";

export default async function AtlPage() {
  const visibility = await getVisibility();
  if (!visibility || !visibility.canSee("atl")) redirect("/");

  const supabase = await createClient();
  const [{ data: clients }, { data: rawLinks }] = await Promise.all([
    supabase.from("clients").select("id, name, colour, team, is_active").order("name"),
    supabase
      .from("atl_links")
      .select("id, kind, title, url, version_label, client:clients(name, colour)")
      .order("sort_order"),
  ]);

  const links: LinkRow[] = (rawLinks ?? [])
    .filter((l) => l.client)
    .map((l) => ({
      id: l.id,
      kind: l.kind,
      title: l.title,
      url: l.url,
      version_label: l.version_label,
      client_name: (l.client as unknown as { name: string; colour: string | null }).name,
      client_colour: (l.client as unknown as { name: string; colour: string | null }).colour,
    }));

  return (
    <div>
      <PageHeader
        title="ATL"
        description="Flight plans, WIPs, rate cards, budgets, assets and reporting — by client or by category."
      />
      <AtlHub clients={clients ?? []} links={links} />
    </div>
  );
}
