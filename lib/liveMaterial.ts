// Parses a client's "Live Material" tracker sheet (exported as CSV) into rows
// matching the `live_material` table. This is the canonical copy, used by the
// daily sync (app/api/cron/sync-live-material). scripts/parse-live-material-csv.mjs
// has a standalone duplicate of this logic for one-off manual testing from the CLI.
//
// Sheet shape: three sections (LIVE MATERIAL / UPCOMING MATERIAL / PRIOR
// MATERIAL), each repeating the same 13-column header:
// CAMPAIGN, CHANNEL TYPE, CHANNEL, MARKET, ASSET TYPE, ASSET KEY, MESSAGING,
// ROTATION, START DATE, END DATE, STATUS, DRIVE LINK, NOTES
// Plus decorative campaign-group rows (e.g. "  LGCTH,,,,,,,,,,,") and blank
// separator rows, which are skipped. Only rows whose STATUS is Live, Extended
// Live, Expiring Soon, or Upcoming are kept — see ALLOWED_STATUSES below.

import { parseCsv } from "./csv";

export type LiveMaterialRecord = {
  partner: string | null;
  channel: string | null;
  asset_name: string | null;
  asset_link: string | null;
  flight_dates: string | null;
  material_key: string | null;
  rotation: string | null;
  messaging: string | null;
  status: string | null;
  start_date: string | null;
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

// Only these STATUS values are worth surfacing in the Live material tab — the
// sheet also carries "Not Live", "Asset Not Supplied" and other prior-material
// statuses that would otherwise swamp the current/near-term view.
const ALLOWED_STATUSES = new Set(["live", "extended live", "expiring soon", "upcoming"]);

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

    const [campaign, channelType, channel, , assetType, assetKey, messaging, rotation, startDate, endDate, status, driveLink] = cells;
    const trimmedStatus = (status || "").trim();
    if (!ALLOWED_STATUSES.has(trimmedStatus.toLowerCase())) continue;

    out.push({
      partner: (channel || "").trim() || null,
      channel: (channelType || "").trim() || null,
      asset_name: [campaign, assetType].map((s) => (s || "").trim()).filter(Boolean).join(" — ") || null,
      asset_link: (driveLink || "").trim() || null,
      flight_dates: [startDate, endDate].map((s) => (s || "").trim()).filter(Boolean).join(" – ") || null,
      material_key: (assetKey || "").trim() || null,
      rotation: (rotation || "").trim() || null,
      messaging: (messaging || "").trim() || null,
      status: trimmedStatus || null,
      start_date: ddmmyyyyToIso(startDate),
      due_date: ddmmyyyyToIso(endDate),
    });
  }

  return out;
}
