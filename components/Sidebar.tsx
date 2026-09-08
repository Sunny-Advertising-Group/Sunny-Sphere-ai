"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { NAV_ITEMS } from "@/lib/nav";

const COLLAPSED_KEY = "sunnysphere.sidebar.collapsed";

export function Sidebar({
  visibleHrefs,
  fullName,
  email,
}: {
  visibleHrefs: string[];
  fullName: string | null;
  email: string;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => visibleHrefs.includes(item.href));
  const [collapsed, setCollapsed] = useState(false);

  // Read the saved preference after mount so server and client render the
  // same (expanded) markup first, avoiding a hydration mismatch. This is a
  // one-off sync from an external system (localStorage), not derived state —
  // the usual reason to avoid setState-in-effect doesn't apply here.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "true");
    } catch {
      // localStorage unavailable (private browsing, etc.) — stay expanded.
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        // Ignore — preference just won't persist this session.
      }
      return next;
    });
  }

  return (
    <aside
      className={`relative flex h-screen flex-none flex-col border-r border-border-c bg-white transition-[width] duration-150 ${
        collapsed ? "w-[68px]" : "w-64"
      }`}
    >
      <button
        onClick={toggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-8 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border-c bg-white text-charcoal shadow-sm hover:text-ink"
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} /> : <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />}
      </button>

      <div className={`border-b border-border-c py-6 ${collapsed ? "px-3" : "px-6"}`}>
        {collapsed ? (
          <Image src="/logo.png" alt="Sunny Advertising" width={28} height={28} className="h-7 w-7 object-contain" priority />
        ) : (
          <>
            <Image src="/logo.png" alt="Sunny Advertising" width={120} height={44} className="h-9 w-auto" priority />
            <div className="mt-1 text-[11px] text-charcoal">Sunny Sphere</div>
          </>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                collapsed ? "justify-center" : ""
              } ${active ? "bg-gold font-bold text-ink" : "text-charcoal hover:bg-black/5 hover:text-ink"}`}
            >
              <Icon className="h-4 w-4 flex-none" strokeWidth={2} aria-hidden />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      <div className={`border-t border-border-c py-4 ${collapsed ? "px-3" : "px-6"}`}>
        {collapsed ? (
          <form action="/auth/sign-out" method="post">
            <button type="submit" title="Sign out" aria-label="Sign out" className="flex w-full justify-center text-charcoal hover:text-gold">
              <LogOut className="h-4 w-4" strokeWidth={2} />
            </button>
          </form>
        ) : (
          <>
            <div className="truncate text-sm font-semibold text-ink">{fullName || email}</div>
            <form action="/auth/sign-out" method="post">
              <button type="submit" className="mt-1 text-xs text-charcoal hover:text-gold">
                Sign out
              </button>
            </form>
          </>
        )}
      </div>
    </aside>
  );
}
