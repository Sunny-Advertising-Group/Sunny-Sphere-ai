export const CHANNEL_LABELS: Record<string, string> = {
  google: "Google",
  meta: "Meta",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  microsoft: "Microsoft",
  reddit: "Reddit",
  pinterest: "Pinterest",
  other: "Other",
};

export const CHANNEL_ORDER = [
  "google",
  "meta",
  "tiktok",
  "linkedin",
  "microsoft",
  "reddit",
  "pinterest",
  "other",
];

export const CHANNEL_OPTIONS = CHANNEL_ORDER.map((value) => ({ value, label: CHANNEL_LABELS[value] }));

export function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

// How often a client-channel needs an optimisation pass. Unlike ATL's cadence
// (which measures staleness against a file's last-edit time), this cadence
// defines the boundaries of the recurring period a tick counts toward.
export const CADENCE_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

export function cadenceLabel(cadence: string): string {
  return CADENCE_OPTIONS.find((c) => c.value === cadence)?.label ?? cadence;
}

export const CLIENT_STATUS_META: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "text-emerald-700 bg-emerald-50" },
  paused: { label: "Paused", className: "text-red-700 bg-red-50" },
  set_up: { label: "Set up", className: "text-blue-700 bg-blue-50" },
  archived: { label: "Archived", className: "text-charcoal bg-black/5" },
};

export function clientStatusMeta(status: string) {
  return CLIENT_STATUS_META[status] ?? { label: status, className: "text-charcoal bg-black/5" };
}

// Tiers whose optimisation weeks are gated by `digital_opti_schedule` (the
// Black/Yellow/Blue rotation). A tier not in this set — e.g. Red — is always
// due and unaffected by the rotation, since it never appears in that table.
export const SCHEDULED_TIER_NAMES = ["Black", "Yellow", "Blue"];

const WEEK_MS = 7 * 86_400_000;
// 2024-01-01 is a Monday — a fixed, arbitrary anchor so every client/channel's
// weekly and fortnightly periods land on the same real-world boundaries with
// no stored "current week" state to keep in sync.
const EPOCH_MONDAY_UTC = Date.UTC(2024, 0, 1);

// Start of the cadence period that `at` currently falls in. Weekly periods
// are calendar weeks (Mon–Sun); fortnightly alternate two-week blocks anchored
// to the same Monday; monthly/quarterly are calendar month/quarter starts.
export function periodStart(cadence: string, at: Date = new Date()): Date {
  if (cadence === "monthly") {
    return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  }
  if (cadence === "quarterly") {
    const quarter = Math.floor(at.getUTCMonth() / 3);
    return new Date(Date.UTC(at.getUTCFullYear(), quarter * 3, 1));
  }
  const spanMs = cadence === "fortnightly" ? WEEK_MS * 2 : WEEK_MS;
  const periodIndex = Math.floor((at.getTime() - EPOCH_MONDAY_UTC) / spanMs);
  return new Date(EPOCH_MONDAY_UTC + periodIndex * spanMs);
}

// The Monday of the current real-world week — shown as "Week commencing" on
// the tracker header, independent of any individual client's cadence.
export function currentWeekCommencing(at: Date = new Date()): Date {
  return periodStart("weekly", at);
}

// End of the cadence period `at` currently falls in — a channel's due-by
// date, whether or not it's already been logged this period (if logged,
// this is simply when it next resets and needs doing again).
export function periodEnd(cadence: string, at: Date = new Date()): Date {
  if (cadence === "monthly") {
    const start = periodStart(cadence, at);
    return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  }
  if (cadence === "quarterly") {
    const start = periodStart(cadence, at);
    return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 1));
  }
  const spanMs = cadence === "fortnightly" ? WEEK_MS * 2 : WEEK_MS;
  return new Date(periodStart(cadence, at).getTime() + spanMs);
}

export type OptiLog = { completed_at: string; voided_at: string | null };

