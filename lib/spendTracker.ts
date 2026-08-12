// Parses a job-costing export ("[Job Cost] ..." columns) into a daily spend
// breakdown by channel and platform. The source data has no explicit flight
// dates — each row is a lump sum on one booking date, with the real period it
// covers only hinted at in the free-text Cost Name (e.g. "OOH QMS Street
// Furniture | July 2026"). This is a heuristic best-effort parse, not exact
// accounting: it detects a channel via keyword matching (flagging anything it
// can't place, defaulting to "Miscellaneous"), a platform from the leading
// descriptive text, and a period from any month+year found in the Cost Name —
// falling back to a single unspread day on the booking date when no period
// can be found. Every derived value is shown back to the user so mistakes are
// visible rather than silently baked in.
import { parseCsv } from "./csv";

export const CHANNELS = [
  "OOH",
  "Radio",
  "TV",
  "Press",
  "Programmatic",
  "Digital",
  "Social",
  "Search",
  "Cinema",
  "Miscellaneous",
] as const;

export type Channel = (typeof CHANNELS)[number];

const MONTH_NAMES: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const MONTH_PATTERN =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i;

const CHANNEL_RULES: [RegExp, Channel][] = [
  [/\bOOH\b/i, "OOH"],
  [/\btransit\b/i, "OOH"],
  [/\bstreet furniture\b/i, "OOH"],
  [/\bbillboard\b/i, "OOH"],
  [/\bradio\b/i, "Radio"],
  [/\btelevision\b/i, "TV"],
  [/\btv\b/i, "TV"],
  [/\bpress\b/i, "Press"],
  [/\bprint\b/i, "Press"],
  [/\bnewspaper\b/i, "Press"],
  [/\bprogrammatic\b/i, "Programmatic"],
  [/\bbvod\b/i, "Programmatic"],
  [/\bcinema\b/i, "Cinema"],
  [/\bsocial\b/i, "Social"],
  [/\bsearch\b/i, "Search"],
  [/\bdigital\b/i, "Digital"],
];

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseRowDate(s: string): string {
  const m = /^(\d{1,2})-([A-Za-z]{3,})-(\d{4})$/.exec(s.trim());
  if (!m) throw new Error(`Unrecognized date format: "${s}"`);
  const day = parseInt(m[1], 10);
  const month = MONTH_NAMES[m[2].toLowerCase()];
  const year = parseInt(m[3], 10);
  if (month === undefined) throw new Error(`Unrecognized month: "${m[2]}"`);
  return toIso(new Date(Date.UTC(year, month, day)));
}

function findMonthYear(text: string): { month: number; year: number } | null {
  const m = MONTH_PATTERN.exec(text);
  if (!m) return null;
  const month = MONTH_NAMES[m[1].toLowerCase()];
  const rest = text.slice(m.index + m[0].length);
  const yearMatch = /\b(\d{4}|\d{2})\b/.exec(rest);
  if (!yearMatch) return null;
  let year = parseInt(yearMatch[1], 10);
  if (year < 100) year += 2000; // "26" -> 2026 — fine until this genuinely needs to distinguish centuries
  return { month, year };
}

export function detectChannel(costName: string): Channel | null {
  for (const [pattern, channel] of CHANNEL_RULES) {
    if (pattern.test(costName)) return channel;
  }
  return null;
}

// Best-effort vendor/platform label from the leading segment(s) of the cost
// name, with the matched channel keyword stripped out. Not a managed vendor
// directory — the same platform can show up under slightly different names
// (e.g. "SCA SeaFM" vs "Hot Tomato") if the source text isn't consistent.
export function detectPlatform(costName: string, channel: Channel | null): string {
  const segments = costName
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return "Unspecified";

  const last = segments[segments.length - 1];
  const candidates = segments.length > 1 && findMonthYear(last) ? segments.slice(0, -1) : segments;

  for (const seg of candidates) {
    const stripped = channel ? seg.replace(new RegExp(`\\b${channel}\\b`, "i"), "").trim() : seg;
    if (stripped) return stripped;
  }
  return "Unspecified";
}

