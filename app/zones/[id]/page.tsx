"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useZonesStore } from "@/store/zones";
import { useRacksStore } from "@/store/racks";
import { useDeliveriesStore } from "@/store/deliveries";
import { today } from "@/lib/utils";
import Select from "@/components/Select";
import StatusBadge from "@/components/StatusBadge";
import { StageStrip } from "@/app/racks/page";
import { timeAgo } from "@/lib/utils";
import { formatBusinessDuration } from "@/lib/timeTracking";
import { getZoneOccupancy, FIXED_ZONE_LABELS } from "@/lib/zones";
import AuctionColorPicker from "@/components/ui/AuctionColorPicker";
import { isRackNeedsAttention, getTimeInCurrentStatus, WAITING_STAGES } from "@/lib/timeTracking";
import { OCCUPANCY_STYLE } from "@/lib/tokens";
import { OperationalAlerts, type AlertItem } from "@/components/OperationalAlerts";

const inputCls =
  "w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500";

type PurposeMode = "delivery" | "scheduled" | "auction" | "reserve";

const PURPOSES: { key: PurposeMode; label: string; description: string; border: string; activeBorder: string; bg: string; activeBg: string; text: string; activeText: string }[] = [
  {
    key: "delivery", label: "Active delivery", description: "Arrived or in process",
    border: "border-stone-200", activeBorder: "border-emerald-400",
    bg: "bg-white", activeBg: "bg-emerald-50",
    text: "text-stone-500", activeText: "text-emerald-700",
  },
  {
    key: "scheduled", label: "Scheduled", description: "Upcoming delivery",
    border: "border-stone-200", activeBorder: "border-blue-400",
    bg: "bg-white", activeBg: "bg-blue-50",
    text: "text-stone-500", activeText: "text-blue-700",
  },
  {
    key: "auction", label: "Auction", description: "Lot sale staging",
    border: "border-stone-200", activeBorder: "border-stone-400",
    bg: "bg-white", activeBg: "bg-stone-50",
    text: "text-stone-500", activeText: "text-stone-700",
  },
  {
    key: "reserve", label: "Reserved", description: "Hold, no delivery yet",
    border: "border-stone-200", activeBorder: "border-amber-400",
    bg: "bg-white", activeBg: "bg-amber-50",
    text: "text-stone-500", activeText: "text-amber-700",
  },
];