export function isLoggedForCurrentPeriod(
  cadence: string,
  logs: OptiLog[],
  at: Date = new Date(),
): boolean {
  const startMs = periodStart(cadence, at).getTime();
  return logs.some((log) => !log.voided_at && new Date(log.completed_at).getTime() >= startMs);
}

export function lastLoggedAt(logs: OptiLog[]): string | null {
  const valid = logs.filter((log) => !log.voided_at);
  if (valid.length === 0) return null;
  return valid.reduce((latest, log) => (log.completed_at > latest ? log.completed_at : latest), valid[0].completed_at);
}

// The current instant, used only by server components that need "now" for a
// query cutoff or period calculation. Wrapped in its own function (rather
// than calling `new Date()` inline) so it isn't flagged as an impure call
// inside a component's render body by the React Compiler eslint rules.
export function currentInstant(): Date {
  return new Date();
}

export function lookbackIsoDate(days: number, now: Date): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

export type RawOptiLog = { client_channel_id: number; completed_at: string; voided_at: string | null };

// Who works a channel, and what share of its retainer credit they hold.
// Multiple owners on one channel (e.g. a lead + a second) split it between
// them — splitPct values aren't required to sum to 100.
export type ChannelOwnerInput = { profileId: string; name: string; splitPct: number };

export type ChannelInput = { id: number; client_id: number; channel: string; owners: ChannelOwnerInput[] };

export type TierInfo = { id: number; name: string; colour: string; sortOrder: number };

export type ClientInput = {
  id: number;
  name: string;
  colour: string | null;
  retainer: number | null;
  wipDocUrl: string | null;
  status: string;
  // Cadence is set once per client — every active channel on that client
  // shares the same optimisation schedule, rather than each channel having
  // its own.
  cadence: string;
  tier: TierInfo | null;
};

export type ClientChannelCard = {
  id: number;
  channel: string;
  done: boolean;
  lastLoggedAt: string | null;
  owners: ChannelOwnerInput[];
};

// leadName/secondName are derived, not stored — whoever holds the largest
// and next-largest total split across the client's channels (see
// buildDigitalOptiBoardData).
export type ClientCardData = ClientInput & {
  channels: ClientChannelCard[];
  leadName: string | null;
  secondName: string | null;
};

export type TeamSplitRow = { lead: string; clients: number; retainer: number; channels: number };

export type DigitalOptiBoardData = {
  clientCards: ClientCardData[];
  teamSplit: TeamSplitRow[];
  completionPct: number;
  totalDone: number;
  totalActive: number;
  lastUpdatedAt: string | null;
};

// All the per-request number-crunching for the tracker page, kept in one
// plain function (rather than inline in the page component) so the
// reduce-style accumulation isn't flagged as component-render mutation by
// the React Compiler eslint rules.
// Whether a client's channel counts toward this week's completion stat.
// A tier gated by the rotation (Black/Yellow/Blue) only counts in a week
// where its tier id is in `activeTierIds`; an ungated tier (e.g. Red) or an
// untiered client always counts; and if no schedule row exists for this
// week at all (`activeTierIds` is null), nothing is filtered.
function isDueThisWeek(
  tierId: number | undefined,
  scheduledTierIds: number[],
  activeTierIds: number[] | null,
): boolean {
  if (activeTierIds === null) return true;
  if (tierId == null || !scheduledTierIds.includes(tierId)) return true;
  return activeTierIds.includes(tierId);
}

