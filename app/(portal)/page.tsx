import Link from "next/link";
import { Sun } from "lucide-react";
import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { Card, Pill } from "@/components/ui";

export default async function DashboardPage() {
  const visibility = await getVisibility();
  if (!visibility) redirect("/login");
  const { profile, isAdmin, canSee } = visibility;

  const supabase = await createClient();

  const [{ count: publishedTools }, { count: myRequests }, { count: recentTips }] = await Promise.all([
    supabase.from("tools").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("ai_requests").select("id", { count: "exact", head: true }).eq("submitted_by", profile.id),
    supabase.from("tips").select("id", { count: "exact", head: true }),
  ]);

  let pendingTools = 0;
  let openTickets = 0;
  let newAiRequests = 0;
  if (isAdmin) {
    const [{ count: pt }, { count: ot }, { count: nar }] = await Promise.all([
      supabase.from("tools").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("ai_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
    ]);
    pendingTools = pt ?? 0;
    openTickets = ot ?? 0;
    newAiRequests = nar ?? 0;
  }

  const tiles = [
    {
      href: "/tools",
      label: "Tools",
      value: publishedTools ?? 0,
      hint: "published tools",
      show: true,
    },
    {
      href: "/could-this-be-aid",
      label: "Could this be AI'd?",
      value: myRequests ?? 0,
      hint: "your submissions",
      show: true,
    },
    {
      href: "/tips",
      label: "Tips & Prompts",
      value: recentTips ?? 0,
      hint: "shared so far",
      show: true,
    },
    {
      href: "/atl",
      label: "ATL",
      value: "→",
      hint: "clients & live material",
      show: canSee("atl"),
    },
  ];

  return (
    <div>
      <div className="border-b border-border-c bg-white px-8 py-10">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-ink">
          Welcome back, {profile.full_name?.split(" ")[0] || profile.email.split("@")[0]}
          <Sun className="h-7 w-7 text-gold" strokeWidth={2} aria-hidden />
        </h1>
        <p className="mt-1 text-sm text-charcoal">Here&rsquo;s what&rsquo;s happening in Sunny Sphere.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 p-8 sm:grid-cols-2 lg:grid-cols-4">
        {tiles
          .filter((t) => t.show)
          .map((tile) => (
            <Link key={tile.href} href={tile.href}>
              <Card className="transition-colors hover:border-gold/50">
                <div className="text-xs font-semibold uppercase tracking-wide text-gold">{tile.label}</div>
                <div className="mt-3 text-3xl font-extrabold text-ink">{tile.value}</div>
                <div className="mt-1 text-xs text-charcoal">{tile.hint}</div>
              </Card>
            </Link>
          ))}
      </div>

      {isAdmin && (
        <div className="px-8 pb-8">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-bold text-ink">Admin queue</h2>
            <Pill tone="gold">Admin</Pill>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Link href="/admin">
              <Card className="transition-colors hover:border-gold/50">
                <div className="text-xs font-semibold uppercase tracking-wide text-charcoal">Tools pending review</div>
                <div className="mt-3 text-3xl font-extrabold text-ink">{pendingTools}</div>
              </Card>
            </Link>
            <Link href="/admin">
              <Card className="transition-colors hover:border-gold/50">
                <div className="text-xs font-semibold uppercase tracking-wide text-charcoal">New AI&rsquo;d requests</div>
                <div className="mt-3 text-3xl font-extrabold text-ink">{newAiRequests}</div>
              </Card>
            </Link>
            <Link href="/admin">
              <Card className="transition-colors hover:border-gold/50">
                <div className="text-xs font-semibold uppercase tracking-wide text-charcoal">Open support tickets</div>
                <div className="mt-3 text-3xl font-extrabold text-ink">{openTickets}</div>
              </Card>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
