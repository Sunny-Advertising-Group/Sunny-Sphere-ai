import { notFound, redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { kindLabel } from "@/lib/atl";
import { Link2, Radio } from "lucide-react";
import { Card, EmptyState, PageHeader, Pill } from "@/components/ui";

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
      .select("id, kind, title, url, version_label")
      .eq("client_id", client.id)
      .order("sort_order"),
    supabase
      .from("live_material")
      .select("id, partner, channel, asset_name, status, due_date, synced_at")
      .eq("client_id", client.id)
      .order("due_date"),
  ]);

  const grouped = (links ?? []).reduce<Record<string, typeof links>>((acc, link) => {
    (acc[link.kind] ??= []).push(link);
    return acc;
  }, {});

  const latestSync = (liveMaterial ?? []).find((m) => m.synced_at)?.synced_at;

  return (
    <div>
      <PageHeader
        title={client.name}
        description={!client.is_active ? "Inactive client" : "Drive links only — the master files live in Drive, not here."}
        backHref="/atl"
        backLabel="Back to ATL"
      />

      <div className="space-y-8 p-8">
        <div>
          <h2 className="mb-3 text-sm font-bold text-ink">Links</h2>
          {Object.keys(grouped).length === 0 ? (
            <EmptyState icon={Link2} title="No links yet" description="Admins can add flight plans, WIPs, rate cards and more above." />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(grouped).map(([kind, kindLinks]) => (
                <Card key={kind}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold">
                    {kindLabel(kind)}
                  </div>
                  <ul className="space-y-2">
                    {kindLinks!.map((link) => (
                      <li key={link.id}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-ink underline-offset-2 hover:text-gold hover:underline"
                        >
                          {link.title}
                        </a>
                        {link.version_label && (
                          <span className="ml-2 text-xs text-charcoal">{link.version_label}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-bold text-ink">Live material</h2>
            {latestSync ? (
              <Pill tone="muted">Last synced {new Date(latestSync).toLocaleString()}</Pill>
            ) : (
              <Pill tone="muted">Sync not yet configured</Pill>
            )}
          </div>
          {!liveMaterial || liveMaterial.length === 0 ? (
            <EmptyState
              icon={Radio}
              title="No live material data"
              description="The hourly sync from the LIVE MATERIAL sheet hasn't been switched on yet — this is a mirror, never the source of truth."
            />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-c text-left text-xs uppercase text-charcoal">
                    <th className="px-4 py-3">Partner</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Asset</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {liveMaterial.map((row) => (
                    <tr key={row.id} className="border-b border-border-c last:border-0">
                      <td className="px-4 py-3">{row.partner}</td>
                      <td className="px-4 py-3">{row.channel}</td>
                      <td className="px-4 py-3">{row.asset_name}</td>
                      <td className="px-4 py-3">{row.status}</td>
                      <td className="px-4 py-3">{row.due_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
