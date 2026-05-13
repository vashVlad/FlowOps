"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRacksStore } from "@/store/racks";
import { useDeliveriesStore } from "@/store/deliveries";
import { useZonesStore } from "@/store/zones";
import { LoadingStatCards } from "@/components/LoadingCards";
import {
  isRackStuck,
  isRackBlocked,
  getStagePressure,
  getStageVelocity,
  getTimeInCurrentStatus,
  STAGE_THRESHOLDS_MS,
  SORTING_CRITICAL_MS,
  WAITING_STAGES,
  LOTTING_QUEUE_WARN,
  PICKUP_WARN,
  PICKUP_OVERLOADED,
} from "@/lib/timeTracking";
import type { StagePressure, StageVelocity } from "@/lib/timeTracking";
import { formatDuration } from "@/lib/utils";
import { formatBusinessDuration } from "@/lib/timeTracking";
import { calculateBusinessDuration } from "@/lib/businessTime";
import {
  PIPELINE_STAGES,
  STAGE_BAR,
  KPI_ACCENT,
  OCCUPANCY_STYLE,
} from "@/lib/tokens";
import { FIXED_ZONE_LABELS } from "@/lib/zones";
import PageHeader from "@/components/ui/PageHeader";
import Card, { SectionLabel } from "@/components/ui/Card";
import { buildIntakeForecast, type ForecastItem } from "@/lib/consigners";
import { useConnectionStore } from "@/store/connection";
import type { Rack, Zone, Delivery } from "@/types";

const STAGE_HREF: Partial<Record<string, string>> = { lotting: "/lotting" };
function stageHref(status: string): string {
  return STAGE_HREF[status] ?? "/racks";
}

function businessDaysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  if (target < now) return -1;
  let days = 0;
  const cur = new Date(now);
  while (cur <= target) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) days++;
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function formatAuctionDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { racks, history, loading: racksLoading } = useRacksStore();
  const { deliveries, loading: deliveriesLoading } = useDeliveriesStore();
  const { zones }     = useZonesStore();
  const connStatus    = useConnectionStore((s) => s.status);

  const isLoading = racksLoading || deliveriesLoading;

  const activeDeliveries = deliveries.filter((d) => d.status !== "complete").length;
  const activeRacks      = racks.filter((r) => r.status !== "completed");
  const inPipeline       = activeRacks.length;
  const inLotting        = racks.filter((r) => r.status === "lotting").length;
  const readyForPickup   = racks.filter((r) => r.status === "pickup").length;

  // Held racks
  const heldRacks = activeRacks.filter((r) => !!r.holdReason);
  const heldCount = heldRacks.length;

  // Stuck count: exclude held racks + waiting stages
  const stuckCount = activeRacks.filter(
    (r) => !r.holdReason && !WAITING_STAGES.has(r.status) && isRackStuck(r, history)
  ).length;

  const H24 = 24 * 60 * 60 * 1000;
  const H48 = 48 * 60 * 60 * 1000;
  const now  = Date.now();

  const throughput24h = history.filter(
    (e) => e.to === "completed" && now - new Date(e.timestamp).getTime() < H24
  ).length;
  const throughputYesterday = history.filter(
    (e) => e.to === "completed" &&
      now - new Date(e.timestamp).getTime() >= H24 &&
      now - new Date(e.timestamp).getTime() < H48
  ).length;
  const throughputDelta = throughput24h - throughputYesterday;

  const stageEfficiency = inPipeline > 0
    ? Math.round((1 - stuckCount / inPipeline) * 100)
    : 100;

  const completedRacks = racks.filter((r) => r.status === "completed");
  const avgDwellMs = completedRacks.length > 0
    ? completedRacks.reduce(
        (s, r) => s + calculateBusinessDuration(r.createdAt, r.updatedAt),
        0
      ) / completedRacks.length
    : null;

  const processingStuckRacks = activeRacks.filter(
    (r) => !r.holdReason && !WAITING_STAGES.has(r.status) && isRackStuck(r, history)
  );
  const blockedMs = processingStuckRacks.reduce((sum, r) => {
    const t = getTimeInCurrentStatus(r, history);
    return sum + Math.max(0, t - STAGE_THRESHOLDS_MS[r.status]);
  }, 0);

  // ── Typed operational alerts ──────────────────────────────────────────────
  const sortingRacks = activeRacks.filter((r) => r.status === "sorting");
  const pickupCount  = racks.filter((r) => r.status === "pickup").length;

  const sortingBlockedRacks = sortingRacks.filter((r) => {
    if (r.holdReason) return false;
    const deliveryRacks = racks.filter((d) => d.deliveryId === r.deliveryId);
    return isRackBlocked(r, deliveryRacks, history);
  });
  const blockedIds = new Set(sortingBlockedRacks.map((r) => r.id));

  const sortingCriticalCount = sortingRacks.filter((r) => {
    if (blockedIds.has(r.id) || r.holdReason) return false;
    return getTimeInCurrentStatus(r, history) > SORTING_CRITICAL_MS;
  }).length;

  const sortingWarnCount = sortingRacks.filter((r) => {
    if (blockedIds.has(r.id) || r.holdReason) return false;
    const t = getTimeInCurrentStatus(r, history);
    return t > STAGE_THRESHOLDS_MS["sorting"] && t <= SORTING_CRITICAL_MS;
  }).length;

  // ── Auction urgency ───────────────────────────────────────────────────────
  const urgentAuctionDeliveries = deliveries
    .filter((d) => {
      if (!d.auctionDate || d.status === "complete") return false;
      const days = businessDaysUntil(d.auctionDate);
      if (days < 0 || days > 3) return false;
      const linked = racks.filter((r) => r.deliveryId === d.id);
      return linked.some((r) => !["ready", "pickup", "completed"].includes(r.status));
    })
    .map((d) => ({
      delivery:      d,
      daysLeft:      businessDaysUntil(d.auctionDate!),
      notReadyCount: racks.filter(
        (r) => r.deliveryId === d.id && !["ready", "pickup", "completed"].includes(r.status)
      ).length,
    }));

  const forecastItems = buildIntakeForecast(deliveries, racks);

  const [velocity, setVelocity] = useState<StageVelocity[]>([]);

  useEffect(() => {
    setVelocity(getStageVelocity(racks, history));
  }, [racks, history]);

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <PageHeader
        title="Operations"
        subtitle={throughput24h > 0
          ? `${throughput24h} rack${throughput24h !== 1 ? "s" : ""} completed today · live`
          : "Live warehouse overview · live"}
        action={
          <div className="flex items-center gap-2">
            {heldCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                {heldCount} on hold
              </span>
            )}
            {stuckCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-medium text-red-600">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                {stuckCount} stuck
              </span>
            )}
            {connStatus === "connected" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            )}
            {connStatus === "connecting" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                Connecting
              </span>
            )}
            {connStatus === "disconnected" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                Offline
              </span>
            )}
          </div>
        }
      />

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <LoadingStatCards />
      ) : (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_1.5fr_1fr] lg:gap-5 lg:items-start">

          {/* ── LEFT: operational metrics ─────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2.5">
              <KpiCard label="Active deliveries" value={activeDeliveries} href="/deliveries" accent="orange" />
              <KpiCard label="In pipeline"       value={inPipeline}       href="/racks"      accent="stone"  />
              <KpiCard label="In lotting"        value={inLotting}        href="/lotting"    accent="amber"  />
              <KpiCard label="Ready for pickup"  value={readyForPickup}   href="/racks"      accent="violet" />
            </div>

            <AnalyticsStrip
              throughput={throughput24h}
              throughputDelta={throughputDelta}
              efficiency={stageEfficiency}
              avgDwellMs={avgDwellMs}
              blockedMs={blockedMs}
            />

            <DailyBriefing
              throughput={throughput24h}
              heldCount={heldCount}
              stuckCount={stuckCount}
              readyForPickup={readyForPickup}
              inLotting={inLotting}
            />

          </div>

          {/* ── CENTER: warehouse state ──────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            {zones.length > 0 && <ZoneMap zones={zones} racks={racks} deliveries={deliveries} />}
            <PipelineBar racks={racks} />
          </div>

          {/* ── RIGHT: operational intelligence ─────────────────────────── */}
          <div className="flex flex-col gap-4">
            {velocity.length > 0 && <StageVelocityPanel velocity={velocity} />}
            <AlertsPanel
              sortingBlockedCount={sortingBlockedRacks.length}
              sortingCriticalCount={sortingCriticalCount}
              sortingWarnCount={sortingWarnCount}
              lottingCount={inLotting}
              pickupCount={pickupCount}
              heldCount={heldCount}
              urgentAuctionDeliveries={urgentAuctionDeliveries}
              forecastItems={forecastItems}
            />
          </div>

        </div>
      )}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, href, accent = "stone",
}: {
  label: string; value: number; href: string; accent?: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl border border-stone-200 border-l-4 ${KPI_ACCENT[accent] ?? KPI_ACCENT.stone} bg-white px-4 py-4 shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150`}
    >
      <p className="text-3xl font-bold tabular-nums tracking-tight text-stone-900">{value}</p>
      <p className="mt-1 text-xs text-stone-400 leading-tight">{label}</p>
    </Link>
  );
}

// ── Analytics Strip ───────────────────────────────────────────────────────────

function AnalyticsStrip({
  throughput, throughputDelta, efficiency, avgDwellMs, blockedMs,
}: {
  throughput: number;
  throughputDelta: number;
  efficiency: number;
  avgDwellMs: number | null;
  blockedMs: number;
}) {
  const effColor =
    efficiency < 80 ? "text-red-600" :
    efficiency < 90 ? "text-amber-600" :
    "text-emerald-600";

  const deltaLabel =
    throughputDelta > 0 ? `+${throughputDelta} vs yesterday` :
    throughputDelta < 0 ? `${throughputDelta} vs yesterday` :
    "same as yesterday";
  const deltaColor =
    throughputDelta > 0 ? "text-emerald-600" :
    throughputDelta < 0 ? "text-red-500" :
    "text-stone-400";

  return (
    <div className="grid grid-cols-2 gap-3">
      <MetricTile
        label="completed 24h"
        value={String(throughput)}
        sub={deltaLabel}
        subColor={deltaColor}
      />
      <MetricTile
        label="stage efficiency"
        value={`${efficiency}%`}
        valueColor={effColor}
        sub={efficiency >= 90 ? "on target" : efficiency >= 80 ? "moderate" : "high pressure"}
        subColor={effColor}
      />
      <MetricTile
        label="avg dwell time"
        value={avgDwellMs != null ? formatBusinessDuration(avgDwellMs) : "—"}
      />
      <MetricTile
        label="flow blocked"
        value={blockedMs > 0 ? formatBusinessDuration(blockedMs) : "—"}
        valueColor={blockedMs > 0 ? "text-red-600" : "text-stone-900"}
        sub={blockedMs > 0 ? "delay active" : "clear"}
        subColor={blockedMs > 0 ? "text-red-400" : "text-stone-400"}
      />
    </div>
  );
}

function MetricTile({
  label, value, valueColor = "text-stone-900", sub, subColor = "text-stone-400",
}: {
  label: string; value: string; valueColor?: string; sub?: string; subColor?: string;
}) {
  return (
    <Card padding="px-3 py-3">
      <p className={`text-xl font-bold text-center tabular-nums ${valueColor}`}>{value}</p>
      <p className="text-[11px] text-stone-400 mt-1 text-center leading-tight">{label}</p>
      {sub && (
        <p className={`text-[10px] text-center mt-1 leading-tight ${subColor}`}>{sub}</p>
      )}
    </Card>
  );
}

// ── Stage Velocity Panel ──────────────────────────────────────────────────────

function StageVelocityPanel({ velocity }: { velocity: StageVelocity[] }) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Stage Velocity</SectionLabel>
        <p className="text-[10px] text-stone-400">avg vs limit</p>
      </div>
      <div className="space-y-2">
        {velocity.map((s) => {
          const barColor =
            s.fillRatio >= 1   ? "bg-orange-500" :
            s.fillRatio >= 0.7 ? "bg-amber-400"  :
            "bg-emerald-400";
          const timeColor =
            s.overThreshold    ? "text-stone-700"  :
            s.fillRatio >= 0.7 ? "text-stone-600"  :
            "text-stone-400";

          return (
            <div key={s.status} className="flex items-center gap-2.5">
              <span className="w-[68px] text-[11px] text-stone-400 capitalize shrink-0">
                {s.status}
              </span>
              <div className="flex-1 h-1 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${s.fillRatio * 100}%` }}
                />
              </div>
              <span className={`w-12 text-right text-[11px] tabular-nums font-medium shrink-0 ${timeColor}`}>
                {formatBusinessDuration(s.avgTimeMs)}
              </span>
              <span className="w-10 shrink-0 text-right">
                {s.overThreshold ? (
                  <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-600">over</span>
                ) : s.fillRatio >= 0.7 ? (
                  <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-600">watch</span>
                ) : (
                  <span className="text-[10px] text-stone-300">ok</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 pt-1 border-t border-stone-100">
        <span className="flex items-center gap-1 text-[10px] text-stone-400">
          <span className="h-1.5 w-2.5 rounded-full bg-emerald-400" />under
        </span>
        <span className="flex items-center gap-1 text-[10px] text-stone-400">
          <span className="h-1.5 w-2.5 rounded-full bg-amber-400" />watch
        </span>
        <span className="flex items-center gap-1 text-[10px] text-stone-400">
          <span className="h-1.5 w-2.5 rounded-full bg-orange-500" />over
        </span>
      </div>
    </Card>
  );
}

