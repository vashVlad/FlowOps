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
import type { Rack } from "@/types";

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

// ── PU floor plan ─────────────────────────────────────────────────────────────

// Human-readable label for each slot, shown as a badge on placed rack cards
const CELL_LABEL: Record<string, string> = {
  "r6-1": "R6·1", "r6-2": "R6·2", "r6-3": "R6·3", "r6-4": "R6·4",
  "r5-1": "R5·1", "r5-2": "R5·2", "r5-3": "R5·3", "r5-4": "R5·4",
  "r4-1": "R4·1", "r4-2": "R4·2", "r4-3": "R4·3", "r4-4": "R4·4",
  "r3-1": "R3·1",
  "r2-1": "R2·1", "r2-2": "R2·2", "r2-3": "R2·3", "r2-4": "R2·4",
  "r1-1": "R1·1", "r1-2": "R1·2", "r1-3": "R1·3", "r1-4": "R1·4",
  "r54-f": "R5–R4", "r21-f": "R2–R1",
};

function PUFloorPlan({
  racks,
  placedRacks,
  draggingId,
  searchQuery,
  auctionEditId,
  editColor,
  editDate,
  onDrop,
  onClear,
  onSearchChange,
  onDragStart,
  onDragEnd,
  onAuctionEdit,
  onAuctionColorChange,
  onAuctionDateChange,
  onAuctionSave,
  onAuctionCancel,
}: {
  racks: Rack[];
  placedRacks: Record<string, string>;
  draggingId: string | null;
  searchQuery: string;
  auctionEditId: string | null;
  editColor: string;
  editDate: string;
  onDrop: (cellId: string) => void;
  onClear: (cellId: string) => void;
  onSearchChange: (q: string) => void;
  onDragStart: (rackId: string) => void;
  onDragEnd: () => void;
  onAuctionEdit: (rack: Rack) => void;
  onAuctionColorChange: (color: string) => void;
  onAuctionDateChange: (date: string) => void;
  onAuctionSave: () => void;
  onAuctionCancel: () => void;
}) {
  const [over, setOver] = useState<string | null>(null);

  // cellId → Rack
  const cellRack: Record<string, Rack | undefined> = {};
  for (const [cellId, rackId] of Object.entries(placedRacks)) {
    cellRack[cellId] = racks.find((r) => r.id === rackId);
  }

  // Reverse: rackId → cellId
  const rackCell: Record<string, string> = {};
  for (const [cellId, rackId] of Object.entries(placedRacks)) {
    rackCell[rackId] = cellId;
  }

  const q = searchQuery.trim().toLowerCase();
  function isMatch(r: Rack | undefined): boolean {
    if (!q || !r) return false;
    return r.rackCode.toLowerCase().includes(q) || r.consignerName.toLowerCase().includes(q);
  }

  function clearBtn(id: string) {
    return (
      <button
        key={`x-${id}`}
        onClick={(e) => { e.stopPropagation(); onClear(id); }}
        className="absolute top-1 right-1 text-stone-300 hover:text-red-500 transition-colors"
      >
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    );
  }

  function slotCls(id: string, extra = "") {
    const placed     = cellRack[id];
    const isOver     = over === id && !!draggingId;
    const matched    = isMatch(placed);
    const isDragging = !!placed && draggingId === placed.id;
    return `rounded-lg border self-start flex flex-col items-center justify-center relative overflow-hidden transition-all ${extra} ${
      placed ? "cursor-grab active:cursor-grabbing" : ""
    } ${
      isDragging ? "opacity-40 border-violet-200 bg-violet-50" :
      matched    ? "border-violet-500 bg-violet-100 ring-2 ring-violet-400 animate-pulse" :
      isOver     ? "border-violet-400 bg-violet-100 ring-1 ring-violet-300" :
      placed     ? "border-violet-300 bg-violet-100/60" :
                   "border-dashed border-stone-300 bg-stone-50 hover:border-violet-300 hover:bg-violet-50/40"
    }`;
  }

  function slotHandlers(id: string) {
    return {
      onDragOver:  (e: React.DragEvent) => { e.preventDefault(); setOver(id); },
      onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); },
      onDrop:      (e: React.DragEvent) => { e.preventDefault(); setOver(null); onDrop(id); },
    };
  }

  function slotContent(id: string) {
    const placed = cellRack[id];
    if (!placed) return null;
    const dateLabel = placed.auctionDate
      ? new Date(placed.auctionDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : null;
    return (
      <>
        <div className="flex flex-col items-center gap-0.5 px-1.5 w-full overflow-hidden">
          <p className="text-[11px] font-mono font-bold text-violet-800 text-center leading-tight truncate w-full">{placed.rackCode}</p>
          {(placed.auctionColor || dateLabel) && (
            <div className="flex items-center gap-1 mt-0.5">
              {placed.auctionColor && (
                <span className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-white/60" style={{ backgroundColor: placed.auctionColor }} />
              )}
              {dateLabel && <span className="text-[8px] text-violet-400 leading-none">{dateLabel}</span>}
            </div>
          )}
        </div>
        {clearBtn(id)}
      </>
    );
  }

  function slot(id: string, h: string) {
    const placed = cellRack[id];
    return (
      <div
        key={id}
        className={slotCls(id, h)}
        draggable={!!placed}
        onDragStart={placed ? () => onDragStart(placed.id) : undefined}
        onDragEnd={placed ? onDragEnd : undefined}
        {...slotHandlers(id)}
      >
        {slotContent(id)}
      </div>
    );
  }

  function footerSlot(id: string) {
    const placed = cellRack[id];
    return (
      <div
        key={id}
        className={slotCls(id, "col-span-2 h-16")}
        draggable={!!placed}
        onDragStart={placed ? () => onDragStart(placed.id) : undefined}
        onDragEnd={placed ? onDragEnd : undefined}
        {...slotHandlers(id)}
      >
        {slotContent(id)}
      </div>
    );
  }

  return (
    <div className="flex gap-3 h-full min-h-0">

      {/* ── LEFT PANEL: search + rack cards ───────────────────────────────── */}
      <div className="w-80 shrink-0 flex flex-col gap-3 min-h-0 rounded-xl border border-stone-200 bg-white shadow-sm p-4">

        {/* Search */}
        <div className="relative shrink-0">
          <svg viewBox="0 0 24 24" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search rack…"
            className="w-full rounded-lg border border-stone-200 bg-stone-50 pl-8 pr-7 py-1.5 text-xs text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-shadow"
          />
          {searchQuery && (
            <button onClick={() => onSearchChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-600 transition-colors">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 shrink-0">
          {racks.length} rack{racks.length !== 1 ? "s" : ""} · drag to layout →
        </p>

        {/* Scrollable rack cards */}
        <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0 pr-0.5">
          {racks.map((r) => {
            const cell      = rackCell[r.id];
            const matched   = isMatch(r);
            const isEditing = auctionEditId === r.id;
            const dateLabel = r.auctionDate
              ? new Date(r.auctionDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : null;
            return (
              <div
                key={r.id}
                draggable={!isEditing}
                onDragStart={!isEditing ? () => onDragStart(r.id) : undefined}
                onDragEnd={!isEditing ? onDragEnd : undefined}
                className={`select-none rounded-lg border transition-all ${
                  isEditing ? "border-violet-400 bg-violet-50 cursor-default" :
                  matched   ? "cursor-grab border-violet-500 bg-violet-50 ring-1 ring-violet-300 animate-pulse" :
                  cell      ? "cursor-grab border-violet-300 bg-violet-50" :
                              "cursor-grab border-stone-200 bg-white hover:border-violet-200 hover:bg-violet-50/40"
                } ${draggingId === r.id ? "opacity-40" : ""}`}
              >
                {/* ── card top row ── */}
                <div className="flex items-center gap-2 p-2.5">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-stone-300 shrink-0" fill="currentColor" stroke="none">
                    <circle cx="9"  cy="5"  r="1.3" /><circle cx="9"  cy="12" r="1.3" /><circle cx="9"  cy="19" r="1.3" />
                    <circle cx="15" cy="5"  r="1.3" /><circle cx="15" cy="12" r="1.3" /><circle cx="15" cy="19" r="1.3" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {r.auctionColor && <span className="h-2 w-2 rounded-full shrink-0 ring-1 ring-stone-100" style={{ backgroundColor: r.auctionColor }} />}
                      <p className={`font-mono text-xs font-bold truncate ${matched || cell ? "text-violet-800" : "text-stone-900"}`}>{r.rackCode}</p>
                    </div>
                    <p className="text-[10px] text-stone-400 truncate leading-tight mt-0.5">{r.consignerName}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {cell ? (
                      <span className="text-[9px] font-mono font-semibold text-violet-600 bg-violet-100 rounded px-1.5 py-0.5 leading-none">
                        {CELL_LABEL[cell] ?? cell}
                      </span>
                    ) : (
                      <StatusBadge status={r.status} />
                    )}
                    {/* auction edit toggle */}
                    <button
                      onClick={(e) => { e.stopPropagation(); isEditing ? onAuctionCancel() : onAuctionEdit(r); }}
                      className={`p-1 rounded transition-colors ${isEditing ? "text-violet-500 bg-violet-100" : "text-stone-300 hover:text-violet-500"}`}
                      title="Set auction color & date"
                    >
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* ── auction date strip ── */}
                {!isEditing && dateLabel && (
                  <div className="px-2.5 pb-2 -mt-1">
                    <span className="text-[10px] text-stone-400">{dateLabel}</span>
                  </div>
                )}

                {/* ── inline auction editor ── */}
                {isEditing && (
                  <div className="px-2.5 pb-2.5 space-y-2 border-t border-violet-200 pt-2.5 mt-0">
                    <AuctionColorPicker value={editColor} onChange={onAuctionColorChange} />
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => onAuctionDateChange(e.target.value)}
                      className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-shadow"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onAuctionSave(); }}
                        className="flex-1 rounded-lg bg-violet-600 py-1.5 text-xs font-medium text-white hover:bg-violet-700 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onAuctionCancel(); }}
                        className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-500 hover:bg-stone-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT PANEL: floor plan ────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col rounded-xl border border-violet-100 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-stone-100 shrink-0 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Pick-Up Layout</p>
          {draggingId && <p className="text-[10px] text-violet-500 animate-pulse">Drop onto a slot</p>}
        </div>
        <div className="flex-1 overflow-auto flex items-center justify-center p-5 min-h-0">
          <div
            className="w-fit"
            style={{ display: "grid", gridTemplateColumns: "80px 44px 80px 80px 112px 80px 80px", gap: "10px" }}
          >
            {/* Column headers */}
            <div className="text-center text-[10px] font-semibold text-stone-400">R6</div>
            <div />
            <div className="col-span-2 text-center text-[10px] font-semibold text-stone-400">R5 / R4</div>
            <div className="text-center text-[10px] font-semibold text-stone-400">R3</div>
            <div className="col-span-2 text-center text-[10px] font-semibold text-stone-400">R2 / R1</div>

            {/* Row 1 — R3 is landscape: 112 px wide × h-20 tall */}
            {slot("r6-1", "h-28")} <div />
            {slot("r5-1", "h-28")} {slot("r4-1", "h-28")}
            {slot("r3-1", "h-20")}
            {slot("r2-1", "h-28")} {slot("r1-1", "h-28")}

            {/* Rows 2–4 */}
            {[2, 3, 4].flatMap((row) => [
              slot(`r6-${row}`, "h-28"),
              <div key={`gap-${row}`} />,
              slot(`r5-${row}`, "h-28"),
              slot(`r4-${row}`, "h-28"),
              <div key={`r3e-${row}`} />,
              slot(`r2-${row}`, "h-28"),
              slot(`r1-${row}`, "h-28"),
            ])}

            {/* Footer */}
            <div /> <div />
            {footerSlot("r54-f")}
            <div />
            {footerSlot("r21-f")}
          </div>
        </div>
      </div>

    </div>
  );
}

// ── Zone detail page ───────────────────────────────────────────────────────────

export default function ZoneDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { zones, updateZone } = useZonesStore();
  const { racks, history, advanceStatus, updateRack } = useRacksStore();
  const { deliveries, addDelivery } = useDeliveriesStore();

  // ── Edit form state ────────────────────────────────────────────────────────
  const [editing, setEditing]                   = useState(false);
  const [editLabel, setEditLabel]               = useState("");
  const [editCapacity, setEditCapacity]         = useState("");
  const [editDeliveryId, setEditDeliveryId]     = useState("");
  const [editReserved, setEditReserved]         = useState(false);
  const [editAuctionColor, setEditAuctionColor] = useState("");
  const [editError, setEditError]               = useState("");

  // ── PU floor plan drag + search state ────────────────────────────────────
  const [draggingId,    setDraggingId]    = useState<string | null>(null);
  const [puSearch,      setPuSearch]      = useState("");
  const [auctionEditId, setAuctionEditId] = useState<string | null>(null);
  const [editColor,     setEditColor]     = useState("");
  const [editDate,      setEditDate]      = useState("");

  // Derived from store — cellId → rackId (source of truth is rack.puPosition in DB)
  const placedRacks = Object.fromEntries(
    racks
      .filter((r) => r.zoneId === id && r.puPosition)
      .map((r) => [r.puPosition!, r.id])
  );

  async function handleCellDrop(cellId: string) {
    if (!draggingId) return;
    // Evict whoever was previously in this cell
    const evicted = racks.find((r) => r.zoneId === id && r.puPosition === cellId && r.id !== draggingId);
    if (evicted) await updateRack(evicted.id, { puPosition: null });
    await updateRack(draggingId, { puPosition: cellId });
  }

  async function handleCellClear(cellId: string) {
    const rack = racks.find((r) => r.zoneId === id && r.puPosition === cellId);
    if (rack) await updateRack(rack.id, { puPosition: null });
  }

  function openAuctionEdit(rack: { id: string; auctionColor?: string; auctionDate?: string }) {
    setAuctionEditId(rack.id);
    setEditColor(rack.auctionColor ?? "");
    setEditDate(rack.auctionDate ?? "");
  }

  async function handleAuctionSave() {
    if (!auctionEditId) return;
    await updateRack(auctionEditId, {
      auctionColor: editColor || null,
      auctionDate:  editDate  || null,
    });
    setAuctionEditId(null);
  }

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
        <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors">
          ← Zones
        </button>
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

  // ── PU: full-screen two-panel layout ─────────────────────────────────────
  if (zone.name === "PU") {
    return (
      <div className="flex flex-col gap-3" style={{ height: "calc(100dvh - 84px)" }}>
        {/* top bar */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button onClick={() => router.back()} className="text-sm text-stone-400 hover:text-stone-700 transition-colors">← Zones</button>
          <span className="text-stone-300 select-none">·</span>
          <h1 className="text-sm font-bold text-violet-700">Pick-Up</h1>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            healthLevel === "critical" ? "bg-orange-100 text-orange-600" :
            healthLevel === "warn"     ? "bg-amber-100 text-amber-600"   :
            "bg-emerald-100 text-emerald-600"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              healthLevel === "critical" ? "bg-orange-500 animate-pulse" :
              healthLevel === "warn"     ? "bg-amber-400" : "bg-emerald-400"
            }`} />
            {count} rack{count !== 1 ? "s" : ""} · {healthLabel}
          </span>

          {/* ── Zone auction color + date ── */}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-stone-400">Auction</span>
            <AuctionColorPicker
              value={zone.auctionColor ?? ""}
              onChange={(hex) => updateZone(zone.id, { auctionColor: hex || null })}
            />
            <input
              type="date"
              defaultValue={zone.auctionDate ?? ""}
              onBlur={(e) => updateZone(zone.id, { auctionDate: e.target.value || null })}
              className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-600 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-shadow"
            />
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <PUFloorPlan
            racks={zoneRacks}
            placedRacks={placedRacks}
            draggingId={draggingId}
            searchQuery={puSearch}
            auctionEditId={auctionEditId}
            editColor={editColor}
            editDate={editDate}
            onDrop={handleCellDrop}
            onClear={handleCellClear}
            onSearchChange={setPuSearch}
            onDragStart={setDraggingId}
            onDragEnd={() => setDraggingId(null)}
            onAuctionEdit={openAuctionEdit}
            onAuctionColorChange={setEditColor}
            onAuctionDateChange={setEditDate}
            onAuctionSave={handleAuctionSave}
            onAuctionCancel={() => setAuctionEditId(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors">
        ← Zones
      </button>

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

      {/* ── Rack list — hidden for PU (layout handles placement) ──────────── */}
      {zone.name !== "PU" && <div>
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
              const isWaiting  = WAITING_STAGES.has(rack.status);
              const stuck      = !isWaiting && isRackNeedsAttention(rack, history);
              const delivery   = deliveries.find((d) => d.id === rack.deliveryId);
              const isPU       = zone.name === "PU";
              const placedCell = isPU
                ? Object.entries(placedRacks).find(([, rid]) => rid === rack.id)?.[0]
                : undefined;
              const sq = puSearch.trim().toLowerCase();
              const searchMatch = isPU && sq && (
                rack.rackCode.toLowerCase().includes(sq) ||
                rack.consignerName.toLowerCase().includes(sq)
              );

              return (
                <li
                  key={rack.id}
                  draggable={isPU}
                  onDragStart={() => setDraggingId(rack.id)}
                  onDragEnd={() => setDraggingId(null)}
                  onClick={() => router.push(`/racks/${rack.id}`)}
                  className={`cursor-pointer rounded-xl border shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150 overflow-hidden ${
                    searchMatch ? "border-violet-400 bg-violet-50 ring-2 ring-violet-300" :
                    placedCell  ? "border-violet-300 bg-violet-50" :
                                  "border-stone-200 bg-white"
                  } ${draggingId === rack.id ? "opacity-50" : ""}`}
                >
                  <div className="px-4 pt-3 pb-2 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {rack.auctionColor && (
                          <span className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-stone-200" style={{ backgroundColor: rack.auctionColor }} />
                        )}
                        <p className="font-mono text-sm font-bold text-stone-900 truncate">{rack.rackCode}</p>
                        {stuck && <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] text-red-400 shrink-0">delayed</span>}
                        {rack.priority === "high" && !stuck && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 shrink-0">high</span>}
                        {placedCell && (
                          <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 shrink-0 font-mono">
                            {CELL_LABEL[placedCell] ?? placedCell}
                          </span>
                        )}
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
      </div>}
    </div>
  );
}
