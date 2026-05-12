"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDeliveriesStore } from "@/store/deliveries";
import { useRacksStore } from "@/store/racks";
import { useIsSupervisor } from "@/store/auth";
import { useZonesStore } from "@/store/zones";
import { useNotesStore } from "@/store/notes";
import { usePhotosStore } from "@/store/photos";
import DeliveryStatusBadge from "@/components/DeliveryStatusBadge";
import PriorityPicker from "@/components/ui/PriorityPicker";
import { StageStrip } from "@/app/racks/page";
import { SectionLabel } from "@/components/ui/Card";
import { formatDate, timeAgo } from "@/lib/utils";
import {
  PIPELINE_STAGES,
  STAGE_BAR,
  STAGE_LABEL,
  DELIVERY_NEXT_LABEL,
  DELIVERY_NEXT_BTN,
  DELIVERY_STATUS_LABEL,
} from "@/lib/tokens";
import { useToastStore } from "@/store/toast";
import type { DeliveryStatus, Priority } from "@/types";

const NEXT_STATUS: Record<DeliveryStatus, DeliveryStatus | null> = {
  scheduled: "arrived", arrived: "processing", processing: "complete", complete: null,
};

function formatAuctionDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function businessDaysUntil(dateStr: string): number {
  const now    = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  if (target < now) return -1; // past
  let days = 0;
  const cur = new Date(now);
  while (cur <= target) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) days++;
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export default function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { deliveries, setStatus, deleteDelivery, updateDelivery } = useDeliveriesStore();
  const { racks, addRack, advanceStatus } = useRacksStore();
  const { zones } = useZonesStore();
  const { notes, addNote, deleteNote } = useNotesStore();
  const { photos, uploading, fetchForDelivery, upload, deletePhoto } = usePhotosStore();
  const addToast     = useToastStore((s) => s.add);
  const isSupervisor = useIsSupervisor();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [addOpen, setAddOpen]             = useState(false);
  const [addPriority, setAddPriority]     = useState<Priority>("normal");
  const [addRackCode, setAddRackCode]     = useState("");
  const [addRackError, setAddRackError]   = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [auctionEditing, setAuctionEditing] = useState(false);
  const [auctionValue, setAuctionValue]   = useState("");
  const [noteInput, setNoteInput]         = useState("");
  const [noteError, setNoteError]         = useState("");
  const [photoCaption, setPhotoCaption]   = useState("");
  const [photoError, setPhotoError]       = useState("");
  const [previewPhoto, setPreviewPhoto]   = useState<string | null>(null);
  const [outcomeEditing, setOutcomeEditing] = useState(false);
  const [donationValue, setDonationValue] = useState("");
  const [trashValue, setTrashValue]       = useState("");

  const delivery = deliveries.find((d) => d.id === id);

  useEffect(() => {
    if (id) fetchForDelivery(id);
  }, [id]);

  if (!delivery) {
    return (
      <div className="space-y-4">
        <Link href="/deliveries" className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors">
          ← Deliveries
        </Link>
        <div className="rounded-xl border border-stone-200 bg-white px-5 py-6 shadow-sm text-center space-y-1">
          <p className="text-sm font-medium text-stone-700">Delivery not found</p>
          <p className="text-xs text-stone-400">It may have been removed or the link is incorrect.</p>
        </div>
      </div>
    );
  }

  const linked     = racks.filter((r) => r.deliveryId === id);
  const done       = linked.filter((r) => r.status === "pickup" || r.status === "completed");
  const total      = Math.max(delivery.expectedRackCount, linked.length);
  const pct        = total > 0 ? Math.round((done.length / total) * 100) : 0;
  const nextStatus = NEXT_STATUS[delivery.status];

  const racksWithItems = linked.filter((r) => r.itemCount != null);
  const totalItems     = racksWithItems.reduce((s, r) => s + r.itemCount!, 0);
  const hasItemData    = racksWithItems.length > 0;

  const deliveryNotes = notes.filter((n) => n.deliveryId === id);
  const deliveryPhotos = photos[id] ?? [];

  const counts = [...PIPELINE_STAGES, { status: "completed" as const }].map(({ status }) => ({
    status,
    label: STAGE_LABEL[status],
    color: STAGE_BAR[status],
    count: linked.filter((r) => r.status === status).length,
  }));

  const inputCls = "w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500";

  const auctionDays = delivery.auctionDate ? businessDaysUntil(delivery.auctionDate) : null;
  const auctionUrgent = auctionDays !== null && auctionDays <= 3;
  const auctionPast   = auctionDays !== null && auctionDays < 0;

  const donationPct  = delivery.donationPercent ?? 0;
  const trashPct     = delivery.trashPercent    ?? 0;
  const sellablePct  = Math.max(0, 100 - donationPct - trashPct);
  const hasOutcome   = delivery.donationPercent != null || delivery.trashPercent != null;
  const outcomeOverLimit = Number(donationValue || 0) + Number(trashValue || 0) > 100;

  async function handleAddRack() {
    const result = await addRack({
      consignerName: delivery!.consignerName,
      priority: addPriority,
      deliveryId: delivery!.id,
      rackCode: addRackCode.trim() || undefined,
    });
    if (!result.ok) {
      setAddRackError(result.error);
      return;
    }
    setAddPriority("normal");
    setAddRackCode("");
    setAddRackError("");
    addToast(`${result.data.rackCode} added`);
  }

  async function handleAddNote() {
    const text = noteInput.trim();
    if (!text) return;
    setNoteError("");
    const result = await addNote(text, undefined, delivery!.id);
    if (!result.ok) { setNoteError(result.error); return; }
    setNoteInput("");
    addToast("Note pinned");
  }

  async function handleSaveOutcome() {
    const clamp = (v: string) => v === "" ? null : Math.min(100, Math.max(0, Math.round(Number(v) || 0)));
    const d = clamp(donationValue);
    const t = clamp(trashValue);
    if ((d ?? 0) + (t ?? 0) > 100) return;
    const result = await updateDelivery(delivery!.id, { donationPercent: d, trashPercent: t });
    if (result.ok) { setOutcomeEditing(false); addToast("Outcome saved"); }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError("");
    const result = await upload(delivery!.id, file, photoCaption.trim() || undefined);
    if (!result.ok) {
      setPhotoError(result.error.includes("bucket") || result.error.includes("storage")
        ? "Storage not configured. Create the \"delivery-photos\" bucket in Supabase Storage first."
        : result.error);
    } else {
      setPhotoCaption("");
      addToast("Photo uploaded");
    }
    e.target.value = "";
  }

  return (
    <div className="space-y-4">
      <Link href="/deliveries" className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors">
        ← Deliveries
      </Link>

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[1fr_380px] lg:items-start">

        {/* ── LEFT: main delivery card ─────────────────────────────────── */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="h-0.5 bg-orange-500" />
          <div className="p-5 space-y-5">

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-mono text-xl font-bold text-stone-900 tracking-tight">
                    {delivery.consignerJNumber ?? delivery.deliveryCode}
                  </h1>
                  <DeliveryStatusBadge status={delivery.status} />
                  {delivery.type === "walkin" && (
                    <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">walk-in</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-stone-400">{delivery.consignerName}</p>
                {delivery.consignerJNumber && (
                  <p className="mt-0.5 text-xs text-stone-400 font-mono">{delivery.consignerJNumber}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {deleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-400">Delete?</span>
                    <button onClick={async () => {
                      const result = await deleteDelivery(delivery.id);
                      if (!result.ok) return;
                      addToast(`${delivery.consignerJNumber ?? delivery.deliveryCode} deleted`);
                      router.push("/deliveries");
                    }} className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors">
                      Yes
                    </button>
                    <button onClick={() => setDeleteConfirm(false)}
                      className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
                      No
                    </button>
                  </div>
                ) : isSupervisor ? (
                  <button onClick={() => setDeleteConfirm(true)}
                    className="text-xs text-stone-400 hover:text-red-500 transition-colors">
                    Delete
                  </button>
                ) : null}
                {nextStatus && (
                  <button
                    onClick={async () => {
                      const result = await setStatus(delivery.id, nextStatus);
                      if (result.ok) addToast(`Delivery ${DELIVERY_STATUS_LABEL[nextStatus].toLowerCase()}`);
                    }}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${DELIVERY_NEXT_BTN[delivery.status]}`}
                  >
                    {DELIVERY_NEXT_LABEL[delivery.status]}
                  </button>
                )}
              </div>
            </div>

            {/* Metadata */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 border-t border-stone-100 pt-4">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-400 mb-1">{delivery.type === "walkin" ? "Arrived" : "Scheduled"}</dt>
                <dd className="text-sm text-stone-700">
                  {delivery.type === "walkin" && delivery.arrivedAt
                    ? timeAgo(delivery.arrivedAt)
                    : formatDate(delivery.scheduledDate)}
                </dd>
              </div>
              {delivery.type === "scheduled" && delivery.arrivedAt && (
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-400 mb-1">Arrived</dt>
                  <dd className="text-sm text-stone-700">{timeAgo(delivery.arrivedAt)}</dd>
                </div>
              )}
              {delivery.completedAt && (
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-400 mb-1">Completed</dt>
                  <dd className="text-sm text-stone-700">{timeAgo(delivery.completedAt)}</dd>
                </div>
              )}
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-400 mb-1">Racks</dt>
                <dd className="text-sm font-semibold text-stone-700">
                  {delivery.expectedRackCount > 0
                    ? `${linked.length} / ${delivery.expectedRackCount}`
                    : `${linked.length} linked`}
                </dd>
              </div>
              {delivery.zoneId && (() => {
                const zone = zones.find((z) => z.id === delivery.zoneId);
                return zone ? (
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-400 mb-1">Zone</dt>
                    <dd className="text-sm font-medium text-stone-700">{zone.name}</dd>
                  </div>
                ) : null;
              })()}
              {/* Auction date */}
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-400 mb-1">Auction Date</dt>
                <dd className="flex items-center gap-1.5">
                  {auctionEditing ? (
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="date"
                        value={auctionValue}
                        onChange={(e) => setAuctionValue(e.target.value)}
                        className="rounded border border-stone-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                        autoFocus
                      />
                      <button
                        onClick={async () => {
                          const result = await updateDelivery(delivery.id, { auctionDate: auctionValue || null });
                          if (result.ok) { setAuctionEditing(false); addToast("Auction date saved"); }
                        }}
                        className="text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors"
                      >
                        Save
                      </button>
                      <button onClick={() => setAuctionEditing(false)} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
                        Cancel
                      </button>
                    </div>
                  ) : delivery.auctionDate ? (
                    <>
                      <span className={`text-sm font-medium ${
                        auctionPast ? "text-red-600" : auctionUrgent ? "text-amber-700" : "text-stone-700"
                      }`}>
                        {formatAuctionDate(delivery.auctionDate)}
                      </span>
                      {auctionPast && (
                        <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">past</span>
                      )}
                      {!auctionPast && auctionUrgent && auctionDays !== null && (
                        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          {auctionDays === 1 ? "tomorrow" : `${auctionDays}d`}
                        </span>
                      )}
                      <button
                        onClick={() => { setAuctionValue(delivery.auctionDate ?? ""); setAuctionEditing(true); }}
                        className="text-[10px] text-stone-300 hover:text-stone-600 transition-colors ml-1"
                      >
                        Edit
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { setAuctionValue(""); setAuctionEditing(true); }}
                      className="text-xs text-stone-400 hover:text-orange-600 transition-colors"
                    >
                      Set date
                    </button>
                  )}
                </dd>
              </div>

            </dl>
            {/* ── OUTCOME ───────────────────────────────────────────────────── */}
            <div className="border-t border-stone-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <SectionLabel>Outcome</SectionLabel>
                {!outcomeEditing && (
                  <button
                    onClick={() => {
                      setDonationValue(delivery.donationPercent != null ? String(delivery.donationPercent) : "");
                      setTrashValue(delivery.trashPercent != null ? String(delivery.trashPercent) : "");
                      setOutcomeEditing(true);
                    }}
                    className="text-xs text-stone-400 hover:text-orange-600 transition-colors"
                  >
                    {hasOutcome ? "Edit" : "Set outcome"}
                  </button>
                )}
              </div>

              {outcomeEditing ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-xs text-stone-500">Donation</span>
                    <input
                      type="number" min="0" max="100"
                      value={donationValue}
                      onChange={(e) => setDonationValue(e.target.value)}
                      placeholder="0"
                      className="w-14 rounded border border-stone-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                      autoFocus
                    />
                    <span className="text-xs text-stone-400">%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
                    <span className="text-xs text-stone-500">Trash</span>
                    <input
                      type="number" min="0" max="100"
                      value={trashValue}
                      onChange={(e) => setTrashValue(e.target.value)}
                      placeholder="0"
                      className="w-14 rounded border border-stone-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                    <span className="text-xs text-stone-400">%</span>
                  </div>
                  {outcomeOverLimit && (
                    <span className="text-xs text-red-500">Total exceeds 100%</span>
                  )}
                  <button
                    onClick={handleSaveOutcome}
                    disabled={outcomeOverLimit}
                    className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setOutcomeEditing(false)}
                    className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : hasOutcome ? (
                <>
                  {/* Stacked bar */}
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-stone-100">
                    {donationPct > 0 && (
                      <div
                        className="h-full bg-emerald-400 transition-all duration-300"
                        style={{ width: `${donationPct}%` }}
                        title={`Donation: ${donationPct}%`}
                      />
                    )}
                    {trashPct > 0 && (
                      <div
                        className="h-full bg-red-400 transition-all duration-300"
                        style={{ width: `${trashPct}%` }}
                        title={`Trash: ${trashPct}%`}
                      />
                    )}
                  </div>
                  {/* Stat tiles */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-center">
                      <p className="text-lg font-bold tabular-nums text-emerald-700">{donationPct}%</p>
                      <p className="text-[11px] text-emerald-600 mt-0.5">Donation</p>
                    </div>
                    <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-center">
                      <p className="text-lg font-bold tabular-nums text-red-600">{trashPct}%</p>
                      <p className="text-[11px] text-red-500 mt-0.5">Trash / Dump</p>
                    </div>
                    <div className="rounded-lg bg-stone-50 border border-stone-200 px-3 py-2.5 text-center">
                      <p className="text-lg font-bold tabular-nums text-stone-700">{sellablePct}%</p>
                      <p className="text-[11px] text-stone-400 mt-0.5">Sellable</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-stone-400">No outcome recorded yet.</p>
              )}
            </div>

            {/* ── OPERATIONAL NOTES ─────────────────────────────────────────── */}
            <div className="border-t border-stone-100 pt-4 space-y-3">
              <SectionLabel>Operational Notes{deliveryNotes.length > 0 ? ` (${deliveryNotes.length})` : ""}</SectionLabel>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Pin a note…"
                  value={noteInput}
                  onChange={(e) => { setNoteInput(e.target.value); setNoteError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                  className={inputCls}
                />
                <button
                  onClick={handleAddNote}
                  disabled={!noteInput.trim()}
                  className="shrink-0 rounded-lg bg-orange-600 px-3 py-2 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Pin
                </button>
              </div>
              {noteError && <p className="text-xs text-red-500">{noteError}</p>}
              {deliveryNotes.length > 0 && (
                <div className="space-y-1.5">
                  {deliveryNotes.map((note) => (
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
              )}
            </div>

            {/* ── PHOTOS ────────────────────────────────────────────────────── */}
            <div className="border-t border-stone-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <SectionLabel>Photos{deliveryPhotos.length > 0 ? ` (${deliveryPhotos.length})` : ""}</SectionLabel>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Caption (optional)"
                    value={photoCaption}
                    onChange={(e) => setPhotoCaption(e.target.value)}
                    className="rounded-lg border border-stone-200 px-2 py-1.5 text-xs text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-orange-500 w-36"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-200 disabled:opacity-40 transition-colors"
                  >
                    {uploading ? "Uploading…" : "Upload photo"}
                  </button>
                </div>
              </div>
              {photoError && (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{photoError}</p>
              )}
              {deliveryPhotos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                  {deliveryPhotos.map((photo) => (
                    <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-stone-200">
                      {photo.url ? (
                        <button
                          onClick={() => setPreviewPhoto(photo.url!)}
                          className="block w-full"
                        >
                          <img
                            src={photo.url}
                            alt={photo.caption ?? "Delivery photo"}
                            className="w-full h-28 md:h-44 object-cover hover:opacity-90 transition-opacity"
                          />
                        </button>
                      ) : (
                        <div className="w-full h-28 md:h-44 bg-stone-100 flex items-center justify-center">
                          <span className="text-xs text-stone-400">Loading…</span>
                        </div>
                      )}
                      {photo.caption && (
                        <p className="px-1.5 py-1 text-[10px] text-stone-400 truncate">{photo.caption}</p>
                      )}
                      <button
                        onClick={() => deletePhoto(photo.id, photo.storagePath, delivery.id)}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 rounded-full bg-white/80 w-5 h-5 flex items-center justify-center text-[11px] text-red-500 hover:bg-white transition-all"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-400">No photos yet. Upload delivery photos to record visual context.</p>
              )}
            </div>

            {/* Photo preview modal */}
            {previewPhoto && (
              <div
                className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                onClick={() => setPreviewPhoto(null)}
              >
                <img
                  src={previewPhoto}
                  alt="Preview"
                  className="max-w-full max-h-full rounded-lg shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}

            {/* Progress */}
            <div className="border-t border-stone-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <SectionLabel>Progress</SectionLabel>
                <div className="flex items-center gap-3">
                  {hasItemData && (
                    <span className="text-xs text-stone-400">{totalItems} item{totalItems !== 1 ? "s" : ""}</span>
                  )}
                  <span className="text-xs text-stone-500">{done.length} done{total > 0 && ` · ${pct}%`}</span>
                </div>
              </div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-stone-100">
                {total === 0 ? null : counts.map(({ status, color, count }) =>
                  count === 0 ? null : (
                    <div key={status} className={`h-full ${color} transition-all duration-300`}
                      style={{ width: `${(count / total) * 100}%` }} title={`${status}: ${count}`} />
                  )
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {counts.map(({ status, label, color, count }) => (
                  <div key={status} className="text-center">
                    <div className={`mx-auto mb-1 h-2 w-2 rounded-full ${color}`} />
                    <p className={`text-sm font-bold tabular-nums ${count > 0 ? "text-stone-800" : "text-stone-300"}`}>{count}</p>
                    <p className="text-[10px] text-stone-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── RIGHT: racks ──────────────────────────────────────────────── */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel>Racks ({linked.length})</SectionLabel>
            <button
              onClick={() => { setAddOpen((v) => !v); setAddRackCode(""); setAddRackError(""); }}
              className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 transition-colors"
            >
              {addOpen ? "Cancel" : "+ Add rack"}
            </button>
          </div>

          {addOpen && (
            <div className="mb-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm space-y-2.5">
              <input type="text" placeholder="Rack ID (optional — auto-generated if blank)" value={addRackCode}
                onChange={(e) => { setAddRackCode(e.target.value); setAddRackError(""); }}
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              <PriorityPicker value={addPriority} onChange={setAddPriority} />
              {addRackError && <p className="text-xs text-red-500">{addRackError}</p>}
              <button
                onClick={handleAddRack}
                className="w-full rounded-lg bg-orange-600 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
              >
                Add rack
              </button>
            </div>
          )}

          {linked.length === 0 && !addOpen ? (
            <div className="rounded-xl border border-stone-200 bg-white px-5 py-6 shadow-sm text-center space-y-1">
              <p className="text-sm font-medium text-stone-600">No racks linked yet</p>
              <p className="text-xs text-stone-400">
                Use{" "}
                <button onClick={() => setAddOpen(true)} className="text-orange-600 hover:underline transition-colors">
                  + Add rack
                </button>{" "}
                above to register the first one.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {linked.map((rack) => (
                <li key={rack.id} onClick={() => router.push(`/racks/${rack.id}`)}
                  className="cursor-pointer rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-sm font-bold text-stone-900">{rack.rackCode}</span>
                      {rack.holdReason && (
                        <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">HOLD</span>
                      )}
                      {rack.priority === "high" && !rack.holdReason && (
                        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">high</span>
                      )}
                      {rack.itemCount != null && (
                        <span className="text-[11px] text-stone-400">{rack.itemCount} items</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-stone-400">{timeAgo(rack.updatedAt)}</span>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const result = await advanceStatus(rack.id);
                          if (result.ok) addToast(`${rack.rackCode} advanced`);
                        }}
                        disabled={rack.status === "completed"}
                        className="rounded-lg bg-orange-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                  <StageStrip status={rack.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}
