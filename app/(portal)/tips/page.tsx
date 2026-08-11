import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { MessageCircle, Sparkles } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { TipForm } from "./TipForm";
import { TipsFeed } from "./TipsFeed";

export default async function TipsPage() {
  const visibility = await getVisibility();
  if (!visibility) redirect("/login");

  const supabase = await createClient();
  const [{ data: tips }, { data: prompts }, { data: likes }] = await Promise.all([
    supabase.from("tips").select("id, category, body, title, created_at, status").eq("is_prompt", false).order("created_at", { ascending: false }),
    supabase.from("tips").select("id, category, body, title, created_at, status").eq("is_prompt", true).order("created_at", { ascending: false }),
    supabase.from("tip_likes").select("tip_id, user_id"),
  ]);

  const likeCounts: Record<number, number> = {};
  const likedByMe: number[] = [];
  for (const like of likes ?? []) {
    likeCounts[like.tip_id] = (likeCounts[like.tip_id] ?? 0) + 1;
    if (like.user_id === visibility.profile.id) likedByMe.push(like.tip_id);
  }

  return (
    <div>
      <PageHeader title="Tips & Prompts" description="Shortcuts, tricks and prompts curated by the AI Champs." />
      <div className="grid grid-cols-1 gap-10 p-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-bold text-ink">Tips & tricks</h2>
          <div className="mb-6">
            <TipForm isPrompt={false} />
          </div>
          {!tips || tips.length === 0 ? (
            <EmptyState icon={MessageCircle} title="No tips yet" />
          ) : (
            <TipsFeed tips={tips} likeCounts={likeCounts} likedByMe={likedByMe} />
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-bold text-ink">Prompt library</h2>
          <div className="mb-6">
            <TipForm isPrompt={true} />
          </div>
          {!prompts || prompts.length === 0 ? (
            <EmptyState icon={Sparkles} title="No prompts yet" />
          ) : (
            <TipsFeed tips={prompts} likeCounts={likeCounts} likedByMe={likedByMe} />
          )}
        </div>
      </div>
    </div>
  );
}
