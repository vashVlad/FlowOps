"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeliveriesStore } from "@/store/deliveries";
import { useRacksStore } from "@/store/racks";
import DeliveryStatusBadge from "@/components/DeliveryStatusBadge";
import { LoadingCards } from "@/components/LoadingCards";
import ErrorBanner from "@/components/ErrorBanner";
import { formatDate, today } from "@/lib/utils";
import { estimateRackCount, getConsignerSummary } from "@/lib/deliveries";
import type { ConsignerSummary } from "@/lib/deliveries";
import PageHeader from "@/components/ui/PageHeader";
import {
  DELIVERY_STATUS_BORDER,
  DELIVERY_NEXT_LABEL,
  DELIVERY_NEXT_BTN,
  PIPELINE_STAGES,
  STAGE_BAR,
} from "@/lib/tokens";
import type { DeliveryStatus } from "@/types";

const inputCls =
  "w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500";

const NEXT_STATUS: Record<DeliveryStatus, DeliveryStatus | null> = {
  scheduled:  "arrived",
  arrived:    "processing",
  processing: "complete",
  complete:   null,
};

type FormMode = "walkin" | "scheduled";

export default function DeliveriesPage() {
  const router = useRouter();
  const { deliveries, loading, error: storeError, addDelivery, setStatus } = useDeliveriesStore();
  function clearStoreError() { useDeliveriesStore.setState({ error: null }); }
  const { racks } = useRacksStore();

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("walkin");
  const [consignerName, setConsignerName] = useState("");
  const [jNumber, setJNumber] = useState("");
  const [error, setError] = useState("");
  const [walkinCount, setWalkinCount] = useState("");
  const [expectedCount, setExpectedCount] = useState("");
  const [scheduledDate, setScheduledDate] = useState(today());
  const [notes, setNotes] = useState("");

  const estimate = estimateRackCount(consignerName, deliveries, racks);
  const summary  = getConsignerSummary(consignerName, deliveries, racks);

  function resetForm() {
    setConsignerName(""); setJNumber(""); setError(""); setWalkinCount("");
    setExpectedCount(""); setScheduledDate(today()); setNotes("");
  }

  async function handleWalkinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consignerName.trim()) return setError("Consigner name required.");
    setError("");
    const result = await addDelivery({
      type: "walkin",
      consignerName: consignerName.trim(),
      consignerJNumber: jNumber.trim() || undefined,
      expectedRackCount: Number(walkinCount) || 0,
    });
    if (!result.ok) return;
    resetForm(); setShowForm(false);
    router.push(`/deliveries/${result.data.id}`);
  }

  function handleScheduledSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consignerName.trim()) return setError("Consigner name required.");
    const count = Number(expectedCount);
    if (!count || count < 1) return setError("Valid rack count required.");
    if (!scheduledDate) return setError("Scheduled date required.");
    setError("");
    addDelivery({
      type: "scheduled",
      consignerName: consignerName.trim(),
      consignerJNumber: jNumber.trim() || undefined,
      expectedRackCount: count,
      scheduledDate,
      notes: notes.trim() || undefined,
    });
    resetForm(); setShowForm(false);
  }

  type DeliveryFilter = "all" | "active" | "done";
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");

  const sorted = [...deliveries]
    .filter((d) => {
      if (deliveryFilter === "active") return d.status !== "complete";
      if (deliveryFilter === "done")   return d.status === "complete";
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-5">
      <PageHeader
        title="Deliveries"
        action={
          <button
            onClick={() => { setShowForm((v) => !v); resetForm(); }}
            className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
          >
            {showForm ? "Cancel" : "New delivery"}
          </button>
        }
      />

      {showForm && (
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex overflow-hidden rounded-lg border border-stone-200 w-fit text-xs font-medium">
            {(["walkin", "scheduled"] as FormMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => { setFormMode(mode); setError(""); }}
                className={`px-3 py-2 capitalize transition-colors ${
                  formMode === mode
                    ? "bg-orange-600 text-white"
                    : "bg-white text-stone-500 hover:bg-stone-50"
                } ${mode === "scheduled" ? "border-l border-stone-200" : ""}`}
              >
                {mode === "walkin" ? "Walk-in" : "Scheduled"}
              </button>
            ))}
          </div>

          {formMode === "walkin" ? (
            <form onSubmit={handleWalkinSubmit} className="space-y-3">
              <p className="text-xs text-stone-400">
                Truck just arrived — register now and add racks on the next screen.
              </p>
              <div className="space-y-1">
                <input type="text" placeholder="Consigner name" value={consignerName}
                  onChange={(e) => setConsignerName(e.target.value)} className={inputCls} autoFocus />
                {summary && (
                  <ConsignerCard summary={summary} estimate={estimate?.estimate}
                    onSelect={() => {
                      setConsignerName(summary.canonicalName);
                      if (estimate) setWalkinCount(String(estimate.estimate));
                    }} />
                )}
              </div>
              <input type="text" placeholder="J-Number (optional, e.g. J-10294)" value={jNumber}
                onChange={(e) => setJNumber(e.target.value)} className={inputCls} />
              <input type="number" placeholder="Estimated rack count (optional)" value={walkinCount}
                onChange={(e) => setWalkinCount(e.target.value)} min={0} className={inputCls} />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button type="submit"
                className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-700 transition-colors sm:w-auto">
                Create walk-in →
              </button>
            </form>
          ) : (
            <form onSubmit={handleScheduledSubmit} className="space-y-3">
              <div className="space-y-1">
                <input type="text" placeholder="Consigner name" value={consignerName}
                  onChange={(e) => setConsignerName(e.target.value)} className={inputCls} autoFocus />
                {summary && (
                  <ConsignerCard summary={summary} estimate={estimate?.estimate}
                    onSelect={() => {
                      setConsignerName(summary.canonicalName);
                      if (estimate) setExpectedCount(String(estimate.estimate));
                    }} />
                )}
              </div>
              <input type="text" placeholder="J-Number (optional, e.g. J-10294)" value={jNumber}
                onChange={(e) => setJNumber(e.target.value)} className={inputCls} />
              <input type="number" placeholder="Expected rack count" value={expectedCount}
                onChange={(e) => setExpectedCount(e.target.value)} min={1} className={inputCls} />
              <input type="date" value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)} className={inputCls} />
              <input type="text" placeholder="Notes (optional)" value={notes}
                onChange={(e) => setNotes(e.target.value)} className={inputCls} />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button type="submit"
                className="rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-700 transition-colors">
                Create delivery
              </button>
            </form>
          )}
        </div>
      )}

      <ErrorBanner error={storeError} onDismiss={clearStoreError} />

      {/* Status filter pills */}
      {!showForm && (
        <div className="flex gap-1.5">
          {(["all", "active", "done"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setDeliveryFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                deliveryFilter === f
                  ? "bg-orange-600 text-white"
                  : "bg-stone-100 text-stone-500 hover:bg-stone-200"
              }`}
            >
              {f === "all" ? "All" : f === "active" ? "Active" : "Done"}
            </button>
          ))}
        </div>
      )}

      {loading && sorted.length === 0 ? (
        <LoadingCards count={2} />
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-5 py-6 shadow-sm text-center space-y-1">
          <p className="text-sm font-medium text-stone-700">No deliveries yet</p>
          <p className="text-xs text-stone-400">
            Register a walk-in when a truck arrives, or schedule an upcoming delivery above.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {sorted.map((delivery) => {
            const linked     = racks.filter((r) => r.deliveryId === delivery.id);
            const done       = linked.filter((r) => r.status === "pickup" || r.status === "completed");
            const total      = Math.max(delivery.expectedRackCount, linked.length);
            const pct        = total > 0 ? Math.round((done.length / total) * 100) : 0;
            const nextStatus = NEXT_STATUS[delivery.status];

            return (
              <li
                key={delivery.id}
                className={`rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150 ${DELIVERY_STATUS_BORDER[delivery.status]}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-sm font-bold text-stone-900">{delivery.deliveryCode}</span>
                      <DeliveryStatusBadge status={delivery.status} />
                      {delivery.type === "walkin" && (
                        <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                          walk-in
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-stone-600">{delivery.consignerName}</p>
                    {delivery.consignerJNumber && (
                      <p className="text-xs text-stone-400 font-mono">{delivery.consignerJNumber}</p>
                    )}
                    <p className="mt-1 text-xs text-stone-400">
                      {delivery.type === "walkin" ? "Arrived today" : `Scheduled ${formatDate(delivery.scheduledDate)}`}
                      {" · "}
                      {delivery.expectedRackCount > 0
                        ? `${linked.length} / ${delivery.expectedRackCount} racks`
                        : `${linked.length} rack${linked.length !== 1 ? "s" : ""}`}
                    </p>
                    {delivery.notes && (
                      <p className="mt-0.5 text-xs text-stone-400 italic">{delivery.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {nextStatus && (
                      <button
                        onClick={() => setStatus(delivery.id, nextStatus)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${DELIVERY_NEXT_BTN[delivery.status]}`}
                      >
                        {DELIVERY_NEXT_LABEL[delivery.status]}
                      </button>
                    )}
                    <Link
                      href={`/deliveries/${delivery.id}`}
                      className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                    >
                      View
                    </Link>
                  </div>
                </div>

                {linked.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                      {PIPELINE_STAGES.map(({ status }) => {
                        const count = linked.filter((r) => r.status === status).length;
                        if (count === 0 || total === 0) return null;
                        return (
                          <div key={status} className={`h-full ${STAGE_BAR[status]}`}
                            style={{ width: `${(count / total) * 100}%` }} title={`${status}: ${count}`} />
                        );
                      })}
                    </div>
                    <p className="text-xs text-stone-400">
                      {done.length} done{total > 0 && ` (${pct}%)`} · {linked.length} total
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ConsignerCard({
  summary, estimate, onSelect,
}: {
  summary: ConsignerSummary;
  estimate?: number;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-left hover:bg-orange-50 hover:border-orange-200 transition-colors"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-stone-900">{summary.canonicalName}</p>
        <p className="text-xs text-stone-400">
          {summary.deliveryCount} past {summary.deliveryCount === 1 ? "delivery" : "deliveries"}
          {summary.avgRackCount > 0 && ` · avg ${summary.avgRackCount} racks`}
          {" · "}last {summary.lastDeliveryDate}
        </p>
      </div>
      {estimate && (
        <span className="shrink-0 rounded-md bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600">
          ~{estimate} racks
        </span>
      )}
    </button>
  );
}