// The period a cost line's amount should be spread across. Looks for a
// month+year in the last "|"-delimited segment first (where it consistently
// sits in this export format), then the whole string as a fallback. No
// period found -> single unspread day on the row's own booking date.
export function detectPeriod(costName: string, fallbackDateIso: string): { start: string; end: string } {
  const segments = costName
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const last = segments[segments.length - 1] ?? costName;

  const found = findMonthYear(last) ?? findMonthYear(costName);
  if (!found) return { start: fallbackDateIso, end: fallbackDateIso };

  const start = new Date(Date.UTC(found.year, found.month, 1));
  const end = new Date(Date.UTC(found.year, found.month + 1, 0)); // day 0 of next month = last day of this one
  return { start: toIso(start), end: toIso(end) };
}

export type ParsedCostRow = {
  id: string;
  client: string;
  jobNo: string;
  jobName: string;
  costName: string;
  date: string;
  unitCost: number;
  channel: Channel;
  channelWasFlagged: boolean;
  platform: string;
  periodStart: string;
  periodEnd: string;
};

const REQUIRED_COLUMNS = {
  client: "[Job] Client",
  jobNo: "[Job] Job No.",
  jobName: "[Job] Name",
  date: "[Job Cost] Date",
  costName: "[Job Cost] Cost Name",
  unitCost: "[Job Cost] Unit Cost",
};

export function parseSpendCsv(text: string): { rows: ParsedCostRow[]; skipped: number } {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], skipped: 0 };

  const header = table[0].map((h) => h.trim());
  const colIndex = (label: string) => {
    const i = header.indexOf(label);
    if (i === -1) throw new Error(`Missing expected column: "${label}"`);
    return i;
  };
  const col = {
    client: colIndex(REQUIRED_COLUMNS.client),
    jobNo: colIndex(REQUIRED_COLUMNS.jobNo),
    jobName: colIndex(REQUIRED_COLUMNS.jobName),
    date: colIndex(REQUIRED_COLUMNS.date),
    costName: colIndex(REQUIRED_COLUMNS.costName),
    unitCost: colIndex(REQUIRED_COLUMNS.unitCost),
  };

  const rows: ParsedCostRow[] = [];
  let skipped = 0;

  for (let i = 1; i < table.length; i++) {
    const cells = table[i];
    if (cells.every((c) => c.trim() === "")) continue;

    const costName = (cells[col.costName] ?? "").trim();
    const unitCostRaw = (cells[col.unitCost] ?? "").trim();
    const dateRaw = (cells[col.date] ?? "").trim();
    if (!costName || !unitCostRaw || !dateRaw) {
      skipped++;
      continue;
    }

    const unitCost = parseFloat(unitCostRaw.replace(/,/g, ""));
    if (!Number.isFinite(unitCost)) {
      skipped++;
      continue;
    }

    let date: string;
    try {
      date = parseRowDate(dateRaw);
    } catch {
      skipped++;
      continue;
    }

    const channel = detectChannel(costName);
    const period = detectPeriod(costName, date);
    const platform = detectPlatform(costName, channel);

    rows.push({
      id: `${i}`,
      client: (cells[col.client] ?? "").trim(),
      jobNo: (cells[col.jobNo] ?? "").trim(),
      jobName: (cells[col.jobName] ?? "").trim(),
      costName,
      date,
      unitCost,
      channel: channel ?? "Miscellaneous",
      channelWasFlagged: channel === null,
      platform,
      periodStart: period.start,
      periodEnd: period.end,
    });
  }

  return { rows, skipped };
}

export type DailySpendEntry = {
  date: string;
  channel: Channel;
  platform: string;
  amount: number;
  client: string;
  costName: string;
};

const DAY_MS = 86_400_000;

export function allocateDailySpend(rows: ParsedCostRow[]): DailySpendEntry[] {
  const entries: DailySpendEntry[] = [];
  for (const row of rows) {
    const startMs = Date.parse(`${row.periodStart}T00:00:00Z`);
    const endMs = Date.parse(`${row.periodEnd}T00:00:00Z`);
    const numDays = Math.round((endMs - startMs) / DAY_MS) + 1;
    const perDay = row.unitCost / numDays;

    for (let t = startMs; t <= endMs; t += DAY_MS) {
      entries.push({
        date: new Date(t).toISOString().slice(0, 10),
        channel: row.channel,
        platform: row.platform,
        amount: perDay,
        client: row.client,
        costName: row.costName,
      });
    }
  }
  return entries;
}

