"use client";

import { Fragment, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useRacksStore } from "@/store/racks";
import { STATUS_ORDER, HOLD_REASONS } from "@/lib/racks";
import { useDeliveriesStore } from "@/store/deliveries";
import { useZonesStore } from "@/store/zones";
import { useNotesStore } from "@/store/notes";
import { useRackConsignersStore } from "@/store/rackConsigners";
import { useAuthStore } from "@/store/auth";
import StatusBadge from "@/components/StatusBadge";
import { SectionLabel } from "@/components/ui/Card";
import CustomSelect from "@/components/ui/CustomSelect";
import PriorityPicker from "@/components/ui/PriorityPicker";
import { timeAgo, formatTime } from "@/lib/utils";
import { formatBusinessDuration } from "@/lib/timeTracking";
import { getZoneOccupancy } from "@/lib/zones";
import {
  isRackNeedsAttention,
  getStageDurations,
  getTimeInCurrentStatus,
  STAGE_THRESHOLDS_MS,
} from "@/lib/timeTracking";
import { PIPELINE_STAGES, NEXT_STAGE_LABEL, STAGE_LABEL } from "@/lib/tokens";
import { getPrevStatus } from "@/lib/racks";
import AuctionColorPicker from "@/components/ui/AuctionColorPicker";
import { useToastStore } from "@/store/toast";
import { useIsSupervisor } from "@/store/auth";
import { usePrintQueueStore } from "@/store/printQueue";
import type { Priority } from "@/types";

const inputCls = "w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500";

const STAGE_STEPS = PIPELINE_STAGES.map((s) => s.status);

