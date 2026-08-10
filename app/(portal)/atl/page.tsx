import Link from "next/link";
import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { AddClientForm } from "./AddClientForm";

export default async function AtlPage() {
  const visibility = await getVisibility();
  if (!visibility || !visibility.canSee("atl")) redirect("/");

  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, colour, is_active")
    .order("name");

  return (
    <div>
      <PageHeader
        title="ATL"
        description="Flight plans, WIPs, rate cards, budgets, assets and reporting — one client at a time."
        action={visibility.isAdmin ? <AddClientForm /> : undefined}
      />

      <div className="p-8">
        {!clients || clients.length === 0 ? (
          <EmptyState icon="📊" title="No clients yet" description="Add a client to start linking their ATL material." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => (
              <Link key={client.id} href={`/atl/${encodeURIComponent(client.name)}`}>
                <Card className="flex items-center gap-3 transition-colors hover:border-gold/50">
                  <span
                    className="h-3 w-3 flex-none rounded-full"
                    style={{ background: client.colour || "#FDB600" }}
                  />
                  <div>
                    <div className="font-semibold text-ink">{client.name}</div>
                    {!client.is_active && <div className="text-xs text-charcoal">Inactive</div>}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
