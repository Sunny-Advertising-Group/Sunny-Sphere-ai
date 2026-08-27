"use client";

import { Fragment, useState, useTransition } from "react";
import {
  grantSection,
  removeMember,
  resendInviteLink,
  revokeSection,
  updateRole,
  updateTeam,
} from "@/lib/actions/admin";
import { RESTRICTED_SECTIONS } from "@/lib/sections";
import { Button, Card, Input } from "@/components/ui";

export type Person = {
  id: string;
  email: string;
  full_name: string | null;
  team: string | null;
  role: "team" | "admin";
  grantedSections: string[];
  lastSignInAt: string | null;
};

export function PeopleTable({ people, currentUserId }: { people: Person[]; currentUserId: string }) {
  const [rows, setRows] = useState(people);
  const [, startTransition] = useTransition();

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const [resendPending, setResendPending] = useState<string | null>(null);
  const [resendLinks, setResendLinks] = useState<Record<string, string>>({});
  const [resendErrors, setResendErrors] = useState<Record<string, string>>({});

  function changeRole(id: string, role: "team" | "admin") {
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, role } : p)));
    startTransition(async () => {
      await updateRole(id, role);
    });
  }

  function changeTeam(id: string, team: string) {
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, team: team || null } : p)));
    startTransition(async () => {
      await updateTeam(id, team);
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

  function openConfirm(id: string) {
    setConfirmId(id);
    setCode("");
    setRemoveError(null);
  }

  function cancelConfirm() {
    setConfirmId(null);
    setCode("");
    setRemoveError(null);
  }

  function confirmRemove(id: string) {
    if (code.trim().length !== 6) {
      setRemoveError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setRemoveError(null);
    setRemoving(true);
    startTransition(async () => {
      const result = await removeMember(id, code.trim());
      setRemoving(false);
      if (result?.error) {
        setRemoveError(result.error);
        return;
      }
      setRows((prev) => prev.filter((p) => p.id !== id));
      setConfirmId(null);
      setCode("");
    });
  }

  function resend(id: string) {
    setResendPending(id);
    setResendErrors((prev) => ({ ...prev, [id]: "" }));
    startTransition(async () => {
      const result = await resendInviteLink(id);
      setResendPending(null);
      if (result?.error) {
        setResendErrors((prev) => ({ ...prev, [id]: result.error! }));
        return;
      }
      setResendLinks((prev) => ({ ...prev, [id]: result.inviteLink ?? "" }));
    });
  }

  const colCount = 5 + RESTRICTED_SECTIONS.length;

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
            <th className="px-4 py-3">Login</th>
            <th className="px-4 py-3">Access</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <Fragment key={p.id}>
              <tr className="border-b border-border-c last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{p.full_name || p.email}</div>
                  <div className="text-xs text-charcoal">{p.email}</div>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    defaultValue={p.team ?? ""}
                    placeholder="—"
                    onBlur={(e) => {
                      if (e.target.value !== (p.team ?? "")) changeTeam(p.id, e.target.value.trim());
                    }}
                    className="w-28 rounded-lg border border-border-c bg-white px-2 py-1 text-xs text-charcoal outline-none focus:border-gold"
                  />
                </td>
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
                <td className="px-4 py-3">
                  {p.lastSignInAt ? (
                    <span className="text-xs text-charcoal">
                      Signed in {new Date(p.lastSignInAt).toISOString().slice(0, 10)}
                    </span>
                  ) : (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-amber-700">Not logged in yet</span>
                      <div>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => resend(p.id)}
                          disabled={resendPending === p.id}
                          className="px-2 py-1 text-xs"
                        >
                          {resendPending === p.id ? "Generating…" : "Resend link"}
                        </Button>
                      </div>
                      {resendErrors[p.id] && (
                        <p className="text-xs font-medium text-red-600">{resendErrors[p.id]}</p>
                      )}
                      {resendLinks[p.id] && (
                        <div className="flex items-center gap-1">
                          <Input
                            readOnly
                            value={resendLinks[p.id]}
                            className="w-40 text-[10px]"
                            onFocus={(e) => e.target.select()}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => navigator.clipboard.writeText(resendLinks[p.id])}
                            className="px-2 py-1 text-xs"
                          >
                            Copy
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.id === currentUserId ? (
                    <span className="text-xs text-charcoal/50">—</span>
                  ) : confirmId === p.id ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => openConfirm(p.id)}
                      className="px-2 py-1 text-xs text-red-600"
                    >
                      Remove
                    </Button>
                  )}
                </td>
              </tr>
              {confirmId === p.id && (
                <tr className="border-b border-border-c bg-red-50/50">
                  <td colSpan={colCount} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-ink">
                        Remove {p.full_name || p.email}? This deletes their login and cannot be undone.
                      </span>
                      <Input
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="6-digit code"
                        className="w-32"
                        maxLength={6}
                      />
                      <Button
                        type="button"
                        onClick={() => confirmRemove(p.id)}
                        disabled={removing}
                        style={{ backgroundColor: "#dc2626", color: "#fff" }}
                      >
                        {removing ? "Removing…" : "Confirm removal"}
                      </Button>
                      <Button type="button" variant="ghost" onClick={cancelConfirm}>
                        Cancel
                      </Button>
                    </div>
                    {removeError && <p className="mt-1 text-xs font-medium text-red-600">{removeError}</p>}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