export function buildDigitalOptiBoardData(
  clients: ClientInput[],
  channels: ChannelInput[],
  logs: RawOptiLog[],
  now: Date,
  scheduledTierIds: number[] = [],
  activeTierIds: number[] | null = null,
): DigitalOptiBoardData {
  const logsByChannel = new Map<number, OptiLog[]>();
  for (const log of logs) {
    const arr = logsByChannel.get(log.client_channel_id) ?? [];
    arr.push({ completed_at: log.completed_at, voided_at: log.voided_at });
    logsByChannel.set(log.client_channel_id, arr);
  }

  const channelsByClient = new Map<number, ChannelInput[]>();
  for (const ch of channels) {
    const arr = channelsByClient.get(ch.client_id) ?? [];
    arr.push(ch);
    channelsByClient.set(ch.client_id, arr);
  }

  let totalActive = 0;
  let totalDone = 0;
  let lastUpdatedAt: string | null = null;
  const personWorkload = new Map<string, number>();

  const clientCards: ClientCardData[] = clients.map((client) => {
    const dueThisWeek = isDueThisWeek(client.tier?.id, scheduledTierIds, activeTierIds);
    const chans: ClientChannelCard[] = (channelsByClient.get(client.id) ?? [])
      .slice()
      .sort((a, b) => CHANNEL_ORDER.indexOf(a.channel) - CHANNEL_ORDER.indexOf(b.channel))
      .map((ch) => {
        const chLogs = logsByChannel.get(ch.id) ?? [];
        const done = isLoggedForCurrentPeriod(client.cadence, chLogs, now);
        const lastLogged = lastLoggedAt(chLogs);
        if (dueThisWeek) {
          totalActive += 1;
          if (done) totalDone += 1;
        }
        if (lastLogged && (!lastUpdatedAt || lastLogged > lastUpdatedAt)) lastUpdatedAt = lastLogged;
        for (const owner of ch.owners) {
          personWorkload.set(owner.name, (personWorkload.get(owner.name) ?? 0) + owner.splitPct / 100);
        }
        return { id: ch.id, channel: ch.channel, done, lastLoggedAt: lastLogged, owners: ch.owners };
      });

    // Derived lead & second: whoever holds the largest (and next-largest)
    // total split across this client's channels (ties keep whichever was
    // seen first).
    const splitTotals = new Map<string, number>();
    for (const c of chans) {
      for (const owner of c.owners) {
        splitTotals.set(owner.name, (splitTotals.get(owner.name) ?? 0) + owner.splitPct);
      }
    }
    const rankedOwners = Array.from(splitTotals.entries()).sort((a, b) => b[1] - a[1]);
    const leadName = rankedOwners[0]?.[0] ?? null;
    const secondName = rankedOwners[1]?.[0] ?? null;

    return { ...client, channels: chans, leadName, secondName };
  });

  // Tiered hierarchy: untiered clients (sortOrder undefined) sort last,
  // ties broken alphabetically by name.
  clientCards.sort((a, b) => {
    const tierDiff = (a.tier?.sortOrder ?? Infinity) - (b.tier?.sortOrder ?? Infinity);
    return tierDiff !== 0 ? tierDiff : a.name.localeCompare(b.name);
  });

  const teamSplitMap = new Map<string, TeamSplitRow>();
  for (const client of clientCards) {
    const key = client.leadName ?? "Unassigned";
    const row = teamSplitMap.get(key) ?? { lead: key, clients: 0, retainer: 0, channels: 0 };
    row.clients += 1;
    row.retainer += client.retainer ?? 0;
    teamSplitMap.set(key, row);
  }
  // Anyone with channel workload gets a row too, even if they're never the
  // top-split "lead" of any client (e.g. a second who's spread thin).
  for (const [name, workload] of personWorkload) {
    if (!teamSplitMap.has(name)) {
      teamSplitMap.set(name, { lead: name, clients: 0, retainer: 0, channels: 0 });
    }
    teamSplitMap.get(name)!.channels = Math.round(workload * 10) / 10;
  }
  const teamSplit = Array.from(teamSplitMap.values()).sort((a, b) => b.retainer - a.retainer);

  const completionPct = totalActive === 0 ? 0 : Math.round((totalDone / totalActive) * 100);

  return { clientCards, teamSplit, completionPct, totalDone, totalActive, lastUpdatedAt };
}
