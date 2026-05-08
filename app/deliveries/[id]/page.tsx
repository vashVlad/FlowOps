"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDeliveriesStore } from "@/store/deliveries";
import { useRacksStore } from "@/store/racks";
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

export default function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { deliveries, setStatus } = useDeliveriesStore();
  const { racks, addRack, advanceStatus } = useRacksStore();
  const addToast = useToastStore((s) => s.add);

  const [addOpen, setAddOpen]         = useState(false);
  const [addPriority, setAddPriority] = useState<Priority>("normal");

  const delivery = deliveries.find((d) => d.id === id);

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

  const counts = [...PIPELINE_STAGES, { status: "completed" as const }].map(({ status }) => ({
    status,
    label: STAGE_LABEL[status],
    color: STAGE_BAR[status],
    count: linked.filter((r) => r.status === status).length,
  }));

  async function handleAddRack() {
    const result = await addRack({
      consignerName: delivery!.consignerName,
      priority: addPriority,
      deliveryId: delivery!.id,
    });
    setAddPriority("normal");
    if (result.ok) addToast(`${result.data.rackCode} added`);
  }

  return (
    <div className="space-y-4">
      <Link href="/deliveries" className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors">
        ← Deliveries
      </Link>

      {/* Two-column on desktop: delivery card | racks */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[1fr_380px] lg:items-start">

        {/* ── LEFT: main delivery card ──────────────────────────────────── */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="h-0.5 bg-orange-500" />
          <div className="p-5 space-y-5">

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-mono text-xl font-bold text-stone-900 tracking-tight">{delivery.deliveryCode}</h1>
                  <DeliveryStatusBadge status={delivery.status} />
                  {delivery.type === "walkin" && (
                    <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">walk-in</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-stone-400">{delivery.consignerName}</p>
              </div>
              {nextStatus && (
                <button
                  onClick={async () => {
                    const result = await setStatus(delivery.id, nextStatus);
                    if (result.ok) addToast(`Delivery ${DELIVERY_STATUS_LABEL[nextStatus].toLowerCase()}`);
                  }}
                  className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${DELIVERY_NEXT_BTN[delivery.status]}`}
                >
                  {DELIVERY_NEXT_LABEL[delivery.status]}
                </button>
              )}
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
            </dl>

            {delivery.notes && (
              <p className="border-t border-stone-100 pt-4 text-xs text-stone-400 italic">{delivery.notes}</p>
            )}

            {/* Progress */}
            <div className="border-t border-stone-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <SectionLabel>Progress</SectionLabel>
                <span className="text-xs text-stone-500">{done.length} done{total > 0 && ` · ${pct}%`}</span>
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

        {/* ── RIGHT: racks ─────────────────────────────────────────────── */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel>Racks ({linked.length})</SectionLabel>
            <button
              onClick={() => setAddOpen((v) => !v)}
              className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 transition-colors"
            >
              {addOpen ? "Cancel" : "+ Add rack"}
            </button>
          </div>

          {addOpen && (
            <div className="mb-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm space-y-2.5">
              <PriorityPicker value={addPriority} onChange={setAddPriority} />
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
                      {rack.priority === "high" && (
                        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">high</span>
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
