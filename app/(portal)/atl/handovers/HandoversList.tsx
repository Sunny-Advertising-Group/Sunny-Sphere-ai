"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, FileText, Trash2 } from "lucide-react";
import { Card, EmptyState, LinkButton, Pill } from "@/components/ui";
import { deleteHandover } from "../actions";

export type Handover = {
  id: number;
  title: string;
  covering_for: string | null;
  starts_on: string | null;
  ends_on: string | null;
  file_path: string | null;
  source_url: string | null;
  uploaded_by: string | null;
};

function formatDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function dateRange(startsOn: string | null, endsOn: string | null) {
  if (startsOn && endsOn) return `${formatDate(startsOn)} – ${formatDate(endsOn)}`;
  if (startsOn) return `From ${formatDate(startsOn)}`;
  if (endsOn) return `Back ${formatDate(endsOn)}`;
  return null;
}

export function HandoversList({
  handovers,
  currentUserId,
  isAdmin,
}: {
  handovers: Handover[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [items, setItems] = useState(handovers);
  const [, startTransition] = useTransition();

  function remove(id: number) {
    if (!confirm("Delete this handover? This can't be undone.")) return;
    setItems((prev) => prev.filter((h) => h.id !== id));
    startTransition(async () => {
      await deleteHandover(id);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-charcoal">Upload an HTML write-up or link a Google Doc before you head off.</p>
        <LinkButton href="/atl/handovers/upload">+ Add handover</LinkButton>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No handovers yet"
          description="Add one before you're next away so the team knows what's happening."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((handover) => {
            const canRemove = isAdmin || handover.uploaded_by === currentUserId;
            const range = dateRange(handover.starts_on, handover.ends_on);
            return (
              <div key={handover.id} className="relative">
                <Link href={`/atl/handovers/${handover.id}`}>
                  <Card className="h-full transition-colors hover:border-gold/50">
                    <div className="flex items-center gap-2">
                      <Pill tone={handover.file_path ? "gold" : "muted"}>
                        {handover.file_path ? "HTML" : "Google Doc"}
                      </Pill>
                      {range && <span className="text-xs text-charcoal">{range}</span>}
                    </div>
                    <div className="mt-2 font-semibold text-ink">{handover.title}</div>
                    {handover.covering_for && (
                      <div className="mt-1 line-clamp-2 text-xs text-charcoal">{handover.covering_for}</div>
                    )}
                    {handover.source_url && (
                      <div className="mt-2 inline-flex items-center gap-1 text-xs text-charcoal">
                        <ExternalLink className="h-3 w-3" strokeWidth={2} /> Opens in Google Docs
                      </div>
                    )}
                  </Card>
                </Link>
                {canRemove && (
                  <button
                    onClick={() => remove(handover.id)}
                    aria-label="Delete handover"
                    className="absolute right-3 top-3 rounded-md p-1 text-charcoal/50 hover:bg-black/5 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
