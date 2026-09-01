"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { searchSunnySphere, type SearchResultItem, type SearchResults } from "@/lib/actions/search";

const EMPTY_RESULTS: SearchResults = { pages: [], tools: [], clients: [], howTos: [] };

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const timeout = setTimeout(() => {
      startTransition(async () => {
        setResults(await searchSunnySphere(trimmed));
      });
    }, 200);
    return () => clearTimeout(timeout);
  }, [query]);

  const total = results.pages.length + results.tools.length + results.clients.length + results.howTos.length;
  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-xl border border-border-c bg-white px-3 py-2.5">
        <Search className="h-4 w-4 flex-none text-charcoal" strokeWidth={2} aria-hidden />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search tools, clients, pages, how-tos…"
          className="w-full text-sm text-ink outline-none placeholder:text-charcoal/50"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults(EMPTY_RESULTS);
            }}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5 text-charcoal" strokeWidth={2} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-border-c bg-white p-2 shadow-lg">
          {total === 0 ? (
            <p className="px-2 py-1.5 text-sm text-charcoal">No matches for &ldquo;{query}&rdquo;</p>
          ) : (
            <>
              <ResultGroup label="Pages" items={results.pages} onNavigate={() => setOpen(false)} />
              <ResultGroup label="Tools" items={results.tools} onNavigate={() => setOpen(false)} />
              <ResultGroup label="Clients" items={results.clients} onNavigate={() => setOpen(false)} />
              <ResultGroup label="How-tos" items={results.howTos} onNavigate={() => setOpen(false)} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: SearchResultItem[];
  onNavigate: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-1 last:mb-0">
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-charcoal">{label}</div>
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          onClick={onNavigate}
          className="block rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-bg"
        >
          {item.label}
          {item.sublabel && <span className="ml-2 text-xs text-charcoal">{item.sublabel}</span>}
        </Link>
      ))}
    </div>
  );
}
