"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, Upload } from "lucide-react";
import { readSheet } from "read-excel-file/browser";
import { Button, Card, EmptyState, Input, Select } from "@/components/ui";
import {
  CHANNELS,
  type Channel,
  type MonthlyTotal,
  type ParsedCostRow,
  allocateDailySpend,
  aggregateDaily,
  aggregateMonthly,
  aggregateMonthlyByChannel,
  aggregateTotals,
  parseSpendCsv,
  parseSpendTable,
} from "@/lib/spendTracker";

const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// read-excel-file gives back typed cells (string | number | boolean | Date |
// null) straight from the workbook; normalize each to the same string shape
// a CSV parse would produce, so parseSpendTable never needs to know which
// source format it came from. Dates are written as "D-MMM-YYYY" specifically
// to match the one real export this tool was built against.
function excelRowsToTable(sheetRows: unknown[][]): string[][] {
  return sheetRows.map((row) =>
    row.map((cell) => {
      if (cell instanceof Date) {
        return `${cell.getUTCDate()}-${MONTH_ABBR[cell.getUTCMonth()]}-${cell.getUTCFullYear()}`;
      }
      return cell === null || cell === undefined ? "" : String(cell);
    }),
  );
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });
}

// Month -> Channel -> platform rows, so the report reads as a drill-down
// rather than one flat table mixing every month and channel together.
function groupMonthly(rows: MonthlyTotal[]) {
  const byMonth = new Map<string, MonthlyTotal[]>();
  for (const r of rows) {
    const list = byMonth.get(r.month) ?? [];
    list.push(r);
    byMonth.set(r.month, list);
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, monthRows]) => {
      const byChannel = new Map<Channel, MonthlyTotal[]>();
      for (const r of monthRows) {
        const list = byChannel.get(r.channel) ?? [];
        list.push(r);
        byChannel.set(r.channel, list);
      }
      const channels = Array.from(byChannel.entries()).sort(
        ([, a], [, b]) => b.reduce((s, r) => s + r.total, 0) - a.reduce((s, r) => s + r.total, 0),
      );
      return { month, monthTotal: monthRows.reduce((s, r) => s + r.total, 0), channels };
    });
}

