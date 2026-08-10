"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, Pill } from "@/components/ui";

export type Tip = {
  id: number;
  category: string | null;
  body: string;
  title: string | null;
  created_at: string;
  status?: string;
};

export function TipsFeed({
  tips,
  likeCounts,
  likedByMe,
}: {
  tips: Tip[];
  likeCounts: Record<number, number>;
  likedByMe: number[];
}) {
  const [counts, setCounts] = useState(likeCounts);
  const [liked, setLiked] = useState(new Set(likedByMe));

  async function toggleLike(tipId: number) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (liked.has(tipId)) {
      await supabase.from("tip_likes").delete().eq("tip_id", tipId).eq("user_id", user.id);
      setLiked((prev) => {
        const next = new Set(prev);
        next.delete(tipId);
        return next;
      });
      setCounts((prev) => ({ ...prev, [tipId]: Math.max(0, (prev[tipId] ?? 1) - 1) }));
    } else {
      await supabase.from("tip_likes").insert({ tip_id: tipId, user_id: user.id });
      setLiked((prev) => new Set(prev).add(tipId));
      setCounts((prev) => ({ ...prev, [tipId]: (prev[tipId] ?? 0) + 1 }));
    }
  }

  return (
    <div className="space-y-3">
      {tips.map((tip) => (
        <Card key={tip.id} className="flex items-start gap-4">
          <button
            onClick={() => toggleLike(tip.id)}
            className={`flex flex-none flex-col items-center gap-0.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              liked.has(tip.id) ? "border-gold/40 bg-gold/10 text-gold" : "border-border-c text-charcoal hover:bg-black/5"
            }`}
          >
            <span>▲</span>
            <span>{counts[tip.id] ?? 0}</span>
          </button>
          <div className="flex-1">
            {tip.title && <div className="font-semibold text-ink">{tip.title}</div>}
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-charcoal">{tip.body}</p>
            <div className="mt-2 flex items-center gap-2">
              {tip.category && <Pill>{tip.category}</Pill>}
              {tip.status && tip.status !== "published" && <Pill tone="muted">{tip.status}</Pill>}
              <span className="text-xs text-charcoal">{new Date(tip.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