export default function RackDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { racks, history, advanceStatus, revertStatus, advanceToSorted, moveToZone, updateRack, deleteRack, setHold, clearHold } = useRacksStore();
  const { add: queueAdd, remove: queueRemove, has: queueHas } = usePrintQueueStore();
  const { notes, addNote, deleteNote } = useNotesStore();
  const addToast = useToastStore((s) => s.add);
  const { deliveries } = useDeliveriesStore();
  const { zones }      = useZonesStore();

  const [editOpen,         setEditOpen]         = useState(false);
  const [editRackCode,     setEditRackCode]     = useState("");
  const [editPriority,     setEditPriority]     = useState<Priority>("normal");
  const [editDeliveryId,   setEditDeliveryId]   = useState("");
  const [editAuctionColor, setEditAuctionColor] = useState("");
  const [editError,        setEditError]        = useState("");
  const [deleteConfirm,  setDeleteConfirm]  = useState(false);

  // Hold form state
  const [holdOpen,   setHoldOpen]   = useState(false);
  const [holdReason, setHoldReason] = useState(HOLD_REASONS[0]);

  // Revert confirm
  const [revertConfirm, setRevertConfirm] = useState(false);

  // Priority picker for unpacking_sorting → sorted advance
  const [showPriorityPick,  setShowPriorityPick]  = useState(false);
  const [pendingPriority,   setPendingPriority]   = useState<Priority>("normal");

  const [noteInput,  setNoteInput]  = useState("");
  const [noteError,  setNoteError]  = useState("");
  const [noteOpen,   setNoteOpen]   = useState(false);

  // Consigners
  const { consigners: allConsigners, add: addConsigner, remove: removeConsigner } = useRackConsignersStore();
  const [consignerInput,  setConsignerInput]  = useState("");
  const [consignerJInput, setConsignerJInput] = useState("");
  const [consignerError,  setConsignerError]  = useState("");

  const isSupervisor = useIsSupervisor();

  const rack = racks.find((r) => r.id === id);

  const rackNotes      = notes.filter((n) => n.rackId === id);
  const rackConsigners = allConsigners.filter((c) => c.rackId === id);

  if (!rack) {
    return (
      <div className="space-y-4">
        <Link href="/racks" className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors">
          ← Racks
        </Link>
        <div className="rounded-xl border border-stone-200 bg-white px-5 py-8 shadow-sm text-center space-y-1">
          <p className="text-sm font-medium text-stone-700">Rack not found</p>
          <p className="text-xs text-stone-400">It may have been removed or the link is incorrect.</p>
        </div>
      </div>
    );
  }

  const inQueue          = queueHas(rack.id);
  const rackHistory      = history.filter((e) => e.rackId === rack.id).slice().reverse();
  const delivery         = deliveries.find((d) => d.id === rack.deliveryId);
  const needsAttention   = isRackNeedsAttention(rack, history);
  const isHeld           = !!rack.holdReason;
  const isCritical       = needsAttention && !isHeld && rack.priority === "high";
  const timeInStage    = getTimeInCurrentStatus(rack, history);
  const stageDurations = getStageDurations(rack, history);
  const stepIdx        = STATUS_ORDER.indexOf(rack.status);

  const currentZoneOccupancy = rack.zoneId
    ? getZoneOccupancy(rack.zoneId, racks, zones, rack.id)
    : null;

  const zoneOptions = [
    { value: "", label: "No zone assigned" },
    ...zones.map((z) => {
      const { count, status } = getZoneOccupancy(z.id, racks, zones, rack.id);
      const cap  = z.capacity ? ` (${count}/${z.capacity}${status === "full" ? " FULL" : ""})` : ` (${count})`;
      const desc = z.label ? ` — ${z.label}` : "";
      return { value: z.id, label: `${z.name}${desc}${cap}` };
    }),
  ];

  function openEdit() {
    setEditRackCode(rack!.rackCode);
    setEditPriority(rack!.priority);
    setEditDeliveryId(rack!.deliveryId);
    setEditAuctionColor(rack!.auctionColor ?? "");
    setEditError("");
    setEditOpen(true);
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editRackCode.trim()) return setEditError("Rack ID required.");
    setEditError("");
    const result = await updateRack(rack!.id, {
      rackCode:     editRackCode.trim(),
      priority:     editPriority,
      deliveryId:   editDeliveryId,
      auctionColor: editAuctionColor || null,
    });
    if (!result.ok) { setEditError(result.error); return; }
    setEditOpen(false);
    addToast("Rack updated");
  }

  async function handleDelete() {
    const result = await deleteRack(rack!.id);
    if (!result.ok) { setEditError(result.error); return; }
    addToast(`${rack!.rackCode} deleted`);
    router.push("/racks");
  }

  async function handleApplyHold() {
    const result = await setHold(rack!.id, holdReason);
    if (result.ok) { setHoldOpen(false); addToast("Rack placed on hold"); }
  }

  async function handleClearHold() {
    const result = await clearHold(rack!.id);
    if (result.ok) addToast("Hold cleared");
  }

  async function handleAddNote() {
    const text = noteInput.trim();
    if (!text) return;
    setNoteError("");
    const result = await addNote(text, rack!.id, undefined);
    if (!result.ok) { setNoteError(result.error); return; }
    setNoteInput("");
    addToast("Note pinned");
  }

  return (
    <div className="space-y-4">
      <Link href="/racks" className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors">
        ← Racks
      </Link>

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[1fr_340px] lg:items-start">

        {/* ── LEFT: main operational card ────────────────────────────── */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className={`h-0.5 ${isHeld ? "bg-blue-500" : "bg-orange-500"}`} />
          <div className="p-5 space-y-5">

            {/* Inline edit form */}
            {editOpen && (
              <form onSubmit={handleEditSave} className="rounded-lg border border-stone-200 bg-stone-50 p-4 space-y-2.5">
                <p className="text-xs font-semibold text-stone-700">Edit rack</p>
                <input type="text" placeholder="Rack ID (e.g. RC-0042)" value={editRackCode}
                  onChange={(e) => { setEditRackCode(e.target.value); setEditError(""); }} className={inputCls} autoFocus />
                <select
                  value={editDeliveryId}
                  onChange={(e) => setEditDeliveryId(e.target.value)}
                  className={inputCls}
                >
                  {deliveries.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.consignerJNumber ?? d.deliveryCode} — {d.consignerName}
                    </option>
                  ))}
                </select>
                <PriorityPicker value={editPriority} onChange={setEditPriority} />
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-stone-600">Auction color</p>
                  <AuctionColorPicker value={editAuctionColor} onChange={setEditAuctionColor} />
                </div>
                {editError && <p className="text-xs text-red-500">{editError}</p>}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <button type="submit"
                      className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 transition-colors">
                      Save
                    </button>
                    <button type="button" onClick={() => { setEditOpen(false); setDeleteConfirm(false); }}
                      className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
                      Cancel
                    </button>
                    <button type="button" onClick={() => { setEditRackCode(""); setEditPriority("normal"); setEditAuctionColor(""); setEditError(""); }}
                      className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-400 hover:bg-stone-50 transition-colors">
                      Clear
                    </button>
                  </div>
                  {deleteConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-stone-400">Delete this rack?</span>
                      <button type="button" onClick={handleDelete}
                        className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 transition-colors">
                        Yes, delete
                      </button>
                      <button type="button" onClick={() => setDeleteConfirm(false)}
                        className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors">
                        Cancel
                      </button>
                    </div>
                  ) : isSupervisor ? (
                    <button type="button" onClick={() => setDeleteConfirm(true)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">
                      Delete
                    </button>
                  ) : null}
                </div>
              </form>
            )}

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  {rack.auctionColor && (
                    <span className="h-3.5 w-3.5 rounded-full shrink-0 ring-1 ring-stone-200"
                      style={{ backgroundColor: rack.auctionColor }} />
                  )}
                  <h1 className="text-xl font-bold text-stone-900 tracking-tight">{rack.rackCode}</h1>
                  <StatusBadge status={rack.status} />
                  {isHeld ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      HOLD
                    </span>
                  ) : isCritical ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                      Needs attention · {formatBusinessDuration(timeInStage)}
                    </span>
                  ) : needsAttention ? (
                    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-600">
                      Needs attention · {formatBusinessDuration(timeInStage)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-stone-400">{rack.consignerName}</p>
                {delivery?.consignerJNumber && (
                  <p className="mt-0.5 text-xs text-stone-400 font-mono">{delivery.consignerJNumber}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button
                  onClick={() => inQueue ? queueRemove(rack.id) : queueAdd(rack.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    inQueue
                      ? "border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100"
                      : "border-stone-200 text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  {inQueue ? "In queue" : "Queue label"}
                </button>
                <Link
                  href={`/racks/${rack.id}/label`}
                  className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Print label
                </Link>
                {!editOpen && (
                  <button
                    onClick={openEdit}
                    className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            {/* ── QUICK ACTION BAR ────────────────────────────────────────── */}
            <div className="border-t border-stone-100 pt-4 space-y-2">
              {/* Priority picker — shown when advancing unpacking_sorting → sorted */}
              {showPriorityPick && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3.5 space-y-2.5">
                  <p className="text-xs font-semibold text-stone-700">Set priority before marking Sorted</p>
                  <PriorityPicker value={pendingPriority} onChange={setPendingPriority} />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const result = await advanceToSorted(rack.id, pendingPriority);
                        if (result.ok) { setShowPriorityPick(false); addToast("Moved to Sorted"); }
                      }}
                      className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 transition-colors"
                    >
                      Confirm Sorted
                    </button>
                    <button onClick={() => setShowPriorityPick(false)}
                      className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {/* Primary: move forward */}
                <button
                  onClick={async () => {
                    if (rack.status === "unpacking_sorting") {
                      setPendingPriority("normal");
                      setShowPriorityPick(true);
                      return;
                    }
                    const next = NEXT_STAGE_LABEL[rack.status];
                    const result = await advanceStatus(rack.id);
                    if (result.ok && next) addToast(`Moved to ${next}`);
                  }}
                  disabled={rack.status === "completed"}
                  className={`flex-1 rounded-lg py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    isCritical ? "bg-red-500 hover:bg-red-600" : "bg-orange-600 hover:bg-orange-700"
                  }`}
                >
                  {rack.status === "completed"
                    ? "Completed"
                    : `Move to ${NEXT_STAGE_LABEL[rack.status] ?? "Next"} →`}
                </button>

                {/* Hold toggle */}
                <button
                  onClick={() => isHeld ? handleClearHold() : setHoldOpen((v) => !v)}
                  className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    isHeld
                      ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                      : "border border-stone-200 text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  {isHeld ? "Clear Hold" : "Hold"}
                </button>

                {/* Note toggle */}
                <button
                  onClick={() => setNoteOpen((v) => !v)}
                  className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    noteOpen
                      ? "bg-amber-100 text-amber-700"
                      : "border border-stone-200 text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  Note
                </button>
              </div>

              {/* Inline note input */}
              {noteOpen && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Pin a note…"
                    value={noteInput}
                    onChange={(e) => { setNoteInput(e.target.value); setNoteError(""); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddNote().then(() => setNoteOpen(false));
                      if (e.key === "Escape") setNoteOpen(false);
                    }}
                    className={inputCls}
                    autoFocus
                  />
                  <button
                    onClick={() => handleAddNote().then(() => setNoteOpen(false))}
                    disabled={!noteInput.trim()}
                    className="shrink-0 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-40 transition-colors"
                  >
                    Pin
                  </button>
                </div>
              )}
              {noteError && <p className="text-xs text-red-500">{noteError}</p>}
            </div>

            {/* Metadata */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 border-t border-stone-100 pt-4">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-400 mb-1">Priority</dt>
                <dd className={`text-sm font-semibold ${rack.priority === "high" ? "text-amber-600" : "text-stone-700"}`}>
                  {rack.priority}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-400 mb-1">Created</dt>
                <dd className="text-sm font-medium text-stone-700">{timeAgo(rack.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-400 mb-1">Last update</dt>
                <dd className="text-sm font-medium text-stone-700">{timeAgo(rack.updatedAt)}</dd>
              </div>
              {delivery && (
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-400 mb-1">Delivery</dt>
                  <dd>
                    <Link href={`/deliveries/${delivery.id}`} className="text-sm font-medium text-orange-600 hover:underline transition-colors">
                      {delivery.consignerJNumber ?? delivery.deliveryCode}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>

            {/* Zone selector */}
            <div className="border-t border-stone-100 pt-4 space-y-2">
              <label htmlFor="zone-select" className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                Zone assignment
              </label>
              <CustomSelect
                id="zone-select"
                value={rack.zoneId ?? ""}
                onChange={async (v) => {
                  const result = await moveToZone(rack.id, v || undefined);
                  if (result.ok) addToast(v ? "Zone updated" : "Zone cleared", "info");
                }}
                options={zoneOptions}
                label="Zone"
              />
              {currentZoneOccupancy?.status === "full" && (
                <p className="text-xs text-orange-600">Zone at capacity. Consider moving to overflow.</p>
              )}
              {currentZoneOccupancy?.status === "near" && (
                <p className="text-xs text-amber-600">
                  Near capacity — {currentZoneOccupancy.capacity! - currentZoneOccupancy.count} spot{currentZoneOccupancy.capacity! - currentZoneOccupancy.count !== 1 ? "s" : ""} remaining.
                </p>
              )}
            </div>

            {/* ── HOLD STATE ──────────────────────────────────────────────── */}
            {(isHeld || holdOpen) && (
            <div className="border-t border-stone-100 pt-4">
              {isHeld ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                      <span className="text-sm font-medium text-blue-800">On Hold</span>
                    </div>
                    <button
                      onClick={handleClearHold}
                      className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                    >
                      Clear hold
                    </button>
                  </div>
                  <p className="text-xs text-blue-700">{rack.holdReason}</p>
                  {rack.holdStartedAt && (
                    <p className="text-[11px] text-blue-400">Since {timeAgo(rack.holdStartedAt)}</p>
                  )}
                </div>
              ) : holdOpen ? (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-3.5 space-y-2.5">
                  <p className="text-xs font-semibold text-stone-700">Put on Hold</p>
                  <select
                    value={holdReason}
                    onChange={(e) => setHoldReason(e.target.value as typeof holdReason)}
                    className={inputCls}
                  >
                    {HOLD_REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button onClick={handleApplyHold}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors">
                      Apply Hold
                    </button>
                    <button onClick={() => setHoldOpen(false)}
                      className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            )}

            {/* ── REVERT STATUS ───────────────────────────────────────────── */}
            {getPrevStatus(rack.status) && (
              <div className="border-t border-stone-100 pt-3">
                {revertConfirm ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-stone-400">Move back to {STAGE_LABEL[getPrevStatus(rack.status)!]}?</span>
                    <button
                      onClick={async () => {
                        const prev = getPrevStatus(rack.status);
                        const result = await revertStatus(rack.id);
                        if (result.ok) { setRevertConfirm(false); addToast(`Moved back to ${STAGE_LABEL[prev!]}`); }
                      }}
                      className="rounded-md bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-200 transition-colors"
                    >
                      Yes, revert
                    </button>
                    <button
                      onClick={() => setRevertConfirm(false)}
                      className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setRevertConfirm(true)}
                    className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    ← Move back to {STAGE_LABEL[getPrevStatus(rack.status)!]}
                  </button>
                )}
              </div>
            )}

            {/* ── CONSIGNERS ───────────────────────────────────────────────── */}
            <div className="border-t border-stone-100 pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <SectionLabel>Consigners</SectionLabel>
                {rackConsigners.length > 0 && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                    mixed
                  </span>
                )}
              </div>

              {/* Primary consigner (from delivery) */}
              <div className="flex items-center gap-2 rounded-lg bg-stone-50 border border-stone-200 px-3 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                <span className="flex-1 text-xs font-medium text-stone-700">{rack.consignerName}</span>
                {delivery?.consignerJNumber && (
                  <span className="text-[11px] font-mono text-stone-400">{delivery.consignerJNumber}</span>
                )}
                <span className="text-[10px] text-stone-400">primary</span>
              </div>

              {/* Secondary consigners */}
              {rackConsigners.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg bg-violet-50 border border-violet-100 px-3 py-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
                  <span className="flex-1 text-xs font-medium text-stone-700">{c.consignerName}</span>
                  {c.jNumber && (
                    <span className="text-[11px] font-mono text-stone-400">{c.jNumber}</span>
                  )}
                  <button
                    onClick={() => removeConsigner(c.id)}
                    className="text-[10px] text-stone-300 hover:text-red-400 transition-colors ml-1"
                  >
                    ×
                  </button>
                </div>
              ))}

              {/* Add consigner row */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Consigner name"
                  value={consignerInput}
                  onChange={(e) => { setConsignerInput(e.target.value); setConsignerError(""); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && consignerInput.trim()) {
                      addConsigner({ rackId: rack.id, consignerName: consignerInput.trim(), jNumber: consignerJInput.trim() || undefined })
                        .then((r) => { if (r.ok) { setConsignerInput(""); setConsignerJInput(""); } else setConsignerError(r.error); });
                    }
                  }}
                  className={inputCls}
                />
                <input
                  type="text"
                  placeholder="J-Number"
                  value={consignerJInput}
                  onChange={(e) => setConsignerJInput(e.target.value)}
                  className="w-28 rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  onClick={() => {
                    if (!consignerInput.trim()) return;
                    addConsigner({ rackId: rack.id, consignerName: consignerInput.trim(), jNumber: consignerJInput.trim() || undefined })
                      .then((r) => { if (r.ok) { setConsignerInput(""); setConsignerJInput(""); } else setConsignerError(r.error); });
                  }}
                  disabled={!consignerInput.trim()}
                  className="shrink-0 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
                >
                  Add
                </button>
              </div>
              {consignerError && <p className="text-xs text-red-500">{consignerError}</p>}
            </div>

            {/* ── OPERATIONAL NOTES ────────────────────────────────────────── */}
            {rackNotes.length > 0 && (
              <div className="border-t border-stone-100 pt-4 space-y-2">
                <SectionLabel>Operational Notes ({rackNotes.length})</SectionLabel>
                <div className="space-y-1.5">
                  {rackNotes.map((note) => (
                    <div key={note.id} className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                      <p className="flex-1 text-xs text-stone-700">{note.note}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-stone-400">{timeAgo(note.createdAt)}</span>
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="text-[10px] text-stone-300 hover:text-red-400 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pipeline progress */}
            <div className="border-t border-stone-100 pt-4">
              <SectionLabel>Pipeline Progress</SectionLabel>
              <div className="flex items-end gap-0 mt-3 w-full">
                {STAGE_STEPS.map((s, i) => {
                  const completed = rack.status === "completed";
                  const isPast    = i < stepIdx || completed;
                  const isCurrent = !completed && i === stepIdx;
                  return (
                    <Fragment key={s}>
                      <div className="flex flex-col items-center gap-2 shrink-0">
                        <div className={`rounded-full transition-colors ${
                          isCurrent
                            ? "h-3 w-3 bg-orange-500 ring-[3px] ring-orange-100"
                            : isPast
                            ? "h-2 w-2 bg-stone-400"
                            : "h-2 w-2 bg-stone-100 border border-stone-200"
                        }`} />
                        <span className={`text-[10px] leading-none text-center w-16 break-words ${
                          isCurrent ? "font-semibold text-orange-600" :
                          isPast    ? "text-stone-400"                :
                                      "text-stone-300"
                        }`}>{STAGE_LABEL[s]}</span>
                      </div>
                      {i < STAGE_STEPS.length - 1 && (
                        <div className={`flex-1 h-px mb-3.5 ${isPast ? "bg-stone-400" : "bg-stone-150"}`}
                          style={isPast ? {} : { backgroundColor: "#e7e5e4" }} />
                      )}
                    </Fragment>
                  );
                })}
              </div>
            </div>

            {/* Time per stage */}
            <div className="border-t border-stone-100 pt-4">
              <SectionLabel>Time Per Stage</SectionLabel>
              <div className="mt-3 space-y-2.5">
                {stageDurations.map((stage) => {
                  const threshold = STAGE_THRESHOLDS_MS[stage.status];
                  const isOpen    = !stage.exitedAt;
                  return (
                    <div key={stage.status + stage.enteredAt} className="flex items-center gap-3">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${
                        isOpen && stage.overThreshold ? "bg-orange-500 animate-pulse" :
                        isOpen                        ? "bg-orange-400"               :
                        stage.overThreshold           ? "bg-amber-300"                :
                        "bg-stone-200"
                      }`} />
                      <span className={`w-28 text-xs ${isOpen ? "font-medium text-stone-700" : "text-stone-400"}`}>
                        {STAGE_LABEL[stage.status]}
                      </span>
                      <span className={`text-xs tabular-nums ${
                        isOpen && stage.overThreshold ? "font-semibold text-orange-600" :
                        stage.overThreshold           ? "text-amber-600"                :
                        isOpen                        ? "font-medium text-stone-600"    :
                        "text-stone-400"
                      }`}>
                        {formatBusinessDuration(stage.durationMs)}
                      </span>
                      {stage.overThreshold && (
                        <span className="text-[11px] text-stone-400">over {formatBusinessDuration(threshold)}</span>
                      )}
                      {isOpen && !stage.overThreshold && (
                        <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] text-orange-500">current</span>
                      )}
                      {isOpen && stage.overThreshold && (
                        <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-600">delayed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* ── RIGHT: history ─────────────────────────────────────────── */}
        <div>
          <SectionLabel>History</SectionLabel>
          {rackHistory.length === 0 ? (
            <div className="mt-3 rounded-xl border border-stone-200 bg-white px-5 py-6 shadow-sm text-center space-y-1">
              <p className="text-sm font-medium text-stone-600">No status changes yet</p>
              <p className="text-xs text-stone-400">History appears as the rack moves through the pipeline.</p>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-stone-200 bg-white shadow-sm divide-y divide-stone-100">
              {rackHistory.map((event, i) => (
                <div key={event.id} className="flex items-center gap-4 px-5 py-3">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${i === 0 ? "bg-orange-500" : "bg-stone-300"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-700">
                      <span className="font-medium">{STAGE_LABEL[event.from]}</span>
                      <span className="text-stone-300 mx-2">→</span>
                      <span className="font-medium">{STAGE_LABEL[event.to]}</span>
                    </p>
                  </div>
                  <span className="text-[11px] text-stone-300 tabular-nums shrink-0">{formatTime(event.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
