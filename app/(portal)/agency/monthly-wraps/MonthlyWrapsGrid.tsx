"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Card, Pill } from "@/components/ui";
import { deleteMonthlyWrap } from "../actions";

export type MonthlyWrap = { id: number; wrap_month: string; title: string | null };

function formatMonth(wrapMonth: string) {
  return new Date(`${wrapMonth}T00:00:00Z`).toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function MonthlyWrapsGrid({ wraps, canUpload }: { wraps: MonthlyWrap[]; canUpload: boolean }) {
  const [items, setItems] = useState(wraps);
  const [, startTransition] = useTransition();

  function remove(id: number) {
    if (!confirm("Delete this wrap? This can't be undone.")) return;
    setItems((prev) => prev.filter((w) => w.id !== id));
    startTransition(async () => {
      await deleteMonthlyWrap(id);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((wrap) => (
        <div key={wrap.id} className="relative">
          <Link href={`/agency/monthly-wraps/${wrap.id}`}>
            <Card className="h-full transition-colors hover:border-gold/50">
              <Pill tone="gold">{formatMonth(wrap.wrap_month)}</Pill>
              <div className="mt-2 font-semibold text-ink">{wrap.title || `${formatMonth(wrap.wrap_month)} Wrap`}</div>
            </Card>
          </Link>
          {canUpload && (
            <button
              onClick={() => remove(wrap.id)}
              aria-label="Delete wrap"
              className="absolute right-3 top-3 rounded-md p-1 text-charcoal/50 hover:bg-black/5 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
