"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDeliveriesStore } from "@/store/deliveries";
import { useRacksStore } from "@/store/racks";
import { useNotesStore } from "@/store/notes";
import { useZonesStore } from "@/store/zones";
import { useAuthStore } from "@/store/auth";
import { buildConsignerProfiles, type QualityTag } from "@/lib/consigners";
import { SectionLabel } from "@/components/ui/Card";
import DeliveryStatusBadge from "@/components/DeliveryStatusBadge";
import { formatDate, timeAgo } from "@/lib/utils";
import { formatBusinessDuration, getTimeInCurrentStatus } from "@/lib/timeTracking";
import { STAGE_BADGE, STAGE_LABEL } from "@/lib/tokens";

const inputCls =
  "w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500";

const TAG_COLOR: Record<string, string> = {
  blue:   "bg-blue-50 text-blue-700",
  amber:  "bg-amber-50 text-amber-700",
  orange: "bg-orange-50 text-orange-700",
  violet: "bg-violet-50 text-violet-700",
};

function QualityTagPill({ tag }: { tag: QualityTag }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TAG_COLOR[tag.color]}`}>
      {tag.label}
    </span>
  );
}

export default function ConsignerDetailPage() {
  const { slug }  = useParams<{ slug: string }>();
  const router    = useRouter();
  const { deliveries } = useDeliveriesStore();
  const { racks, history, advanceStatus } = useRacksStore();
  const { notes, addNote, deleteNote } = useNotesStore();
  const { zones } = useZonesStore();
  const user = useAuthStore((s) => s.user);

  const [noteInput,  setNoteInput]  = useState("");
  const [noteRackId, setNoteRackId] = useState("");
  const [noteError,  setNoteError]  = useState("");

  const decodedName = decodeURIComponent(slug);

  const profiles = useMemo(
    () => buildConsignerProfiles(deliveries, racks),
    [deliveries, racks]
  );

  const profile = profiles.find(
    (p) => p.key === decodedName.trim().toLowerCase()
  );

  if (!profile) {
    return (
      <div className="space-y-4">
        <Link href="/consigners" className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors">
          ← Consigners
        </Link>
        <div className="rounded-xl border border-stone-200 bg-white px-5 py-8 shadow-sm text-center space-y-1">
          <p className="text-sm font-medium text-stone-700">Consigner not found</p>
          <p className="text-xs text-stone-400">No deliveries found for this consigner name.</p>
        </div>
      </div>
    );
  }

  const deliverySet   = new Set(profile.deliveryIds);
  const myDeliveries  = deliveries
    .filter((d) => deliverySet.has(d.id))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const activeDeliveries    = myDeliveries.filter((d) => d.status !== "complete");
  const completedDeliveries = myDeliveries.filter((d) => d.status === "complete");

  const myRacks     = racks.filter((r) => deliverySet.has(r.deliveryId));
  const rackIdSet   = new Set(myRacks.map((r) => r.id));
  const activeRacks = myRacks.filter((r) => r.status !== "completed")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const consignerNotes = notes
    .filter((n) => (n.deliveryId && deliverySet.has(n.deliveryId)) || (n.rackId && rackIdSet.has(n.rackId)))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  async function handleAddNote() {
    const text = noteInput.trim();
    if (!text) return;
    setNoteError("");

    const targetDelivery = myDeliveries[0];
    if (!noteRackId && !targetDelivery) {
      setNoteError("No delivery to attach note to.");
      return;
    }

    const createdBy = user?.email ?? undefined;
    const result = await addNote(
      text,
      noteRackId || undefined,
      noteRackId ? undefined : targetDelivery?.id,
      createdBy
    );

    if (!result.ok) { setNoteError(result.error); return; }
    setNoteInput("");
    setNoteRackId("");
  }

  return (
    <div className="space-y-4">
      <Link href="/consigners" className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors">
        ← Consigners
      </Link>

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[1fr_340px] lg:items-start">

        {/* ── LEFT: profile card ──────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Header card */}
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
            <div className="h-0.5 bg-orange-500" />
            <div className="p-5 space-y-4">

              {/* Name + J-number */}
              <div>
                <h1 className="text-xl font-bold text-stone-900">{profile.name}</h1>
                {profile.jNumber && (
                  <p className="mt-0.5 font-mono text-sm text-stone-500">{profile.jNumber}</p>
                )}
                {profile.qualityTags.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {profile.qualityTags.map((tag) => (
                      <QualityTagPill key={tag.label} tag={tag} />
                    ))}
                  </div>
                )}
              </div>

              {/* Stats grid */}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 border-t border-stone-100 pt-4">
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-400 mb-1">Deliveries</dt>
                  <dd className="text-sm font-semibold text-stone-800">
                    {profile.totalDeliveries}
                    {profile.activeDeliveries > 0 && (
                      <span className="text-orange-600 font-normal text-xs ml-1">({profile.activeDeliveries} active)</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-400 mb-1">Total racks</dt>
                  <dd className="text-sm font-semibold text-stone-800">
                    {profile.totalRacks}
                    {profile.activeRacks > 0 && (
                      <span className="text-orange-600 font-normal text-xs ml-1">({profile.activeRacks} active)</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-400 mb-1">Avg racks</dt>
                  <dd className="text-sm font-medium text-stone-800">
                    {profile.avgRacksPerDelivery > 0 ? `${profile.avgRacksPerDelivery}/delivery` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-400 mb-1">Avg processing</dt>
                  <dd className={`text-sm font-medium ${
                    profile.avgProcessingDays !== null && profile.avgProcessingDays > 7
                      ? "text-amber-700"
                      : "text-stone-800"
                  }`}>
                    {profile.avgProcessingDays !== null ? `${profile.avgProcessingDays} days` : "—"}
                  </dd>
                </div>
              </dl>

            </div>
          </div>

          {/* Active deliveries */}
          {activeDeliveries.length > 0 && (
            <div className="space-y-2">
              <SectionLabel>Active deliveries ({activeDeliveries.length})</SectionLabel>
              <div className="space-y-2">
                {activeDeliveries.map((d) => {
                  const linked  = racks.filter((r) => r.deliveryId === d.id);
                  const active  = linked.filter((r) => r.status !== "completed").length;
                  const zone    = zones.find((z) => z.deliveryId === d.id);
                  return (
                    <Link
                      key={d.id}
                      href={`/deliveries/${d.id}`}
                      className="block rounded-xl border border-stone-200 bg-white px-5 py-3.5 shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-bold text-stone-900">
                              {d.consignerJNumber ?? d.deliveryCode}
                            </span>
                            <DeliveryStatusBadge status={d.status} />
                            {d.type === "walkin" && (
                              <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-500">walk-in</span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-stone-400">
                            {d.arrivedAt ? `Arrived ${timeAgo(d.arrivedAt)}` : `Scheduled ${formatDate(d.scheduledDate)}`}
                            {zone && <span className="ml-2 font-medium text-stone-500">{zone.name}</span>}
                            <span className="ml-2">{active} active rack{active !== 1 ? "s" : ""}</span>
                          </p>
                          {d.auctionDate && (
                            <p className="mt-0.5 text-xs text-amber-700">Auction {formatDate(d.auctionDate)}</p>
                          )}
                        </div>
                        <span className="text-[11px] text-stone-400 shrink-0">→</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Operational notes */}
          <div className="space-y-2">
            <SectionLabel>
              Operational notes{consignerNotes.length > 0 ? ` (${consignerNotes.length})` : ""}
            </SectionLabel>

            {/* Add note form */}
            <div className="space-y-2">
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
              {activeRacks.length > 0 && (
                <select
                  value={noteRackId}
                  onChange={(e) => setNoteRackId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">No specific rack (delivery-level)</option>
                  {activeRacks.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.rackCode} — {STAGE_LABEL[r.status]}
                    </option>
                  ))}
                </select>
              )}
              {noteError && <p className="text-xs text-red-500">{noteError}</p>}
            </div>

            {consignerNotes.length > 0 && (
              <div className="space-y-1.5">
                {consignerNotes.map((note) => {
                  const attachedRack = note.rackId ? myRacks.find((r) => r.id === note.rackId) : undefined;
                  return (
                    <div key={note.id} className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-stone-700">{note.note}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          {attachedRack && (
                            <button
                              onClick={() => router.push(`/racks/${attachedRack.id}`)}
                              className="text-[10px] font-mono font-medium text-sky-600 hover:underline"
                            >
                              {attachedRack.rackCode}
                            </button>
                          )}
                          {note.createdBy && (
                            <span className="text-[10px] text-stone-400">by {note.createdBy}</span>
                          )}
                        </div>
                      </div>
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
                  );
                })}
              </div>
            )}
          </div>

          {/* Delivery history */}
          {completedDeliveries.length > 0 && (
            <div className="space-y-2">
              <SectionLabel>Delivery history ({completedDeliveries.length})</SectionLabel>
              <div className="rounded-xl border border-stone-200 bg-white shadow-sm divide-y divide-stone-100 overflow-hidden">
                {completedDeliveries.slice(0, 10).map((d) => {
                  const rackCount = racks.filter((r) => r.deliveryId === d.id).length;
                  return (
                    <Link
                      key={d.id}
                      href={`/deliveries/${d.id}`}
                      className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-stone-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm text-stone-800">
                          {d.consignerJNumber ?? d.deliveryCode}
                        </p>
                        <p className="text-xs text-stone-400">
                          {formatDate(d.arrivedAt?.slice(0, 10) ?? d.scheduledDate)} · {rackCount} rack{rackCount !== 1 ? "s" : ""}
                          {d.completedAt && ` · completed ${timeAgo(d.completedAt)}`}
                        </p>
                      </div>
                      <span className="text-[11px] text-stone-300 shrink-0">→</span>
                    </Link>
                  );
                })}
                {completedDeliveries.length > 10 && (
                  <p className="px-5 py-2.5 text-xs text-stone-400">
                    + {completedDeliveries.length - 10} earlier deliveries
                  </p>
                )}
              </div>
            </div>
          )}

        </div>

        {/* ── RIGHT: active racks ─────────────────────────────────────────── */}
        <div className="space-y-3">
          <SectionLabel>
            Active racks ({activeRacks.length})
          </SectionLabel>
          {activeRacks.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white px-5 py-6 shadow-sm text-center space-y-1">
              <p className="text-sm font-medium text-stone-600">No active racks</p>
              <p className="text-xs text-stone-400">All racks from this consigner are completed.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeRacks.map((rack) => {
                const delivery = deliveries.find((d) => d.id === rack.deliveryId);
                const timeMs   = getTimeInCurrentStatus(rack, history);
                const zone     = rack.zoneId ? zones.find((z) => z.id === rack.zoneId) : undefined;
                return (
                  <div
                    key={rack.id}
                    onClick={() => router.push(`/racks/${rack.id}`)}
                    className={`cursor-pointer rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150 ${
                      rack.holdReason ? "border-l-4 border-l-blue-400" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-stone-900">{rack.rackCode}</span>
                        {rack.holdReason ? (
                          <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">HOLD</span>
                        ) : (
                          <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${STAGE_BADGE[rack.status]}`}>
                            {STAGE_LABEL[rack.status]}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-stone-400 shrink-0 tabular-nums">
                        {formatBusinessDuration(timeMs)}
                      </span>
                    </div>
                    {rack.holdReason && (
                      <p className="mt-1 text-[11px] text-blue-600">{rack.holdReason}</p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-stone-400">
                      {delivery && (
                        <span>{delivery.consignerJNumber ?? delivery.deliveryCode}</span>
                      )}
                      {zone && <span>· {zone.name}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