// ── Warehouse Zone Map ────────────────────────────────────────────────────────

function ZoneMap({ zones, racks, deliveries }: { zones: Zone[]; racks: Rack[]; deliveries: Delivery[] }) {
  const byName    = new Map(zones.map((z) => [z.name, z]));
  const occupancy = new Map<string, number>();
  racks.forEach((r) => {
    if (r.zoneId) occupancy.set(r.zoneId, (occupancy.get(r.zoneId) ?? 0) + 1);
  });

  function cell(name: string) {
    const z = byName.get(name);
    if (z) return <ZoneCell key={z.id} zone={z} count={occupancy.get(z.id) ?? 0} assignedDelivery={deliveries.find((d) => d.id === z.deliveryId)} />;
    return (
      <div key={name} className="rounded-lg border border-dashed border-stone-200 p-2 opacity-40">
        <span className="text-xs font-bold text-stone-400 leading-none">{name}</span>
      </div>
    );
  }

  const hasGallery   = ["G4","G5","G6","G7","G2","G1","PU"].some((n) => byName.has(n));
  const hasWarehouse = ["W4","W5","W6","W3","W8","W7","W2","W9","W1","W10","B","C"].some((n) => byName.has(n));
  if (!hasGallery && !hasWarehouse) return null;

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Warehouse Floor</SectionLabel>
        <div className="flex items-center gap-3 text-[10px] text-stone-400">
          <span className="flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${OCCUPANCY_STYLE.ok.dot}`} />ok</span>
          <span className="flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${OCCUPANCY_STYLE.near.dot}`} />near</span>
          <span className="flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${OCCUPANCY_STYLE.full.dot}`} />full</span>
        </div>
      </div>

      {hasGallery && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-stone-400 mb-1.5">Gallery</p>
          <div className="grid grid-cols-4 gap-1.5">
            {cell("G4")} {cell("G5")} {cell("G6")} {cell("G7")}
            {cell("PU")} {cell("G2")} {cell("G1")} <div key="g-empty" />
          </div>
        </div>
      )}

      {hasGallery && hasWarehouse && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-stone-200" />
          <span className="text-[9px] text-stone-300 shrink-0">court</span>
          <div className="flex-1 h-px bg-stone-200" />
        </div>
      )}

      {hasWarehouse && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-stone-400 mb-1.5">Warehouse</p>
          <div className="grid grid-cols-3 gap-1.5">
            {cell("W4")}  {cell("W5")}  {cell("W6")}
            {cell("W3")}  {cell("W8")}  {cell("W7")}
            {cell("W2")}  {cell("W9")}  {cell("B")}
            {cell("W1")}  {cell("W10")} {cell("C")}
          </div>
        </div>
      )}
    </Card>
  );
}