export default function ZoneDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { zones, updateZone } = useZonesStore();
  const { racks, history, advanceStatus } = useRacksStore();
  const { deliveries, addDelivery } = useDeliveriesStore();

  // ── Edit form state ────────────────────────────────────────────────────────
  const [editing, setEditing]                   = useState(false);
  const [editLabel, setEditLabel]               = useState("");
  const [editCapacity, setEditCapacity]         = useState("");
  const [editDeliveryId, setEditDeliveryId]     = useState("");
  const [editReserved, setEditReserved]         = useState(false);
  const [editAuctionColor, setEditAuctionColor] = useState("");
  const [editError, setEditError]               = useState("");

  // ── Purpose picker state ───────────────────────────────────────────────────
  const [purposeMode, setPurposeMode]               = useState<PurposeMode | null>(null);
  const [purposeDeliveryId, setPurposeDeliveryId]         = useState("");
  const [purposeScheduledConsigner, setPurposeScheduledConsigner] = useState("");
  const [purposeScheduledJNumber, setPurposeScheduledJNumber]     = useState("");
  const [purposeScheduledDate, setPurposeScheduledDate]           = useState(today());
  const [purposeAuctionColor, setPurposeAuctionColor] = useState("#ef4444");
  const [purposeAuctionDate, setPurposeAuctionDate] = useState("");
  const [purposeReserveReason, setPurposeReserveReason] = useState("");
  const [purposeSaving, setPurposeSaving]           = useState(false);

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

  const isFixedZone = !!FIXED_ZONE_LABELS[zone.name];
  const isUtility   = zone.name === "H" || zone.name === "B" || zone.name === "C";
  const isEmpty     = !isFixedZone && !zone.deliveryId && !zone.reserved && !zone.auctionColor;

  const zoneRacks        = racks.filter((r) => r.zoneId === id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const activeRacks      = zoneRacks.filter((r) => r.status !== "completed");
  const processingInZone = activeRacks.filter((r) => !WAITING_STAGES.has(r.status));
  const waitingInZone    = activeRacks.filter((r) => WAITING_STAGES.has(r.status));
  const isWaitingZone    = waitingInZone.length > processingInZone.length;

  const stuckInZone = processingInZone.filter((r) => isRackNeedsAttention(r, history)).length;
  const avgDwellMs  = activeRacks.length > 0
    ? activeRacks.reduce((sum, r) => sum + getTimeInCurrentStatus(r, history), 0) / activeRacks.length
    : null;

  const { count, pct, status } = getZoneOccupancy(zone.id, racks, zones);

  const zoneAlerts: AlertItem[] = [];
  if (status === "full") {
    zoneAlerts.push({ severity: "critical", message: `${zone.name} is at capacity (${count}/${zone.capacity} racks)`, detail: "Move racks to overflow before adding more." });
  } else if (status === "near" && zone.capacity) {
    zoneAlerts.push({ severity: "warning", message: `${zone.name} near capacity — ${zone.capacity - count} spot${zone.capacity - count !== 1 ? "s" : ""} remaining` });
  }
  if (!isWaitingZone && stuckInZone > 0) {
    zoneAlerts.push({ severity: stuckInZone >= 3 ? "critical" : "warning", message: `${stuckInZone} rack${stuckInZone !== 1 ? "s" : ""} delayed in ${zone.name}`, detail: "Review stage timing on rack detail pages.", href: "/racks" });
  }

  const healthLevel = isWaitingZone
    ? status === "full" ? "critical" : status === "near" ? "warn" : "ok"
    : stuckInZone > 0 || status === "full" ? "critical" : status === "near" ? "warn" : "ok";
  const healthLabel = isWaitingZone
    ? healthLevel === "critical" ? "overloaded" : healthLevel === "warn" ? "near capacity" : "healthy"
    : healthLevel === "critical" ? "needs attention" : healthLevel === "warn" ? "near capacity" : "healthy";

  // ── Filtered delivery lists ────────────────────────────────────────────────
  const activeDeliveries = deliveries.filter((d) => ["arrived", "processing"].includes(d.status));

  // ── Purpose picker apply ───────────────────────────────────────────────────
  async function applyPurpose() {
    if (!purposeMode) return;
    setPurposeSaving(true);

    if (purposeMode === "delivery") {
      if (!purposeDeliveryId) { setPurposeSaving(false); return; }
      const d = deliveries.find((del) => del.id === purposeDeliveryId);
      await updateZone(zone!.id, {
        deliveryId: purposeDeliveryId,
        label: d ? (d.consignerJNumber ?? d.consignerName) : undefined,
        reserved: false, auctionColor: null, auctionDate: null,
      });
    }

    if (purposeMode === "scheduled") {
      if (!purposeScheduledConsigner.trim()) { setPurposeSaving(false); return; }
      const result = await addDelivery({
        type: "scheduled",
        consignerName: purposeScheduledConsigner.trim(),
        consignerJNumber: purposeScheduledJNumber.trim() || undefined,
        scheduledDate: purposeScheduledDate || today(),
      });
      if (result.ok) {
        const d = result.data;
        await updateZone(zone!.id, {
          deliveryId: d.id,
          label: d.consignerJNumber ?? d.consignerName,
          reserved: false, auctionColor: null, auctionDate: null,
        });
      }
    }

    if (purposeMode === "auction") {
      await updateZone(zone!.id, {
        deliveryId: null, reserved: false,
        auctionColor: purposeAuctionColor,
        auctionDate: purposeAuctionDate || null,
      });
    }

    if (purposeMode === "reserve") {
      await updateZone(zone!.id, {
        deliveryId: null, reserved: true,
        label: purposeReserveReason.trim() || undefined,
        auctionColor: null, auctionDate: null,
      });
    }

    setPurposeSaving(false);
    setPurposeMode(null);
  }

  // ── Clear zone purpose ─────────────────────────────────────────────────────
  async function clearPurpose() {
    await updateZone(zone!.id, {
      deliveryId: null,
      reserved: false,
      auctionColor: null,
      auctionDate: null,
      label: undefined,
    });
  }

  // ── Edit form ──────────────────────────────────────────────────────────────
  function openEdit() {
    setEditLabel(zone!.label ?? "");
    setEditCapacity(zone!.capacity ? String(zone!.capacity) : "");
    setEditDeliveryId(zone!.deliveryId ?? "");
    setEditReserved(zone!.reserved ?? false);
    setEditAuctionColor(zone!.auctionColor ?? "");
    setEditError("");
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const cap = editCapacity.trim();
    if (cap !== "" && (isNaN(Number(cap)) || Number(cap) < 1)) return setEditError("Capacity must be a positive number.");
    setEditError("");

    const isFixed  = !!FIXED_ZONE_LABELS[zone!.name];
    const newDel   = editDeliveryId ? deliveries.find((d) => d.id === editDeliveryId) : null;
    const patch: Parameters<typeof updateZone>[1] = {
      capacity:   cap ? Number(cap) : undefined,
      deliveryId: editDeliveryId || null,
    };
    if (!isFixed) {
      patch.label = newDel ? (newDel.consignerJNumber ?? newDel.consignerName) : editLabel.trim() || undefined;
    }
    if (!isUtility) {
      patch.reserved     = editDeliveryId ? false : editReserved;
      patch.auctionColor = editAuctionColor || null;
    }
    const result = await updateZone(zone!.id, patch);
    if (!result.ok) return;
    setEditing(false);
  }

  return (
    <div className="space-y-5">
      <Link href="/zones" className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors">
        ← Zones
      </Link>

      {/* ── Main card ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="h-0.5 bg-orange-500" />
        <div className="p-5">
          {editing ? (
            /* ── Edit form ─────────────────────────────────────────────────── */
            <form onSubmit={handleSave} className="space-y-3">
              <p className="text-sm font-semibold text-stone-900">Edit {zone.name}</p>
              <Select value={editDeliveryId} onChange={(e) => setEditDeliveryId(e.target.value)}>
                <option value="">No delivery assigned</option>
                {deliveries
                  .filter((d) => d.status !== "complete" || d.id === editDeliveryId)
                  .sort((a, b) => a.consignerName.localeCompare(b.consignerName))
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.consignerJNumber ?? d.deliveryCode} — {d.consignerName}
                    </option>
                  ))}
              </Select>
              {!FIXED_ZONE_LABELS[zone.name] && (
                <input type="text" placeholder="Description (optional)" value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)} className={inputCls} autoFocus />
              )}
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
              {!isUtility && (
                <>
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input type="checkbox" checked={editReserved}
                      onChange={(e) => setEditReserved(e.target.checked)}
                      disabled={!!editDeliveryId}
                      className="h-4 w-4 rounded border-stone-300 accent-amber-500 cursor-pointer disabled:opacity-40" />
                    <span className={`text-sm ${editDeliveryId ? "text-stone-400" : "text-stone-600"}`}>
                      Reserved
                      {editDeliveryId && <span className="ml-1.5 text-xs text-stone-400">(cleared when delivery assigned)</span>}
                    </span>
                  </label>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-stone-600">Auction color</p>
                    <AuctionColorPicker value={editAuctionColor} onChange={setEditAuctionColor} />
                  </div>
                </>
              )}
              {editError && <p className="text-xs text-red-500">{editError}</p>}
              <div className="flex gap-2">
                <button type="submit" className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 transition-colors">Save</button>
                <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">Cancel</button>
                <button type="button" onClick={() => { setEditLabel(""); setEditCapacity(""); setEditDeliveryId(""); setEditReserved(false); setEditAuctionColor(""); setEditError(""); }} className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-400 hover:bg-stone-50 transition-colors">Clear</button>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-xl font-bold text-stone-900 tracking-tight">{zone.name}</h1>
                    {!isEmpty && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        healthLevel === "critical" ? "bg-orange-100 text-orange-600" :
                        healthLevel === "warn"     ? "bg-amber-100 text-amber-600"   :
                        "bg-emerald-100 text-emerald-600"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          healthLevel === "critical" ? "bg-orange-500 animate-pulse" :
                          healthLevel === "warn"     ? "bg-amber-400" : "bg-emerald-400"
                        }`} />
                        {healthLabel}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const fixed = FIXED_ZONE_LABELS[zone.name];
                    const d     = deliveries.find((del) => del.id === zone.deliveryId);
                    const text  = fixed ?? (d ? (d.consignerJNumber ?? d.consignerName) : null);
                    return text ? <p className="mt-1 text-sm font-mono text-stone-400">{text}</p> : null;
                  })()}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {!isEmpty && (
                    <div className="text-right">
                      <p className="text-xl font-bold text-stone-900 tabular-nums">
                        {zone.capacity ? `${count}/${zone.capacity}` : count}
                      </p>
                      <p className="text-[11px] text-stone-400">racks{zone.capacity ? "" : " · no limit"}</p>
                    </div>
                  )}
                  <button onClick={openEdit} className="text-xs text-stone-400 hover:text-orange-600 transition-colors">
                    Edit
                  </button>
                </div>
              </div>

              {/* ── Purpose picker — shown only for empty non-utility zones ── */}
              {isEmpty && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Set zone purpose</p>

                  {/* 4 option cards */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {PURPOSES.map((p) => {
                      const active = purposeMode === p.key;
                      return (
                        <button key={p.key} type="button"
                          onClick={() => setPurposeMode(active ? null : p.key)}
                          className={`rounded-xl border-2 px-3 py-3 text-left transition-all duration-150 ${
                            active ? `${p.activeBorder} ${p.activeBg}` : `${p.border} ${p.bg} hover:border-stone-300`
                          }`}>
                          <p className={`text-xs font-semibold leading-tight ${active ? p.activeText : "text-stone-700"}`}>
                            {p.label}
                          </p>
                          <p className={`text-[10px] mt-0.5 leading-tight ${active ? p.activeText : p.text}`}>
                            {p.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Form fields for selected purpose */}
                  {purposeMode === "delivery" && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                      <p className="text-xs font-medium text-emerald-700">Assign active delivery</p>
                      {activeDeliveries.length === 0 ? (
                        <p className="text-xs text-stone-400">No arrived or processing deliveries found.</p>
                      ) : (
                        <Select value={purposeDeliveryId} onChange={(e) => setPurposeDeliveryId(e.target.value)}>
                          <option value="">Select delivery…</option>
                          {activeDeliveries.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.consignerJNumber ?? d.deliveryCode} — {d.consignerName} ({d.status})
                            </option>
                          ))}
                        </Select>
                      )}
                      <button onClick={applyPurpose} disabled={!purposeDeliveryId || purposeSaving}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors">
                        {purposeSaving ? "Saving…" : "Assign"}
                      </button>
                    </div>
                  )}

                  {purposeMode === "scheduled" && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
                      <p className="text-xs font-medium text-blue-700">Schedule a delivery for this zone</p>
                      <input type="text" placeholder="Consigner name" value={purposeScheduledConsigner}
                        onChange={(e) => setPurposeScheduledConsigner(e.target.value)}
                        className={inputCls} autoFocus />
                      <input type="text" placeholder="J-Number (optional)" value={purposeScheduledJNumber}
                        onChange={(e) => setPurposeScheduledJNumber(e.target.value)}
                        className={inputCls} />
                      <div className="space-y-1">
                        <label className="text-xs text-blue-700">Scheduled date <span className="text-blue-400">(optional)</span></label>
                        <input type="date" value={purposeScheduledDate}
                          onChange={(e) => setPurposeScheduledDate(e.target.value)}
                          className={inputCls} />
                      </div>
                      <button onClick={applyPurpose} disabled={!purposeScheduledConsigner.trim() || purposeSaving}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 transition-colors">
                        {purposeSaving ? "Saving…" : "Schedule"}
                      </button>
                    </div>
                  )}

                  {purposeMode === "auction" && (
                    <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
                      <p className="text-xs font-medium text-stone-700">Set auction zone</p>
                      <div className="space-y-1.5">
                        <p className="text-xs text-stone-600">Color</p>
                        <AuctionColorPicker value={purposeAuctionColor} onChange={setPurposeAuctionColor} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-stone-600">Auction date <span className="text-stone-400">(optional)</span></label>
                        <input type="date" value={purposeAuctionDate}
                          onChange={(e) => setPurposeAuctionDate(e.target.value)}
                          className={inputCls} />
                      </div>
                      <button onClick={applyPurpose} disabled={purposeSaving}
                        className="rounded-lg bg-stone-700 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-40 transition-colors">
                        {purposeSaving ? "Saving…" : "Set auction"}
                      </button>
                    </div>
                  )}

                  {purposeMode === "reserve" && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                      <p className="text-xs font-medium text-amber-700">Reserve this zone</p>
                      <input type="text" placeholder="Reason (optional — e.g. Holding for Whitmore)"
                        value={purposeReserveReason}
                        onChange={(e) => setPurposeReserveReason(e.target.value)}
                        className={inputCls} autoFocus />
                      <button onClick={applyPurpose} disabled={purposeSaving}
                        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-40 transition-colors">
                        {purposeSaving ? "Saving…" : "Reserve zone"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Current purpose pill + clear — shown when zone has a purpose */}
              {!isEmpty && !isFixedZone && (
                <div className="flex items-center gap-2 pt-1">
                  {zone.reserved && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Reserved{zone.label ? ` · ${zone.label}` : ""}
                    </span>
                  )}
                  {zone.auctionColor && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                      <span className="h-3 w-3 rounded-full ring-1 ring-stone-200" style={{ backgroundColor: zone.auctionColor }} />
                      Auction{zone.auctionDate ? ` · ${new Date(zone.auctionDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                    </span>
                  )}
                  <button onClick={clearPurpose}
                    className="text-xs text-stone-400 hover:text-red-500 transition-colors ml-auto">
                    Clear purpose
                  </button>
                </div>
              )}

              {/* Stats — hidden for empty zones */}
              {!isEmpty && (
                <>
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
                    </div>
                  )}

                  <div className="flex divide-x divide-stone-100 border-t border-stone-100 pt-4">
                    {isWaitingZone ? (
                      <div className="flex-1 text-center pr-4">
                        <p className={`text-base font-bold tabular-nums ${zone.capacity && count >= zone.capacity ? "text-red-600" : "text-stone-800"}`}>
                          {zone.capacity ? `${count}/${zone.capacity}` : count}
                        </p>
                        <p className="text-[11px] text-stone-400 mt-0.5">capacity</p>
                      </div>
                    ) : (
                      <div className="flex-1 text-center pr-4">
                        <p className={`text-base font-bold tabular-nums ${stuckInZone > 0 ? "text-orange-600" : "text-stone-800"}`}>{stuckInZone}</p>
                        <p className="text-[11px] text-stone-400 mt-0.5">stuck</p>
                      </div>
                    )}
                    <div className="flex-1 text-center px-4">
                      <p className="text-base font-bold text-stone-800 tabular-nums">{activeRacks.length}</p>
                      <p className="text-[11px] text-stone-400 mt-0.5">active</p>
                    </div>
                    <div className="flex-1 text-center pl-4">
                      <p className="text-base font-bold text-stone-800 tabular-nums">
                        {avgDwellMs != null ? formatBusinessDuration(avgDwellMs) : "—"}
                      </p>
                      <p className="text-[11px] text-stone-400 mt-0.5">avg dwell</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <OperationalAlerts alerts={zoneAlerts} />

      {/* ── Rack list ──────────────────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
            Racks in {zone.name} ({count})
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/deliveries"
              className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 shadow-sm transition-colors">
              + Delivery
            </Link>
            <Link href={`/racks?zone=${id}`}
              className="rounded-lg bg-orange-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-orange-700 transition-colors">
              + Rack
            </Link>
          </div>
        </div>

        {count === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white px-5 py-6 shadow-sm text-center space-y-1">
            <p className="text-sm font-medium text-stone-600">No racks in this zone</p>
            <p className="text-xs text-stone-400">Assign racks to this zone from the rack detail page.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {zoneRacks.map((rack) => {
              const isWaiting = WAITING_STAGES.has(rack.status);
              const stuck     = !isWaiting && isRackNeedsAttention(rack, history);
              const delivery  = deliveries.find((d) => d.id === rack.deliveryId);
              return (
                <li key={rack.id} onClick={() => router.push(`/racks/${rack.id}`)}
                  className="cursor-pointer rounded-xl border border-stone-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150 overflow-hidden">
                  <div className="px-4 pt-3 pb-2 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {rack.auctionColor && (
                          <span className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-stone-200" style={{ backgroundColor: rack.auctionColor }} />
                        )}
                        <p className="font-mono text-sm font-bold text-stone-900 truncate">{rack.rackCode}</p>
                        {stuck && <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] text-red-400 shrink-0">delayed</span>}
                        {rack.priority === "high" && !stuck && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 shrink-0">high</span>}
                      </div>
                      <span className="text-[11px] text-stone-400 shrink-0">{timeAgo(rack.updatedAt)}</span>
                    </div>
                    <p className="text-xs text-stone-500 truncate">
                      {rack.consignerName}
                      {delivery?.consignerJNumber && <span className="font-mono font-medium text-stone-700 ml-1.5">{delivery.consignerJNumber}</span>}
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
                        className="rounded-lg bg-orange-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40 transition-colors">
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
