"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";

export function Sidebar({
  items,
  fullName,
  email,
}: {
  items: NavItem[];
  fullName: string | null;
  email: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-none flex-col border-r border-border-c bg-white">
      <div className="border-b border-border-c px-6 py-6">
        <Image src="/logo.png" alt="Sunny Advertising" width={120} height={44} className="h-9 w-auto" priority />
        <div className="mt-1 text-[11px] text-charcoal">Sunny Sphere</div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-gold font-bold text-ink" : "text-charcoal hover:bg-black/5 hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4 flex-none" strokeWidth={2} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border-c px-6 py-4">
        <div className="truncate text-sm font-semibold text-ink">{fullName || email}</div>
        <form action="/auth/sign-out" method="post">
          <button type="submit" className="mt-1 text-xs text-charcoal hover:text-gold">
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
