"use client";

import { useState, useTransition } from "react";
import { grantSection, revokeSection, updateRole } from "@/lib/actions/admin";
import { RESTRICTED_SECTIONS } from "@/lib/sections";
import { Card } from "@/components/ui";

export type Person = {
  id: string;
  email: string;
  full_name: string | null;
  team: string | null;
  role: "team" | "admin";
  grantedSections: string[];
};

export function PeopleTable({ people }: { people: Person[] }) {
  const [rows, setRows] = useState(people);
  const [, startTransition] = useTransition();

  function changeRole(id: string, role: "team" | "admin") {
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, role } : p)));
    startTransition(async () => {
      await updateRole(id, role);
    });
  }

  function toggleSection(id: string, section: string, granted: boolean) {
    setRows((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              grantedSections: granted
                ? [...p.grantedSections, section]
                : p.grantedSections.filter((s) => s !== section),
            }
          : p,
      ),
    );
    startTransition(async () => {
      if (granted) {
        await grantSection(id, section);
      } else {
        await revokeSection(id, section);
      }
    });
  }

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-c text-left text-xs uppercase text-charcoal">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Team</th>
            <th className="px-4 py-3">Role</th>
            {RESTRICTED_SECTIONS.map((s) => (
              <th key={s.key} className="px-4 py-3">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-border-c last:border-0">
              <td className="px-4 py-3">
                <div className="font-medium text-ink">{p.full_name || p.email}</div>
                <div className="text-xs text-charcoal">{p.email}</div>
              </td>
              <td className="px-4 py-3 text-charcoal">{p.team || "—"}</td>
              <td className="px-4 py-3">
                <select
                  value={p.role}
                  onChange={(e) => changeRole(p.id, e.target.value as "team" | "admin")}
                  className="rounded-lg border border-border-c bg-white px-2 py-1 text-xs outline-none focus:border-gold"
                >
                  <option value="team">Team</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              {RESTRICTED_SECTIONS.map((s) => (
                <td key={s.key} className="px-4 py-3">
                  {p.role === "admin" ? (
                    <span className="text-xs text-charcoal">All access</span>
                  ) : (
                    <input
                      type="checkbox"
                      checked={p.grantedSections.includes(s.key)}
                      onChange={(e) => toggleSection(p.id, s.key, e.target.checked)}
                      className="h-4 w-4 accent-gold"
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
