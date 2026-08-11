#!/usr/bin/env node
// Parses a client's "Live Material" tracker sheet (exported as CSV) into rows
// matching the `live_material` table. Reads CSV text from stdin, writes a JSON
// array to stdout. Used by the hourly live-material sync — see
// docs/live-material-sync.md for the full procedure.
//
// Sheet shape: three sections (LIVE MATERIAL / UPCOMING MATERIAL / PRIOR
// MATERIAL), each repeating the same 13-column header:
// CAMPAIGN, CHANNEL TYPE, CHANNEL, MARKET, ASSET TYPE, ASSET KEY, MESSAGING,
// ROTATION, START DATE, END DATE, STATUS, DRIVE LINK, NOTES
// Plus decorative campaign-group rows (e.g. "  LGCTH,,,,,,,,,,,") and blank
// separator rows, which are skipped.

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ",") { pushField(); continue; }
    if (c === "\r") continue;
    if (c === "\n") { pushRow(); continue; }
    field += c;
  }
  if (field !== "" || row.length > 0) pushRow();
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

function ddmmyyyyToIso(s) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec((s || "").trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function isBlankRow(cells) {
  return cells.every((c) => (c ?? "").trim() === "");
}

function isSectionHeader(cells) {
  const first = (cells[0] || "").trim().toUpperCase();
  return /^(LIVE|UPCOMING|PRIOR) MATERIAL$/.test(first) && isBlankRow(cells.slice(1));
}

function isColumnHeaderRow(cells) {
  return (cells[0] || "").trim().toUpperCase() === "CAMPAIGN";
}

function isPlaceholderRow(cells) {
  const first = (cells[0] || "").trim();
  return /^No .+ at this time\.?$/i.test(first) && isBlankRow(cells.slice(1));
}

function isGroupHeaderRow(cells) {
  // Decorative rows like "  LGCTH,,,,,,,,,,," — campaign name only, no channel data.
  return (cells[0] || "").trim() !== "" && isBlankRow(cells.slice(1, 5));
}

export function parseLiveMaterial(csvText) {
  const rows = parseCsv(csvText);
  const out = [];

  for (const cells of rows) {
    if (isBlankRow(cells)) continue;
    if (isSectionHeader(cells)) continue;
    if (isColumnHeaderRow(cells)) continue;
    if (isPlaceholderRow(cells)) continue;
    if (isGroupHeaderRow(cells)) continue;
    if (cells.length < 11) continue;

    const [campaign, channelType, channel, , assetType, assetKey, messaging, rotation, startDate, endDate, status] = cells;

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

if (import.meta.url === `file://${process.argv[1]}`) {
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (input += chunk));
  process.stdin.on("end", () => {
    process.stdout.write(JSON.stringify(parseLiveMaterial(input), null, 2));
  });
}
