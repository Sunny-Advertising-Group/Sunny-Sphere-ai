export const KIND_LABELS: Record<string, string> = {
  flight_plan: "Flight plan",
  wip: "WIP",
  rate_card: "Rate card",
  budget: "Budget",
  assets: "Assets",
  reporting: "Reporting",
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
  "live_material_tracker",
];

export function kindLabel(kind: string): string {
  if (KIND_LABELS[kind]) return KIND_LABELS[kind];
  return kind
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
