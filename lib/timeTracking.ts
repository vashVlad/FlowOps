import type { Rack, RackStatus, HistoryEvent } from "@/types";
import { STATUS_ORDER } from "@/lib/racks";
import {
  BH_DAILY_MS,
  calculateBusinessDuration,
  businessDurationNow,
} from "@/lib/businessTime";

export { formatBusinessDuration } from "@/lib/businessTime";

const H = 3_600_000; // one hour in ms

// ── Per-stage thresholds — expressed in BUSINESS milliseconds ────────────────
// One business day = 9 h = BH_DAILY_MS

export const STAGE_THRESHOLDS_MS: Record<RackStatus, number> = {
  intake:    4  * H,           // 4 business hours
  unpacking: 6  * H,           // 6 business hours
  sorting:   5  * BH_DAILY_MS, // 5 business days (45 h operational)
  lotting:   4  * H,           // 4 business hours
  ready:     14 * BH_DAILY_MS, // 14 business days — scheduled wait
  pickup:    7  * BH_DAILY_MS, // 7 business days — capacity-constrained
  completed: Infinity,
};

// ── Alert thresholds ─────────────────────────────────────────────────────────

export const SORTING_CRITICAL_MS  = 7 * BH_DAILY_MS; // > 7 business days → critical
export const SORTING_BLOCKED_MS   = 1 * BH_DAILY_MS; // > 1 business day in sorting AND delivery still unpacking

// Waiting stages — excluded from stuck detection, velocity, pressure
export const WAITING_STAGES = new Set<RackStatus>(["ready", "pickup"]);

// Lotting queue: ~4 racks/day capacity; >10 in queue is a problem
export const LOTTING_QUEUE_WARN = 10;

// Pickup capacity per auction cycle: 16 racks
export const PICKUP_WARN       = 13;
export const PICKUP_OVERLOADED = 16;

// ── Types ────────────────────────────────────────────────────────────────────

export interface StageDuration {
  status: RackStatus;
  enteredAt: string;
  exitedAt?: string;
  durationMs: number;     // business milliseconds
  overThreshold: boolean;
}

export interface BottleneckStage {
  status: RackStatus;
  rackCount: number;
  stuckCount: number;
  avgTimeMs: number;
}

// ── Core helpers ─────────────────────────────────────────────────────────────

/** ISO timestamp when this rack entered its current status. */
export function getStatusEntryTime(rack: Rack, history: HistoryEvent[]): string {
  const entry = history
    .filter((e) => e.rackId === rack.id && e.to === rack.status)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  return entry?.timestamp ?? rack.createdAt;
}

/** Business milliseconds the rack has spent in its current status. */
export function getTimeInCurrentStatus(rack: Rack, history: HistoryEvent[]): number {
  return businessDurationNow(getStatusEntryTime(rack, history));
}

/** True if the rack exceeds the per-stage warning threshold (business time). */
export function isRackStuck(rack: Rack, history: HistoryEvent[]): boolean {
  if (rack.status === "completed") return false;
  return getTimeInCurrentStatus(rack, history) > STAGE_THRESHOLDS_MS[rack.status];
}

/**
 * A sorting rack is BLOCKED when:
 * - it has spent > 1 business day in sorting, AND
 * - its delivery still has racks in intake or unpacking
 */
export function isRackBlocked(
  rack: Rack,
  deliveryRacks: Rack[],
  history: HistoryEvent[]
): boolean {
  if (rack.status !== "sorting") return false;
  if (getTimeInCurrentStatus(rack, history) <= SORTING_BLOCKED_MS) return false;
  return deliveryRacks.some(
    (r) => r.id !== rack.id && (r.status === "intake" || r.status === "unpacking")
  );
}

// ── Detailed breakdown ───────────────────────────────────────────────────────