export function SpendTrackerClient() {
  const [rows, setRows] = useState<ParsedCostRow[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDaily, setShowDaily] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setParseError(null);
    setFileName(file.name);
    try {
      const isExcel = /\.xlsx?$/i.test(file.name);
      const { rows: parsed, skipped: skippedCount } = isExcel
        ? parseSpendTable(excelRowsToTable(await readSheet(file)))
        : parseSpendCsv(await file.text());
      setRows(parsed);
      setSkipped(skippedCount);
      if (parsed.length > 0) {
        const dates = parsed.map((r) => r.date).sort();
        setDateFrom(dates[0]);
        setDateTo(dates[dates.length - 1]);
      }
    } catch (err) {
      setRows(null);
      setParseError(err instanceof Error ? err.message : "Couldn't read that file.");
    }
  }

  function updateChannel(id: string, channel: Channel) {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, channel, channelWasFlagged: false } : r)) ?? null);
  }

  const flagged = rows?.filter((r) => r.channelWasFlagged) ?? [];

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => (!dateFrom || r.date >= dateFrom) && (!dateTo || r.date <= dateTo));
  }, [rows, dateFrom, dateTo]);

  const dailyEntries = useMemo(() => allocateDailySpend(filteredRows), [filteredRows]);
  const totals = useMemo(() => aggregateTotals(dailyEntries), [dailyEntries]);
  const daily = useMemo(() => aggregateDaily(dailyEntries), [dailyEntries]);
  const monthGroups = useMemo(() => groupMonthly(aggregateMonthly(dailyEntries)), [dailyEntries]);
  const channelTotalsByMonth = useMemo(() => {
    const map = new Map<string, { total: number; avgPerDay: number }>();
    for (const c of aggregateMonthlyByChannel(dailyEntries)) {
      map.set(`${c.month}|${c.channel}`, { total: c.total, avgPerDay: c.avgPerDay });
    }
    return map;
  }, [dailyEntries]);
  const grandTotal = totals.reduce((sum, t) => sum + t.total, 0);

  function downloadCsv() {
    const header = ["Date", "Channel", "Platform", "Spend"];
    const lines = daily.map((d) => [d.date, d.channel, d.platform, d.amount.toFixed(2)].join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "daily-spend-breakdown.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <Card>
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-c py-10 text-center hover:border-gold/50"
        >
          <Upload className="h-6 w-6 text-charcoal/50" strokeWidth={1.5} aria-hidden />
          <p className="text-sm font-semibold text-ink">
            {fileName ? `Loaded: ${fileName}` : "Click to upload a spends CSV or Excel file"}
          </p>
          <p className="text-xs text-charcoal">Expects the job-costing export shape — [Job] Client, [Job Cost] Date, [Job Cost] Cost Name, [Job Cost] Unit Cost, etc. Accepts .csv, .xlsx or .xls.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
        {parseError && <p className="mt-3 text-sm font-medium text-red-600">{parseError}</p>}
        {rows && skipped > 0 && (
          <p className="mt-3 text-xs text-charcoal">
            {skipped} row{skipped === 1 ? "" : "s"} skipped (missing date, cost name, or unit cost).
          </p>
        )}
      </Card>

      {rows && rows.length === 0 && (
        <EmptyState title="No usable rows found" description="Check the file has the expected columns and at least one cost line." />
      )}

      {rows && rows.length > 0 && (
        <>
          {flagged.length > 0 && (
            <Card className="border-amber-300 bg-amber-50">
              <div className="mb-3 flex items-center gap-2 text-amber-800">
                <AlertTriangle className="h-4 w-4" strokeWidth={2} aria-hidden />
                <span className="text-sm font-bold">
                  {flagged.length} cost line{flagged.length === 1 ? "" : "s"} couldn&apos;t be matched to a channel — assign one below
                </span>
              </div>
              <div className="space-y-2">
                {flagged.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink">{row.costName}</div>
                      <div className="text-xs text-charcoal">
                        {row.client} · {row.date} · {currency.format(row.unitCost)}
                      </div>
                    </div>
                    <Select
                      className="w-40"
                      value={row.channel}
                      onChange={(e) => updateChannel(row.id, e.target.value as Channel)}
                    >
                      {CHANNELS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-charcoal">From</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-charcoal">To</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
            </div>
            <Button variant="ghost" onClick={() => setShowDaily((v) => !v)}>
              {showDaily ? "Hide daily breakdown" : "Show daily breakdown"}
            </Button>
            <Button variant="ghost" onClick={downloadCsv} className="ml-auto">
              <Download className="h-4 w-4" strokeWidth={2} aria-hidden />
              Download daily CSV
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <div className="text-2xl font-extrabold text-ink">{currency.format(grandTotal)}</div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-charcoal">Total spend in range</div>
            </Card>
            <Card>
              <div className="text-2xl font-extrabold text-ink">
                {dateFrom || "—"} → {dateTo || "—"}
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-charcoal">Date range</div>
            </Card>
            <Card>
              <div className="text-2xl font-extrabold text-ink">{totals.length}</div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-charcoal">Channel + platform combinations</div>
            </Card>
          </div>

          <div className="space-y-8">
            {monthGroups.map(({ month, monthTotal, channels }) => (
              <div key={month}>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-base font-bold text-ink">{monthLabel(month)}</h2>
                  <span className="text-sm font-semibold text-charcoal">{currency.format(monthTotal)}</span>
                </div>
                <div className="space-y-5">
                  {channels.map(([channel, platforms]) => {
                    const channelTotal = channelTotalsByMonth.get(`${month}|${channel}`);
                    return (
                    <div key={channel}>
                      <div className="mb-2 flex items-baseline justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gold">{channel}</span>
                        {channelTotal && (
                          <span className="text-xs font-semibold text-charcoal">
                            {currency.format(channelTotal.avgPerDay)}/day · {currency.format(channelTotal.total)} this month
                          </span>
                        )}
                      </div>
                      <Card className="overflow-x-auto p-0">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border-c text-left text-xs uppercase text-charcoal">
                              <th className="px-4 py-3">Media platform</th>
                              <th className="px-4 py-3">Days active</th>
                              <th className="px-4 py-3">Daily spend</th>
                              <th className="px-4 py-3">Total for month</th>
                            </tr>
                          </thead>
                          <tbody>
                            {platforms.map((p) => (
                              <tr key={p.platform} className="border-b border-border-c last:border-0">
                                <td className="px-4 py-3 font-medium text-ink">{p.platform}</td>
                                <td className="px-4 py-3 text-charcoal">{p.dayCount}</td>
                                <td className="px-4 py-3">{currency.format(p.avgPerDay)}</td>
                                <td className="px-4 py-3 font-semibold text-ink">{currency.format(p.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </Card>
                    </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {showDaily && (
            <div>
              <h2 className="mb-3 text-sm font-bold text-ink">Daily breakdown</h2>
              <Card className="max-h-[600px] overflow-y-auto overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-border-c text-left text-xs uppercase text-charcoal">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Channel</th>
                      <th className="px-4 py-3">Platform</th>
                      <th className="px-4 py-3">Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daily.map((d) => (
                      <tr key={`${d.date}|${d.channel}|${d.platform}`} className="border-b border-border-c last:border-0">
                        <td className="px-4 py-3">{d.date}</td>
                        <td className="px-4 py-3">{d.channel}</td>
                        <td className="px-4 py-3 text-charcoal">{d.platform}</td>
                        <td className="px-4 py-3">{currency.format(d.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          <p className="border-l-2 border-gold pl-4 text-xs leading-relaxed text-charcoal">
            Costs are spread evenly across whatever month is named in the Cost Name (e.g. &quot;July 2026&quot;) — if no month is
            found, the full amount lands on that line&apos;s own booking date instead. Platform names are extracted from the cost
            description text, not a managed vendor list, so the same supplier can occasionally show up under slightly different
            names. Nothing here is saved — re-upload the file to see this again.
          </p>
        </>
      )}
    </div>
  );
}
