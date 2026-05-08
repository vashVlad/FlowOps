import type { Rack, RackStatus, HistoryEvent } from "@/types";
import { STATUS_ORDER } from "@/lib/racks";

const H = 60 * 60 * 1000;
const D = 24 * H;

// ── Per-stage thresholds (real-world warehouse timing) ───────────────────────

export const STAGE_THRESHOLDS_MS: Record<RackStatus, number> = {
  intake:    4  * H,   // 4h  — quick visibility stage
  unpacking: 6  * H,   // 6h  — a few hours per rack
  sorting:   5  * D,   // 5d  — warning threshold (2–5d = acceptable, >5d = warning)
  lotting:   4  * H,   // 4h  — ~3-4h per rack, high-throughput
  ready:     14 * D,   // 14d — scheduled wait, not a bottleneck
  pickup:    7  * D,   // 7d  — capacity-constrained
  completed: Infinity,
};

// ── Alert thresholds ─────────────────────────────────────────────────────────

export const SORTING_CRITICAL_MS  = 7 * D;   // > 7d → critical
export const SORTING_BLOCKED_MS   = 1 * D;   // > 24h in sorting AND delivery has intake/unpacking racks

// Waiting stages — not flagged as slow; excluded from velocity panel & pressure
export const WAITING_STAGES = new Set<RackStatus>(["ready", "pickup"]);

// Lotting queue: ~4 racks/day capacity; >10 in queue is a problem
export const LOTTING_QUEUE_WARN = 10;

// Pickup capacity per auction cycle: 16 racks
export const PICKUP_WARN       = 13;  // >= 13 → near capacity warning
export const PICKUP_OVERLOADED = 16;  // >= 16 → overloaded

// ── Types ────────────────────────────────────────────────────────────────────

export interface StageDuration {
  status: RackStatus;
  enteredAt: string;
  exitedAt?: string;
  durationMs: number;
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

/** Milliseconds the rack has spent in its current status. */
export function getTimeInCurrentStatus(rack: Rack, history: HistoryEvent[]): number {
  return Date.now() - new Date(getStatusEntryTime(rack, history)).getTime();
}

/** True if the rack exceeds the per-stage warning threshold for its current status. */
export function isRackStuck(rack: Rack, history: HistoryEvent[]): boolean {
  if (rack.status === "completed") return false;
  return getTimeInCurrentStatus(rack, history) > STAGE_THRESHOLDS_MS[rack.status];
}

/**
 * A sorting rack is BLOCKED when:
 * - it has been in sorting for > 24h, AND
 * - its delivery still has racks in intake or unpacking
 *
 * deliveryRacks must be ALL racks sharing the same deliveryId (including the rack itself).
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

export function getStageDurations(rack: Rack, history: HistoryEvent[]): StageDuration[] {
  const sorted = history
    .filter((e) => e.rackId === rack.id)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const stages: StageDuration[] = [];
  let entryTime = rack.createdAt;

  for (const event of sorted) {
    const durationMs =
      new Date(event.timestamp).getTime() - new Date(entryTime).getTime();
    stages.push({
      status: event.from,
      enteredAt: entryTime,
      exitedAt: event.timestamp,
      durationMs,
      overThreshold: durationMs > STAGE_THRESHOLDS_MS[event.from],
    });
    entryTime = event.timestamp;
  }

  const currentMs = Date.now() - new Date(entryTime).getTime();
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

/**
 * Identifies processing stages with disproportionate rack load.
 * Waiting stages (ready, pickup) are excluded — high counts there are expected.
 */
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
  avgTimeMs: number;
  threshold: number;
  fillRatio: number;
  overThreshold: boolean;
}

/**
 * Processing-stage velocity only (ready and pickup excluded — they are
 * scheduled waiting stages, not performance indicators).
 */
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