/** Returns per-stage durations in business milliseconds. */
export function getStageDurations(rack: Rack, history: HistoryEvent[]): StageDuration[] {
  const sorted = history
    .filter((e) => e.rackId === rack.id)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const stages: StageDuration[] = [];
  let entryTime = rack.createdAt;

  for (const event of sorted) {
    const durationMs = calculateBusinessDuration(entryTime, event.timestamp);
    stages.push({
      status: event.from,
      enteredAt: entryTime,
      exitedAt: event.timestamp,
      durationMs,
      overThreshold: durationMs > STAGE_THRESHOLDS_MS[event.from],
    });
    entryTime = event.timestamp;
  }

  const currentMs = businessDurationNow(entryTime);
  stages.push({
    status: rack.status,
    enteredAt: entryTime,
    exitedAt: undefined,
    durationMs: currentMs,
    overThreshold:
      rack.status !== "completed" && currentMs > STAGE_THRESHOLDS_MS[rack.status],
  });

  return stages;
}

// ── Stage pressure ───────────────────────────────────────────────────────────

export type PressureLevel = "normal" | "elevated" | "high";

export interface StagePressure {
  status:    RackStatus;
  rackCount: number;
  pressure:  PressureLevel;
}

export function getStagePressure(racks: Rack[]): StagePressure[] {
  const active = racks.filter(
    (r) => r.status !== "completed" && !WAITING_STAGES.has(r.status)
  );
  if (active.length === 0) return [];

  const stages = STATUS_ORDER
    .filter((s) => s !== "completed" && !WAITING_STAGES.has(s))
    .map((status) => ({
      status,
      rackCount: active.filter((r) => r.status === status).length,
    }));

  const occupied = stages.filter((s) => s.rackCount > 0);
  const mean = active.length / (occupied.length || 1);

  return stages
    .filter((s) => s.rackCount > 0)
    .map((s) => {
      const ratio = s.rackCount / mean;
      const pressure: PressureLevel =
        ratio > 2.5 || s.rackCount > 5 ? "high"
        : ratio > 1.5                  ? "elevated"
        : "normal";
      return { ...s, pressure };
    })
    .filter((s) => s.pressure !== "normal");
}

// ── Stage velocity ───────────────────────────────────────────────────────────

export interface StageVelocity {
  status: RackStatus;
  rackCount: number;
  avgTimeMs: number;    // business milliseconds
  threshold: number;
  fillRatio: number;
  overThreshold: boolean;
}

export function getStageVelocity(racks: Rack[], history: HistoryEvent[]): StageVelocity[] {
  return STATUS_ORDER.flatMap((status) => {
    if (status === "completed" || WAITING_STAGES.has(status)) return [];
    const inStage = racks.filter((r) => r.status === status);
    if (inStage.length === 0) return [];
    const threshold = STAGE_THRESHOLDS_MS[status];
    const avgTimeMs = Math.round(
      inStage.reduce((sum, r) => sum + getTimeInCurrentStatus(r, history), 0) / inStage.length
    );
    return [{
      status,
      rackCount:     inStage.length,
      avgTimeMs,
      threshold,
      fillRatio:     Math.min(avgTimeMs / threshold, 1),
      overThreshold: avgTimeMs > threshold,
    }];
  });
}

// ── Dashboard summary ────────────────────────────────────────────────────────

export function getBottleneckSummary(
  racks: Rack[],
  history: HistoryEvent[]
): BottleneckStage[] {
  return STATUS_ORDER.flatMap((status) => {
    if (status === "completed") return [];
    const inStage = racks.filter((r) => r.status === status);
    if (inStage.length === 0) return [];
    const stuckCount = inStage.filter((r) => isRackStuck(r, history)).length;
    const avgTimeMs = Math.round(
      inStage.reduce((sum, r) => sum + getTimeInCurrentStatus(r, history), 0) /
        inStage.length
    );
    return [{ status, rackCount: inStage.length, stuckCount, avgTimeMs }];
  });
}
