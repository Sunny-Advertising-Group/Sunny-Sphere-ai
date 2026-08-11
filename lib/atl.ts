export const KIND_LABELS: Record<string, string> = {
  flight_plan: "Flight plan",
  wip: "WIP",
  rate_card: "Rate card",
  budget: "Budget",
  assets: "Assets",
  reporting: "Reporting",
  wag_spends: "WAG spends",
  whatagraph_report: "Whatagraph report and reporting dashboard",
  creative_brief: "Creative brief",
  live_material_tracker: "Live material tracker",
};

// Kinds shown first, in this order, before any other kind found in the data (alphabetical).
export const KIND_ORDER = [
  "flight_plan",
  "wip",
  "rate_card",
  "budget",
  "assets",
  "reporting",
  "wag_spends",
  "whatagraph_report",
  "creative_brief",
  "live_material_tracker",
];

// Dropdown options for the admin ATL link form — single source of truth, kept
// in step with KIND_LABELS/KIND_ORDER above.
export const KIND_OPTIONS = KIND_ORDER.map((value) => ({ value, label: KIND_LABELS[value] }));

export function kindLabel(kind: string): string {
  if (KIND_LABELS[kind]) return KIND_LABELS[kind];
  return kind
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// How often a link's underlying file is expected to change, and how many days
// after its last edit it counts as "due soon" / "overdue" on the Housekeeping
// tab. "none" (e.g. a rate card or a one-off spec) is excluded from tracking.
export const CADENCE_OPTIONS: {
  value: string;
  label: string;
  dueSoonDays: number | null;
  overdueDays: number | null;
}[] = [
  { value: "weekly", label: "Weekly", dueSoonDays: 8, overdueDays: 14 },
  { value: "fortnightly", label: "Fortnightly", dueSoonDays: 16, overdueDays: 24 },
  { value: "monthly", label: "Monthly", dueSoonDays: 35, overdueDays: 60 },
  { value: "quarterly", label: "Quarterly", dueSoonDays: 100, overdueDays: 135 },
  { value: "none", label: "Doesn't need to be updated", dueSoonDays: null, overdueDays: null },
];

export function cadenceLabel(cadence: string | null): string {
  return CADENCE_OPTIONS.find((c) => c.value === cadence)?.label ?? "Not set";
}

export type HousekeepingStatus = "current" | "due_soon" | "overdue" | "not_tracked" | "awaiting_sync";

export function housekeepingStatus(
  cadence: string | null,
  drivModifiedAt: string | null,
): HousekeepingStatus {
  if (!cadence || cadence === "none") return "not_tracked";
  const preset = CADENCE_OPTIONS.find((c) => c.value === cadence);
  if (!preset || preset.dueSoonDays === null || preset.overdueDays === null) return "not_tracked";
  if (!drivModifiedAt) return "awaiting_sync";

  const ageDays = (Date.now() - new Date(drivModifiedAt).getTime()) / 86_400_000;
  if (ageDays > preset.overdueDays) return "overdue";
  if (ageDays > preset.dueSoonDays) return "due_soon";
  return "current";
}

export const HOUSEKEEPING_STATUS_META: Record<
  HousekeepingStatus,
  { label: string; className: string }
> = {
  current: { label: "Current", className: "text-emerald-700 bg-emerald-50" },
  due_soon: { label: "Due soon", className: "text-amber-700 bg-amber-50" },
  overdue: { label: "Overdue", className: "text-red-700 bg-red-50" },
  not_tracked: { label: "Not tracked", className: "text-charcoal bg-black/5" },
  awaiting_sync: { label: "Awaiting sync", className: "text-charcoal bg-black/5" },
};
