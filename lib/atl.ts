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