function ZoneCell({ zone, count, assignedDelivery }: { zone: Zone; count: number; assignedDelivery?: Delivery }) {
  const cap   = zone.capacity;
  const pct   = cap ? Math.min(count / cap, 1) : 0;
  const level = !cap ? "none" : pct >= 0.9 ? "full" : pct >= 0.7 ? "near" : "ok";
  const s     = OCCUPANCY_STYLE[level];
  const fixedLabel = FIXED_ZONE_LABELS[zone.name];
  const identity   = fixedLabel
    ? fixedLabel
    : assignedDelivery
    ? (assignedDelivery.consignerJNumber ?? assignedDelivery.consignerName)
    : "Empty";

  return (
    <Link
      href={`/zones/${zone.id}`}
      className={`rounded-lg border p-2 hover:shadow-sm hover:-translate-y-px transition-all duration-150 ${s.border} ${s.bg}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className={`text-xs font-bold leading-none ${s.name}`}>{zone.name}</span>
        <span className="text-xs font-semibold text-stone-700 leading-none">{count}</span>
      </div>
      <p className="text-[9px] text-stone-400 mt-1 leading-tight line-clamp-1 font-mono">{identity}</p>
      {cap && (
        <div className="mt-1.5 h-1 w-full rounded-full bg-white/70 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${s.bar}`} style={{ width: `${pct * 100}%` }} />
        </div>
      )}
    </Link>
  );
}

