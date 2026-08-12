// Parses a client's "Live Material" tracker sheet (exported as CSV) into rows
// matching the `live_material` table. This is the canonical copy, used by the
// hourly sync (app/api/cron/sync-live-material). scripts/parse-live-material-csv.mjs
// has a standalone duplicate of this logic for one-off manual testing from the CLI.
//
// Sheet shape: three sections (LIVE MATERIAL / UPCOMING MATERIAL / PRIOR
// MATERIAL), each repeating the same 13-column header:
// CAMPAIGN, CHANNEL TYPE, CHANNEL, MARKET, ASSET TYPE, ASSET KEY, MESSAGING,
// ROTATION, START DATE, END DATE, STATUS, DRIVE LINK, NOTES
// Plus decorative campaign-group rows (e.g. "  LGCTH,,,,,,,,,,,") and blank
// separator rows, which are skipped.

import { parseCsv } from "./csv";

export type LiveMaterialRecord = {
  partner: string | null;
  channel: string | null;
  asset_name: string | null;
  flight_dates: string | null;
  material_key: string | null;
  rotation: string | null;
  status: string | null;
  due_date: string | null;
};

function ddmmyyyyToIso(s: string | undefined): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec((s || "").trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function isBlankRow(cells: string[]): boolean {
  return cells.every((c) => (c ?? "").trim() === "");
}

function isSectionHeader(cells: string[]): boolean {
  const first = (cells[0] || "").trim().toUpperCase();
  return /^(LIVE|UPCOMING|PRIOR) MATERIAL$/.test(first) && isBlankRow(cells.slice(1));
}

function isColumnHeaderRow(cells: string[]): boolean {
  return (cells[0] || "").trim().toUpperCase() === "CAMPAIGN";
}

function isPlaceholderRow(cells: string[]): boolean {
  const first = (cells[0] || "").trim();
  return /^No .+ at this time\.?$/i.test(first) && isBlankRow(cells.slice(1));
}

function isGroupHeaderRow(cells: string[]): boolean {
  // Decorative rows like "  LGCTH,,,,,,,,,,," — campaign name only, no channel data.
  return (cells[0] || "").trim() !== "" && isBlankRow(cells.slice(1, 5));
}

export function parseLiveMaterial(csvText: string): LiveMaterialRecord[] {
  const rows = parseCsv(csvText);
  const out: LiveMaterialRecord[] = [];

  for (const cells of rows) {
    if (isBlankRow(cells)) continue;
    if (isSectionHeader(cells)) continue;
    if (isColumnHeaderRow(cells)) continue;
    if (isPlaceholderRow(cells)) continue;
    if (isGroupHeaderRow(cells)) continue;
    if (cells.length < 11) continue;

    const [campaign, channelType, channel, , assetType, assetKey, , rotation, startDate, endDate, status] = cells;

    out.push({
      partner: (channel || "").trim() || null,
      channel: (channelType || "").trim() || null,
      asset_name: [campaign, assetType].map((s) => (s || "").trim()).filter(Boolean).join(" — ") || null,
      flight_dates: [startDate, endDate].map((s) => (s || "").trim()).filter(Boolean).join(" – ") || null,
      material_key: (assetKey || "").trim() || null,
      rotation: (rotation || "").trim() || null,
      status: (status || "").trim() || null,
      due_date: ddmmyyyyToIso(endDate),
    });
  }

  return out;
}
