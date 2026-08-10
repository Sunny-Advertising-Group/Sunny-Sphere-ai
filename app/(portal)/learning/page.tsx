import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader, Pill } from "@/components/ui";
import { AddResourceForm } from "@/components/AddResourceForm";

export default async function LearningPage() {
  const visibility = await getVisibility();
  if (!visibility) redirect("/login");

  const supabase = await createClient();
  const [{ data: paths }, { data: looms }, { data: progress }] = await Promise.all([
    supabase.from("resources").select("*").eq("section", "learning_path").order("sort_order"),
    supabase.from("resources").select("*").eq("section", "loom").order("sort_order"),
    supabase.from("learning_progress").select("resource_id, modules_done").eq("user_id", visibility.profile.id),
  ]);

  const progressByResource = new Map((progress ?? []).map((p) => [p.resource_id, p.modules_done]));

  return (
    <div>
      <PageHeader title="Learning" description="Learning paths and the Loom training library." />
      <div className="space-y-10 p-8">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">Learning paths</h2>
            {visibility.isAdmin && <AddResourceForm section="learning_path" label="+ Add path" showDuration />}
          </div>
          {!paths || paths.length === 0 ? (
            <EmptyState icon="🎓" title="No learning paths yet" />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paths.map((p) => {
                const done = progressByResource.get(p.id) ?? 0;
                const total = p.module_count ?? 0;
                return (
                  <Card key={p.id}>
                    <div className="font-semibold text-ink">{p.title}</div>
                    {p.description && <p className="mt-1 text-sm text-charcoal">{p.description}</p>}
                    {total > 0 && (
                      <div className="mt-3">
                        <div className="h-1.5 w-full rounded-full bg-black/5">
                          <div
                            className="h-1.5 rounded-full bg-gold"
                            style={{ width: `${Math.min(100, (done / total) * 100)}%` }}
                          />
                        </div>
                        <div className="mt-1 text-xs text-charcoal">
                          {done}/{total} modules
                        </div>
                      </div>
                    )}
                    {p.url && (
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-gold hover:underline">
                        Start →
                      </a>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">Training videos</h2>
            {visibility.isAdmin && <AddResourceForm section="loom" label="+ Add video" showDuration />}
          </div>
          {!looms || looms.length === 0 ? (
            <EmptyState icon="📹" title="No training videos yet" />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {looms.map((l) => (
                <a key={l.id} href={l.url ?? "#"} target="_blank" rel="noopener noreferrer" className="block">
                  <Card className="h-full transition-colors hover:border-gold/50">
                    <div className="mb-2 flex items-center gap-2">
                      {l.group_name && <Pill tone="gold">{l.group_name}</Pill>}
                      {l.duration && <span className="text-xs text-charcoal">⏱ {l.duration}</span>}
                    </div>
                    <div className="font-semibold text-ink">{l.title}</div>
                    {l.description && <p className="mt-1 text-sm text-charcoal">{l.description}</p>}
                  </Card>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
