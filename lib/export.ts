import type { Rack, Delivery, Zone, HistoryEvent } from "@/types";
import { formatDuration } from "@/lib/utils";
import {
  isRackNeedsAttention,
  getTimeInCurrentStatus,
  getStageDurations,
  STAGE_THRESHOLDS_MS,
} from "@/lib/timeTracking";

// ── Core CSV helper ───────────────────────────────────────────────────────────

function cell(value: unknown): string {
  const str = value == null ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function toCSV(headers: string[], rows: unknown[][]): string {
  const head = headers.map(cell).join(",");
  const body = rows.map((r) => r.map(cell).join(",")).join("\n");
  return `${head}\n${body}`;
}

export function downloadCSV(filename: string, headers: string[], rows: unknown[][]): void {
  const csv  = toCSV(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function isoToLocal(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString();
}

// ── Export functions ──────────────────────────────────────────────────────────

/** All racks with status, priority, zone, delivery, stuck flag, time in stage. */
export function exportRacks(
  racks:      Rack[],
  zones:      Zone[],
  deliveries: Delivery[],
  history:    HistoryEvent[]
): void {
  const zoneMap     = new Map(zones.map((z) => [z.id, z.name]));
  const deliveryMap = new Map(deliveries.map((d) => [d.id, d.consignerJNumber ?? d.deliveryCode]));

  const headers = [
    "Rack Code", "Consigner", "Status", "Priority",
    "Zone", "Delivery", "Created", "Last Updated",
    "Time in Current Stage", "Stuck",
  ];

  const rows = racks.map((r) => [
    r.rackCode,
    r.consignerName,
    r.status,
    r.priority,
    zoneMap.get(r.zoneId ?? "") ?? "",
    deliveryMap.get(r.deliveryId) ?? "",
    isoToLocal(r.createdAt),
    isoToLocal(r.updatedAt),
    formatDuration(getTimeInCurrentStatus(r, history)),
    isRackNeedsAttention(r, history) ? "Yes" : "No",
  ]);

  downloadCSV(`flowops-racks-${today()}.csv`, headers, rows);
}

/** All deliveries with progress and outcome summary. */
export function exportDeliveries(
  deliveries: Delivery[],
  racks:      Rack[]
): void {
  const headers = [
    "Delivery Code", "Consigner", "J-Number", "Type", "Status",
    "Date", "Completed At", "Auction Date",
    "Expected Racks", "Linked Racks", "Done Racks", "Progress %",
    "Donation %", "Trash %", "Sellable %",
  ];

  const rows = deliveries.map((d) => {
    const linked    = racks.filter((r) => r.deliveryId === d.id);
    const done      = linked.filter((r) => r.status === "pickup" || r.status === "completed");
    const total     = linked.length;
    const pct       = total > 0 ? Math.round((done.length / total) * 100) : 0;
    const donation  = d.donationPercent ?? null;
    const trash     = d.trashPercent    ?? null;
    const sellable  = donation != null || trash != null
      ? Math.max(0, 100 - (donation ?? 0) - (trash ?? 0))
      : null;
    return [
      d.consignerJNumber ?? d.deliveryCode,
      d.consignerName,
      d.consignerJNumber ?? "",
      d.type,
      d.status,
      d.arrivedAt ? isoToLocal(d.arrivedAt) : d.scheduledDate,
      isoToLocal(d.completedAt),
      d.auctionDate ?? "",
      d.expectedRackCount || "",
      linked.length,
      done.length,
      total > 0 ? `${pct}%` : "",
      donation  != null ? `${donation}%`  : "",
      trash     != null ? `${trash}%`     : "",
      sellable  != null ? `${sellable}%`  : "",
    ];
  });

  downloadCSV(`flowops-deliveries-${today()}.csv`, headers, rows);
}

/** Only stuck racks with stage timing detail. */
export function exportStuckRacks(
  racks:      Rack[],
  zones:      Zone[],
  deliveries: Delivery[],
  history:    HistoryEvent[]
): void {
  const zoneMap     = new Map(zones.map((z) => [z.id, z.name]));
  const deliveryMap = new Map(deliveries.map((d) => [d.id, d.consignerJNumber ?? d.deliveryCode]));

  const stuck = racks.filter((r) => isRackNeedsAttention(r, history));

  const headers = [
    "Rack Code", "Consigner", "Status", "Priority",
    "Zone", "Delivery", "Time in Stage", "Stage Threshold", "Over By",
  ];

  const rows = stuck.map((r) => {
    const timeMs      = getTimeInCurrentStatus(r, history);
    const thresholdMs = STAGE_THRESHOLDS_MS[r.status];
    const overMs      = Math.max(0, timeMs - thresholdMs);
    return [
      r.rackCode,
      r.consignerName,
      r.status,
      r.priority,
      zoneMap.get(r.zoneId ?? "") ?? "",
      deliveryMap.get(r.deliveryId) ?? "",
      formatDuration(timeMs),
      formatDuration(thresholdMs),
      formatDuration(overMs),
    ];
  });

  downloadCSV(`flowops-stuck-racks-${today()}.csv`, headers, rows);
}

/** Per-rack stage duration breakdown. One row per stage per rack. */
export function exportStageDurations(
  racks:   Rack[],
  history: HistoryEvent[]
): void {
  const headers = [
    "Rack Code", "Consigner", "Stage",
    "Entered At", "Exited At", "Duration",
    "Threshold", "Over Threshold",
  ];

  const rows: unknown[][] = [];

  for (const rack of racks) {
    const stages = getStageDurations(rack, history);
    for (const s of stages) {
      const threshold = STAGE_THRESHOLDS_MS[s.status];
      rows.push([
        rack.rackCode,
        rack.consignerName,
        s.status,
        isoToLocal(s.enteredAt),
        s.exitedAt ? isoToLocal(s.exitedAt) : "current",
        formatDuration(s.durationMs),
        formatDuration(threshold),
        s.overThreshold ? "Yes" : "No",
      ]);
    }
  }

  downloadCSV(`flowops-stage-durations-${today()}.csv`, headers, rows);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
