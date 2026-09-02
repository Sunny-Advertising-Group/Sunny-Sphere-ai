import { isLoggedForCurrentPeriod, lastLoggedAt } from "./digitalOpti";

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
  research: "Research",
  live_material_tracker: "Live material tracker",
  // Lincoln Place splits both media plan and live material by state rather
  // than having one link per kind — these keep the admin dropdown and the
  // Links tab showing a real label instead of a raw kind string.
  nsw_media_plan: "NSW media plan",
  qld_media_plan: "QLD media plan",
  vic_media_plan: "VIC media plan",
  nsw_live_material: "NSW live material tracker",
  qld_live_material: "QLD live material tracker",
  vic_live_material: "VIC live material tracker",
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
  "research",
  "live_material_tracker",
  "nsw_media_plan",
  "qld_media_plan",
  "vic_media_plan",
  "nsw_live_material",
  "qld_live_material",
  "vic_live_material",
];

// Kinds whose live_material rows should be synced (the live-material cron
// matches on this, not on an exact single kind, since some clients split
// their tracker by state).
export const LIVE_MATERIAL_KIND_PATTERN = "live_material";

// Some clients (Lincoln Place) split what's conceptually a single kind of
// document into one link per state. Individually they keep their own label
// (e.g. "NSW media plan") so the Links tab and admin dropdown stay specific,
// but for the /atl "By category" rollup across all clients, a media plan is
// a flight plan and a state live-material tracker is still just the live
// material tracker — this folds them into their shared parent category.
const CATEGORY_ALIASES: Record<string, string> = {
  nsw_media_plan: "flight_plan",
  qld_media_plan: "flight_plan",
  vic_media_plan: "flight_plan",
  nsw_live_material: "live_material_tracker",
  qld_live_material: "live_material_tracker",
  vic_live_material: "live_material_tracker",
};

export function categoryKind(kind: string): string {
  return CATEGORY_ALIASES[kind] ?? kind;
}

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

// The date a link should be refreshed by — reuses the same dueSoonDays
// threshold that flips a link's status from "current" to "due_soon", so
// there's a single canonical due date rather than a separate tunable.
export function nextDueDate(cadence: string | null, driveModifiedAt: string | null): Date | null {
  if (!cadence || cadence === "none" || !driveModifiedAt) return null;
  const preset = CADENCE_OPTIONS.find((c) => c.value === cadence);
  if (!preset || preset.dueSoonDays === null) return null;
  return new Date(new Date(driveModifiedAt).getTime() + preset.dueSoonDays * 86_400_000);
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

// Colour coding for the Live material tab's STATUS column. Only these four
// statuses ever reach this table (lib/liveMaterial.ts filters the rest out at
// sync time), so anything else falls back to a neutral style.
const LIVE_MATERIAL_STATUS_CLASSNAMES: Record<string, string> = {
  live: "text-emerald-700 bg-emerald-50",
  "extended live": "text-emerald-700 bg-emerald-50",
  "expiring soon": "text-blue-700 bg-blue-50",
  upcoming: "text-yellow-700 bg-yellow-50",
};

export function liveMaterialStatusClassName(status: string | null): string {
  if (!status) return "text-charcoal bg-black/5";
  return LIVE_MATERIAL_STATUS_CLASSNAMES[status.trim().toLowerCase()] ?? "text-charcoal bg-black/5";
}

// --- Checklist tab: tick-per-period, same mechanism as Digital Opti (see
// periodStart/isLoggedForCurrentPeriod/lastLoggedAt in lib/digitalOpti.ts —
// those are cadence-generic, not Digital-specific, so reused as-is here) but
// keyed on each atl_link's own cadence rather than a client-level one.

export type ChecklistLinkInput = {
  id: number;
  clientId: number;
  clientName: string;
  clientColour: string | null;
  kind: string;
  title: string;
  cadence: string | null;
};

export type ChecklistLogInput = { atl_link_id: number; completed_at: string; voided_at: string | null };

export type ChecklistCard = ChecklistLinkInput & {
  cadence: string;
  done: boolean;
  lastLoggedAt: string | null;
};

export type ChecklistData = {
  cards: ChecklistCard[];
  completionPct: number;
  totalDone: number;
  totalActive: number;
};

export function buildAtlChecklistData(
  links: ChecklistLinkInput[],
  logs: ChecklistLogInput[],
  now: Date = new Date(),
): ChecklistData {
  const logsByLink = new Map<number, { completed_at: string; voided_at: string | null }[]>();
  for (const log of logs) {
    const arr = logsByLink.get(log.atl_link_id) ?? [];
    arr.push({ completed_at: log.completed_at, voided_at: log.voided_at });
    logsByLink.set(log.atl_link_id, arr);
  }

  let totalDone = 0;
  const cards: ChecklistCard[] = links
    .filter((l): l is ChecklistLinkInput & { cadence: string } => !!l.cadence && l.cadence !== "none")
    .map((l) => {
      const linkLogs = logsByLink.get(l.id) ?? [];
      const done = isLoggedForCurrentPeriod(l.cadence, linkLogs, now);
      if (done) totalDone += 1;
      return { ...l, done, lastLoggedAt: lastLoggedAt(linkLogs) };
    })
    .sort((a, b) => a.clientName.localeCompare(b.clientName) || a.title.localeCompare(b.title));

  return {
    cards,
    completionPct: cards.length === 0 ? 0 : Math.round((totalDone / cards.length) * 100),
    totalDone,
    totalActive: cards.length,
  };
}

export type ChecklistClientGroup = {
  clientId: number;
  clientName: string;
  clientColour: string | null;
  cadences: string[];
  items: ChecklistCard[];
  allDone: boolean;
};

// One row per client for the Checklist tab — every one of that client's
// cadenced links (WIP, Flight plan, etc.) becomes its own tick chip on that
// same row, with the row's cadence(s) shown under the client name.
export function groupChecklistByClient(cards: ChecklistCard[]): ChecklistClientGroup[] {
  const cadenceOrder = CADENCE_OPTIONS.map((c) => c.value);
  const map = new Map<number, ChecklistClientGroup>();

  for (const card of cards) {
    const group = map.get(card.clientId) ?? {
      clientId: card.clientId,
      clientName: card.clientName,
      clientColour: card.clientColour,
      cadences: [],
      items: [],
      allDone: true,
    };
    group.items.push(card);
    if (!group.cadences.includes(card.cadence)) group.cadences.push(card.cadence);
    map.set(card.clientId, group);
  }

  const groups = Array.from(map.values());
  for (const group of groups) {
    group.allDone = group.items.every((item) => item.done);
    group.items.sort((a, b) => a.title.localeCompare(b.title));
    group.cadences.sort((a, b) => cadenceOrder.indexOf(a) - cadenceOrder.indexOf(b));
  }
  return groups.sort((a, b) => a.clientName.localeCompare(b.clientName));
}