export function aggregateDaily(entries: DailySpendEntry[]) {
  const map = new Map<string, { date: string; channel: Channel; platform: string; amount: number }>();
  for (const e of entries) {
    const key = `${e.date}|${e.channel}|${e.platform}`;
    const existing = map.get(key);
    if (existing) existing.amount += e.amount;
    else map.set(key, { date: e.date, channel: e.channel, platform: e.platform, amount: e.amount });
  }
  return Array.from(map.values()).sort(
    (a, b) => a.date.localeCompare(b.date) || a.channel.localeCompare(b.channel) || a.platform.localeCompare(b.platform),
  );
}

export function aggregateTotals(entries: DailySpendEntry[]) {
  const map = new Map<string, { channel: Channel; platform: string; total: number; days: Set<string> }>();
  for (const e of entries) {
    const key = `${e.channel}|${e.platform}`;
    const existing = map.get(key);
    if (existing) {
      existing.total += e.amount;
      existing.days.add(e.date);
    } else {
      map.set(key, { channel: e.channel, platform: e.platform, total: e.amount, days: new Set([e.date]) });
    }
  }
  return Array.from(map.values())
    .map((v) => ({ channel: v.channel, platform: v.platform, total: v.total, avgPerDay: v.total / v.days.size, dayCount: v.days.size }))
    .sort((a, b) => b.total - a.total);
}

export type MonthlyTotal = {
  month: string; // "YYYY-MM"
  channel: Channel;
  platform: string;
  total: number;
  avgPerDay: number;
  dayCount: number;
};

// Same shape as aggregateTotals, but split by calendar month — so a platform
// booked across several months (e.g. June + July) shows its own daily rate
// per month instead of one blended average across both.
export function aggregateMonthly(entries: DailySpendEntry[]): MonthlyTotal[] {
  const map = new Map<string, { month: string; channel: Channel; platform: string; total: number; days: Set<string> }>();
  for (const e of entries) {
    const month = e.date.slice(0, 7);
    const key = `${month}|${e.channel}|${e.platform}`;
    const existing = map.get(key);
    if (existing) {
      existing.total += e.amount;
      existing.days.add(e.date);
    } else {
      map.set(key, { month, channel: e.channel, platform: e.platform, total: e.amount, days: new Set([e.date]) });
    }
  }
  return Array.from(map.values())
    .map((v) => ({ month: v.month, channel: v.channel, platform: v.platform, total: v.total, avgPerDay: v.total / v.days.size, dayCount: v.days.size }))
    .sort((a, b) => a.month.localeCompare(b.month) || b.total - a.total);
}

export type MonthlyChannelTotal = { month: string; channel: Channel; total: number; avgPerDay: number; dayCount: number };

// Channel-level rollup per month (summed across all its platforms). Computed
// from the raw daily entries rather than by summing the per-platform
// aggregateMonthly rows, so the day count reflects distinct days the channel
// was active — not a sum that could double-count overlapping days.
export function aggregateMonthlyByChannel(entries: DailySpendEntry[]): MonthlyChannelTotal[] {
  const map = new Map<string, { month: string; channel: Channel; total: number; days: Set<string> }>();
  for (const e of entries) {
    const month = e.date.slice(0, 7);
    const key = `${month}|${e.channel}`;
    const existing = map.get(key);
    if (existing) {
      existing.total += e.amount;
      existing.days.add(e.date);
    } else {
      map.set(key, { month, channel: e.channel, total: e.amount, days: new Set([e.date]) });
    }
  }
  return Array.from(map.values())
    .map((v) => ({ month: v.month, channel: v.channel, total: v.total, avgPerDay: v.total / v.days.size, dayCount: v.days.size }))
    .sort((a, b) => a.month.localeCompare(b.month) || b.total - a.total);
}
