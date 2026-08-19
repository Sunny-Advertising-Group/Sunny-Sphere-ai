"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const AccordionContext = createContext<{
  openId: string | null;
  setOpenId: (id: string | null) => void;
} | null>(null);

// Single-open accordion: opening one item closes any other. Wraps existing
// Card styling (rounded-2xl border, white bg) rather than reusing <Card>
// directly, since the header needs to sit outside the body's padding.
export function AccordionGroup({
  children,
  defaultOpenId = null,
}: {
  children: ReactNode;
  defaultOpenId?: string | null;
}) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId);

  return (
    <AccordionContext.Provider value={{ openId, setOpenId }}>
      <div className="space-y-3">{children}</div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error("AccordionItem must be used within an AccordionGroup");
  const { openId, setOpenId } = ctx;
  const isOpen = openId === id;

  return (
    <div id={id} className="overflow-hidden rounded-2xl border border-border-c bg-white scroll-mt-8">
      <button
        type="button"
        onClick={() => setOpenId(isOpen ? null : id)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-charcoal">{description}</p>}
        </div>
        <ChevronDown
          className={`h-4 w-4 flex-none text-charcoal transition-transform ${isOpen ? "rotate-180" : ""}`}
          strokeWidth={2}
          aria-hidden
        />
      </button>
      {isOpen && <div className="border-t border-border-c p-5">{children}</div>}
    </div>
  );
}
