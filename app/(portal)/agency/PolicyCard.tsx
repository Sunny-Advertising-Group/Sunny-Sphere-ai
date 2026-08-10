"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Card, Pill } from "@/components/ui";

export type Policy = {
  id: number;
  title: string;
  description: string | null;
  resource_type: string | null;
  url: string | null;
  body: string | null;
};

export function PolicyCard({ policy }: { policy: Policy }) {
  const [open, setOpen] = useState(false);

  if (policy.url) {
    return (
      <a href={policy.url} target="_blank" rel="noopener noreferrer" className="block">
        <PolicyCardBody policy={policy} />
      </a>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="block w-full text-left">
        <PolicyCardBody policy={policy} />
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-8 shadow-xl"
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 text-charcoal hover:text-ink"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
            {policy.resource_type && <Pill>{policy.resource_type}</Pill>}
            <h2 className="mt-3 text-lg font-extrabold text-ink">{policy.title}</h2>
            {policy.body && (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-charcoal">{policy.body}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function PolicyCardBody({ policy }: { policy: Policy }) {
  return (
    <Card className="h-full transition-colors hover:border-gold/50">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-ink">{policy.title}</div>
        {policy.resource_type && <Pill>{policy.resource_type}</Pill>}
      </div>
      {policy.description && <p className="mt-1 text-sm text-charcoal">{policy.description}</p>}
    </Card>
  );
}
