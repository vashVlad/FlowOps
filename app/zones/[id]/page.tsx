"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useZonesStore } from "@/store/zones";
import { useRacksStore } from "@/store/racks";
import { useDeliveriesStore } from "@/store/deliveries";
import StatusBadge from "@/components/StatusBadge";
import { StageStrip } from "@/app/racks/page";
import { timeAgo } from "@/lib/utils";
import { formatBusinessDuration } from "@/lib/timeTracking";
import { getZoneOccupancy } from "@/lib/zones";
import { isRackStuck, getTimeInCurrentStatus, WAITING_STAGES } from "@/lib/timeTracking";
import { OCCUPANCY_STYLE } from "@/lib/tokens";

const inputCls =
  "w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500";

export default function ZoneDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { zones, updateZone } = useZonesStore();
  const { racks, history, advanceStatus } = useRacksStore();
  const { deliveries } = useDeliveriesStore();

  const [editing, setEditing]           = useState(false);
  const [editLabel, setEditLabel]       = useState("");
  const [editCapacity, setEditCapacity] = useState("");
  const [editError, setEditError]       = useState("");

  const zone = zones.find((z) => z.id === id);

  if (!zone) {
    return (
      <div className="space-y-4">
        <Link href="/zones" className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors">
          ← Zones
        </Link>
        <div className="rounded-xl border border-stone-200 bg-white px-5 py-6 shadow-sm text-center space-y-1">
          <p className="text-sm font-medium text-stone-700">Zone not found</p>
          <p className="text-xs text-stone-400">It may have been removed or the link is incorrect.</p>
        </div>
      </div>
    );
  }

  const zoneRacks   = racks.filter((r) => r.zoneId === id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const activeRacks      = zoneRacks.filter((r) => r.status !== "completed");
  const processingInZone = activeRacks.filter((r) => !WAITING_STAGES.has(r.status));
  const waitingInZone    = activeRacks.filter((r) => WAITING_STAGES.has(r.status));
  const isWaitingZone    = waitingInZone.length > processingInZone.length;

  const stuckInZone = processingInZone.filter((r) => isRackStuck(r, history)).length;

  const avgDwellMs = activeRacks.length > 0
    ? activeRacks.reduce((sum, r) => sum + getTimeInCurrentStatus(r, history), 0) / activeRacks.length
    : null;

  const { count, pct, status } = getZoneOccupancy(zone.id, racks, zones);

  const healthLevel =
    isWaitingZone
      ? status === "full" ? "critical" : status === "near" ? "warn" : "ok"
      : stuckInZone > 0 || status === "full" ? "critical" : status === "near" ? "warn" : "ok";

  const healthLabel =
    isWaitingZone
      ? healthLevel === "critical" ? "overloaded" : healthLevel === "warn" ? "near capacity" : "healthy"
      : healthLevel === "critical" ? "needs attention" : healthLevel === "warn" ? "near capacity" : "healthy";

  function openEdit() {
    setEditLabel(zone!.label ?? "");
    setEditCapacity(zone!.capacity ? String(zone!.capacity) : "");
    setEditError("");
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const cap = editCapacity.trim();
    if (cap !== "" && (isNaN(Number(cap)) || Number(cap) < 1)) {
      return setEditError("Capacity must be a positive number.");
    }
    setEditError("");
    const result = await updateZone(zone!.id, {
      label:    editLabel.trim() || undefined,
      capacity: cap ? Number(cap) : undefined,
    });
    if (!result.ok) return;
    setEditing(false);
  }

  return (
    <div className="space-y-5">
      <Link href="/zones" className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors">
        ← Zones
      </Link>

      {/* Main card */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="h-0.5 bg-orange-500" />
        <div className="p-5">
          {editing ? (
            <form onSubmit={handleSave} className="space-y-3">
              <p className="text-sm font-semibold text-stone-900">Edit {zone.name}</p>
              <input type="text" placeholder="Description (optional)" value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)} className={inputCls} autoFocus />
              <div className="space-y-1">
                <input type="number" placeholder="Rack capacity (optional)" value={editCapacity}
                  onChange={(e) => setEditCapacity(e.target.value)} min={1} className={inputCls} />
                {editCapacity && (
                  <button type="button" onClick={() => setEditCapacity("")}
                    className="text-xs text-stone-400 hover:text-stone-700 transition-colors">
                    Remove capacity limit
                  </button>
                )}
              </div>
              {editError && <p className="text-xs text-red-500">{editError}</p>}
              <div className="flex gap-2">
                <button type="submit"
                  className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 transition-colors">
                  Save
                </button>
                <button type="button" onClick={() => setEditing(false)}
                  className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              {/* Header row */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-xl font-bold text-stone-900 tracking-tight">{zone.name}</h1>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      healthLevel === "critical" ? "bg-orange-100 text-orange-600" :
                      healthLevel === "warn"     ? "bg-amber-100 text-amber-600"   :
                      "bg-emerald-100 text-emerald-600"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        healthLevel === "critical" ? "bg-orange-500 animate-pulse" :
                        healthLevel === "warn"     ? "bg-amber-400" :
                        "bg-emerald-400"
                      }`} />
                      {healthLabel}
                    </span>
                  </div>
                  {zone.label && <p className="mt-1 text-sm text-stone-400">{zone.label}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-xl font-bold text-stone-900 tabular-nums">
                      {zone.capacity ? `${count}/${zone.capacity}` : count}
                    </p>
                    <p className="text-[11px] text-stone-400">racks{zone.capacity ? "" : " · no limit"}</p>
                  </div>
                  <button onClick={openEdit}
                    className="text-xs text-stone-400 hover:text-orange-600 transition-colors">
                    Edit
                  </button>
                </div>
              </div>

              {/* Capacity bar */}
              {zone.capacity && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">Occupancy</span>
                    <span className="text-xs font-medium text-stone-500">{pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                    <div className={`h-full rounded-full transition-all ${OCCUPANCY_STYLE[status]?.bar ?? "bg-stone-300"}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  {status === "full" && (
                    <p className="text-xs text-orange-600">At capacity — consider moving racks to overflow.</p>
                  )}
                  {status === "near" && (
                    <p className="text-xs text-amber-600">
                      {zone.capacity - count} spot{zone.capacity - count !== 1 ? "s" : ""} remaining.
                    </p>
                  )}
                </div>
              )}

              {/* Operational summary */}
              <div className="flex divide-x divide-stone-100 border-t border-stone-100 pt-4">
                {isWaitingZone ? (
                  <div className="flex-1 text-center pr-4">
                    <p className={`text-base font-bold tabular-nums ${
                      zone.capacity && count >= zone.capacity ? "text-red-600" :
                      zone.capacity && count >= Math.round(zone.capacity * 0.8) ? "text-amber-600" :
                      "text-stone-800"
                    }`}>
                      {zone.capacity ? `${count}/${zone.capacity}` : count}
                    </p>
                    <p className="text-[10px] text-stone-400 mt-0.5">capacity</p>
                  </div>
                ) : (
                  <div className="flex-1 text-center pr-4">
                    <p className={`text-base font-bold tabular-nums ${stuckInZone > 0 ? "text-orange-600" : "text-stone-800"}`}>
                      {stuckInZone}
                    </p>
                    <p className="text-[10px] text-stone-400 mt-0.5">stuck</p>
                  </div>
                )}
                <div className="flex-1 text-center px-4">
                  <p className="text-base font-bold text-stone-800 tabular-nums">{activeRacks.length}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">active</p>
                </div>
                <div className="flex-1 text-center pl-4">
                  <p className="text-base font-bold text-stone-800 tabular-nums">
                    {avgDwellMs != null ? formatBusinessDuration(avgDwellMs) : "—"}
                  </p>
                  <p className="text-[10px] text-stone-400 mt-0.5">avg dwell</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rack list */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
            Racks in {zone.name} ({count})
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/deliveries"
              className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 shadow-sm transition-colors"
            >
              + Delivery
            </Link>
            <Link
              href={`/racks?zone=${id}`}
              className="rounded-lg bg-orange-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-orange-700 transition-colors"
            >
              + Rack
            </Link>
          </div>
        </div>

        {count === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white px-5 py-6 shadow-sm text-center space-y-1">
            <p className="text-sm font-medium text-stone-600">Zone is empty</p>
            <p className="text-xs text-stone-400">Assign racks to this zone from the rack detail page.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {zoneRacks.map((rack) => {
              const isWaiting = WAITING_STAGES.has(rack.status);
              const stuck     = !isWaiting && isRackStuck(rack, history);
              const delivery  = deliveries.find((d) => d.id === rack.deliveryId);
              return (
                <li key={rack.id} onClick={() => router.push(`/racks/${rack.id}`)}
                  className="cursor-pointer rounded-xl border border-stone-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150 overflow-hidden">
                  <div className="px-4 pt-3 pb-2 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="font-mono text-sm font-bold text-stone-900 truncate">{rack.rackCode}</p>
                        {stuck && (
                          <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] text-red-400 shrink-0">delayed</span>
                        )}
                        {rack.priority === "high" && !stuck && (
                          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 shrink-0">high</span>
                        )}
                      </div>
                      <span className="text-[11px] text-stone-400 shrink-0">{timeAgo(rack.updatedAt)}</span>
                    </div>
                    <p className="text-xs text-stone-400 truncate">
                      {rack.consignerName}
                      {delivery?.consignerJNumber && (
                        <span className="font-mono ml-1.5">{delivery.consignerJNumber}</span>
                      )}
                    </p>
                    <StageStrip status={rack.status} />
                  </div>
                  <div className="px-4 pb-3 flex items-center justify-between gap-2">
                    <StatusBadge status={rack.status} />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link href={`/racks/${rack.id}`} onClick={(e) => e.stopPropagation()}
                        className="text-xs text-stone-400 hover:text-orange-600 transition-colors">Edit</Link>
                      <button
                        onClick={(e) => { e.stopPropagation(); advanceStatus(rack.id); }}
                        disabled={rack.status === "completed"}
                        className="rounded-lg bg-orange-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
