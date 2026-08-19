import { housekeepingStatus, nextDueDate } from "./atl";
import { channelLabel, isLoggedForCurrentPeriod, periodEnd, type OptiLog } from "./digitalOpti";

export type TaskItem = {
  kind: "atl" | "digital";
  clientName: string;
  itemLabel: string;
  status: "outstanding" | "upcoming";
  dueDate: string | null;
  href: string;
};

export type AtlTaskInput = {
  clientName: string;
  title: string;
  cadence: string | null;
  driveModifiedAt: string | null;
};

export type DigitalTaskInput = {
  clientName: string;
  channel: string;
  cadence: string;
  logs: OptiLog[];
};

// Kept out of any component body (pure, no Date.now()/new Date() calls) so
// pages can call it once with a shared `now` without tripping the React
// Compiler eslint purity rules that flag impure calls inside render.
export function buildOutstandingItems(
  atlLinks: AtlTaskInput[],
  digitalChannels: DigitalTaskInput[],
  now: Date,
  upcomingWindowDays = 14,
): TaskItem[] {
  const windowMs = upcomingWindowDays * 86_400_000;
  const items: TaskItem[] = [];

  for (const link of atlLinks) {
    const status = housekeepingStatus(link.cadence, link.driveModifiedAt);
    if (status === "not_tracked") continue;
    const due = nextDueDate(link.cadence, link.driveModifiedAt);
    const href = `/atl/${encodeURIComponent(link.clientName)}`;
    if (status === "overdue" || status === "due_soon" || status === "awaiting_sync") {
      items.push({
        kind: "atl",
        clientName: link.clientName,
        itemLabel: link.title,
        status: "outstanding",
        dueDate: due ? due.toISOString() : null,
        href,
      });
    } else if (due && due.getTime() - now.getTime() <= windowMs) {
      items.push({
        kind: "atl",
        clientName: link.clientName,
        itemLabel: link.title,
        status: "upcoming",
        dueDate: due.toISOString(),
        href,
      });
    }
  }

  for (const ch of digitalChannels) {
    const done = isLoggedForCurrentPeriod(ch.cadence, ch.logs, now);
    const due = periodEnd(ch.cadence, now);
    if (!done) {
      items.push({
        kind: "digital",
        clientName: ch.clientName,
        itemLabel: channelLabel(ch.channel),
        status: "outstanding",
        dueDate: due.toISOString(),
        href: "/digital-opti",
      });
    } else if (due.getTime() - now.getTime() <= windowMs) {
      items.push({
        kind: "digital",
        clientName: ch.clientName,
        itemLabel: channelLabel(ch.channel),
        status: "upcoming",
        dueDate: due.toISOString(),
        href: "/digital-opti",
      });
    }
  }

  return items.sort((a, b) => {
    if (a.status !== b.status) return a.status === "outstanding" ? -1 : 1;
    if (!a.dueDate) return -1;
    if (!b.dueDate) return 1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}