// ── Pipeline Bar ──────────────────────────────────────────────────────────────

function PipelineBar({ racks }: { racks: Rack[] }) {
  const active = racks.filter((r) => r.status !== "completed");
  if (active.length === 0) return null;

  const pressureMap = new Map(getStagePressure(racks).map((p) => [p.status, p]));

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Pipeline Distribution</SectionLabel>
        <p className="text-[11px] text-stone-400">{active.length} active rack{active.length !== 1 ? "s" : ""}</p>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-stone-100">
        {PIPELINE_STAGES.map(({ status }) => {
          const count = active.filter((r) => r.status === status).length;
          if (count === 0) return null;
          return (
            <div
              key={status}
              className={`h-full ${STAGE_BAR[status]} transition-all`}
              style={{ width: `${(count / active.length) * 100}%` }}
              title={`${status}: ${count}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {PIPELINE_STAGES.map(({ status, label }) => {
          const count    = active.filter((r) => r.status === status).length;
          if (count === 0) return null;
          const pressure = pressureMap.get(status as StagePressure["status"]);
          return (
            <span key={status} className="flex items-center gap-1.5 text-xs">
              <span className={`h-2 w-2 rounded-full shrink-0 ${STAGE_BAR[status]}`} />
              <span className="text-stone-600">{label}</span>
              <span className="text-stone-400">{count}</span>
              {pressure?.pressure === "high" && (
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">overloaded</span>
              )}
              {pressure?.pressure === "elevated" && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">busy</span>
              )}
            </span>
          );
        })}
      </div>
    </Card>
  );
}

// ── Alerts Panel ──────────────────────────────────────────────────────────────

function AlertsPanel({
  sortingBlockedCount,
  sortingCriticalCount,
  sortingWarnCount,
  lottingCount,
  pickupCount,
  heldCount,
  urgentAuctionDeliveries,
  forecastItems,
}: {
  sortingBlockedCount: number;
  sortingCriticalCount: number;
  sortingWarnCount: number;
  lottingCount: number;
  pickupCount: number;
  heldCount: number;
  urgentAuctionDeliveries: { delivery: Delivery; daysLeft: number; notReadyCount: number }[];
  forecastItems: ForecastItem[];
}) {
  const hasAlerts =
    sortingBlockedCount > 0 ||
    sortingCriticalCount > 0 ||
    sortingWarnCount > 0 ||
    lottingCount > LOTTING_QUEUE_WARN ||
    pickupCount >= PICKUP_WARN ||
    heldCount > 0 ||
    urgentAuctionDeliveries.length > 0 ||
    forecastItems.length > 0;

  if (!hasAlerts) {
    return (
      <Card className="flex items-center gap-2.5" padding="px-3.5 py-2.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
        <p className="text-xs text-stone-500">All processing stages flowing.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <SectionLabel>Operational Alerts</SectionLabel>

      {heldCount > 0 && (
        <AlertCard severity="info" href="/racks">
          <p className="text-xs font-medium text-stone-800">
            {heldCount} rack{heldCount !== 1 ? "s" : ""} on hold
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5">
            Intentionally paused — not counted as stuck
          </p>
        </AlertCard>
      )}

      {urgentAuctionDeliveries.map(({ delivery, daysLeft, notReadyCount }) => (
        <AlertCard key={delivery.id} severity="warning" href={`/deliveries/${delivery.id}`}>
          <p className="text-xs font-medium text-stone-800">
            {delivery.consignerJNumber ?? delivery.deliveryCode}: {notReadyCount} rack{notReadyCount !== 1 ? "s" : ""} need Ready before auction
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5">
            Auction {formatAuctionDate(delivery.auctionDate!)} · {daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `${daysLeft}d`}
          </p>
        </AlertCard>
      ))}

      {sortingBlockedCount > 0 && (
        <AlertCard severity="critical" href="/racks">
          <p className="text-xs font-medium text-stone-800">
            {sortingBlockedCount} rack{sortingBlockedCount !== 1 ? "s" : ""} blocked in sorting
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5">
            Waiting on incomplete unpacking from same delivery
          </p>
        </AlertCard>
      )}

      {sortingCriticalCount > 0 && (
        <AlertCard severity="critical" href="/racks">
          <p className="text-xs font-medium text-stone-800">
            {sortingCriticalCount} rack{sortingCriticalCount !== 1 ? "s" : ""} critical in sorting
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5">
            Over 7 days — immediate attention required
          </p>
        </AlertCard>
      )}

      {sortingWarnCount > 0 && (
        <AlertCard severity="warning" href="/racks">
          <p className="text-xs font-medium text-stone-800">
            {sortingWarnCount} rack{sortingWarnCount !== 1 ? "s" : ""} delayed in sorting
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5">
            Over 5 days — review sorting capacity
          </p>
        </AlertCard>
      )}

      {lottingCount > LOTTING_QUEUE_WARN && (
        <AlertCard severity="warning" href="/lotting">
          <p className="text-xs font-medium text-stone-800">
            Lotting queue high ({lottingCount} racks)
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5">
            Exceeds daily capacity — consider additional staff
          </p>
        </AlertCard>
      )}

      {pickupCount >= PICKUP_OVERLOADED && (
        <AlertCard severity="critical" href="/racks">
          <p className="text-xs font-medium text-stone-800">
            Pickup overloaded ({pickupCount}/{PICKUP_OVERLOADED} racks)
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5">
            At full auction cycle capacity
          </p>
        </AlertCard>
      )}

      {pickupCount >= PICKUP_WARN && pickupCount < PICKUP_OVERLOADED && (
        <AlertCard severity="warning" href="/racks">
          <p className="text-xs font-medium text-stone-800">
            Pickup near capacity ({pickupCount}/{PICKUP_OVERLOADED} racks)
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5">
            Schedule auction cycle before adding more lots
          </p>
        </AlertCard>
      )}

      {forecastItems.length > 0 && (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 pt-1">This week</p>
          {forecastItems.map((item, i) => (
            <AlertCard key={i} severity={item.severity} href="/deliveries">
              <p className="text-xs font-medium text-stone-800">{item.message}</p>
              {item.detail && <p className="text-[10px] text-stone-400 mt-0.5">{item.detail}</p>}
            </AlertCard>
          ))}
        </>
      )}
    </div>
  );
}

// ── Daily Briefing ────────────────────────────────────────────────────────────

function DailyBriefing({
  throughput, heldCount, stuckCount, readyForPickup, inLotting,
}: {
  throughput: number;
  heldCount: number;
  stuckCount: number;
  readyForPickup: number;
  inLotting: number;
}) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });

  return (
    <Card padding="px-4 py-3.5" className="space-y-2.5">
      <div className="flex items-center justify-between">
        <SectionLabel>Daily briefing</SectionLabel>
        <span className="text-[11px] text-stone-400">{today}</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-emerald-500 text-[11px] font-mono leading-none">↑</span>
          <span className="text-xs text-stone-700">
            <span className="font-semibold">{throughput}</span>
            {" "}rack{throughput !== 1 ? "s" : ""} completed today
          </span>
        </div>
        {stuckCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-amber-500 text-[11px] font-mono leading-none">⚠</span>
            <span className="text-xs text-stone-700">
              <span className="font-semibold">{stuckCount}</span> delayed in processing
            </span>
          </div>
        )}
        {heldCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-blue-500 text-[11px] font-mono leading-none">⏸</span>
            <span className="text-xs text-stone-700">
              <span className="font-semibold">{heldCount}</span> on hold · pending review
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-stone-400 text-[11px] font-mono leading-none">→</span>
          <span className="text-xs text-stone-600">
            <span className="font-semibold">{readyForPickup}</span> ready for pickup
            {" · "}
            <span className="font-semibold">{inLotting}</span> in lotting
          </span>
        </div>
        {stuckCount === 0 && heldCount === 0 && (
          <div className="flex items-center gap-2">
            <span className="text-emerald-500 text-[11px] font-mono leading-none">✓</span>
            <span className="text-xs text-stone-500">Pipeline flowing normally</span>
          </div>
        )}
      </div>
    </Card>
  );
}

function AlertCard({
  severity, href, children,
}: {
  severity: "critical" | "warning" | "info";
  href: string;
  children: React.ReactNode;
}) {
  const dot    = severity === "critical" ? "bg-red-500 animate-pulse" : severity === "info" ? "bg-blue-500" : "bg-amber-400";
  const border = severity === "critical" ? "border-red-200" : severity === "info" ? "border-blue-200" : "border-amber-200";
  return (
    <Card className={border} padding="px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
          <div className="min-w-0">{children}</div>
        </div>
        <Link
          href={href}
          className="shrink-0 text-[11px] text-stone-400 hover:text-stone-700 transition-colors"
        >
          View →
        </Link>
      </div>
    </Card>
  );
}
