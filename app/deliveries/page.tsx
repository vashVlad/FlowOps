"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDeliveriesStore } from "@/store/deliveries";
import { useRacksStore } from "@/store/racks";
import { useZonesStore } from "@/store/zones";
import { useNotesStore } from "@/store/notes";
import Select from "@/components/Select";
import DeliveryStatusBadge from "@/components/DeliveryStatusBadge";
import { LoadingCards } from "@/components/LoadingCards";
import ErrorBanner from "@/components/ErrorBanner";
import { formatDate, today, timeAgo } from "@/lib/utils";
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
  scheduled:          "arrived",
  arrived:            "processing",
  processing:         "unpacking_complete",
  unpacking_complete: "complete",
  complete:           null,
};

// Lower = earlier in list
const STATUS_SORT: Record<DeliveryStatus, number> = {
  processing:         0,
  unpacking_complete: 1,
  arrived:            2,
  scheduled:          3,
  complete:           4,
};

type FormMode = "walkin" | "scheduled";

function formatAuctionDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

const LAST_VISITED_KEY = "flowops:lastVisitedDelivery";

export default function DeliveriesPage() {
  const router = useRouter();
  const { deliveries, loading, error: storeError, addDelivery, setStatus } = useDeliveriesStore();
  function clearStoreError() { useDeliveriesStore.setState({ error: null }); }
  const { racks }  = useRacksStore();
  const { zones }  = useZonesStore();
  const { notes }  = useNotesStore();

  const [lastVisited, setLastVisited] = useState<string | null>(null);

  useEffect(() => {
    setLastVisited(localStorage.getItem(LAST_VISITED_KEY));
  }, []);

  const [showForm, setShowForm]         = useState(false);
  const [formMode, setFormMode]         = useState<FormMode>("walkin");
  const [consignerName, setConsignerName] = useState("");
  const [jNumber, setJNumber]           = useState("");
  const [error, setError]               = useState("");
  const [walkinCount, setWalkinCount]   = useState("");
  const [expectedCount, setExpectedCount] = useState("");
  const [scheduledDate, setScheduledDate] = useState(today());
  const [auctionDate, setAuctionDate]   = useState("");

  const estimate = estimateRackCount(consignerName, deliveries, racks);
  const summary  = getConsignerSummary(consignerName, deliveries, racks);

  function resetForm() {
    setConsignerName(""); setJNumber(""); setError(""); setWalkinCount("");
    setExpectedCount(""); setScheduledDate(today()); setAuctionDate("");
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
      auctionDate: auctionDate || undefined,
    });
    if (!result.ok) return;
    const id = result.data.id;
    localStorage.setItem(LAST_VISITED_KEY, id);
    resetForm(); setShowForm(false);
    router.push(`/deliveries/${id}`);
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
      auctionDate: auctionDate || undefined,
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
    .sort((a, b) => {
      // Pinned: last visited always first
      if (a.id === lastVisited) return -1;
      if (b.id === lastVisited) return 1;
      // Sort by status group
      const statusDiff = STATUS_SORT[a.status] - STATUS_SORT[b.status];
      if (statusDiff !== 0) return statusDiff;
      // Within same status: most racks first
      const aCount = racks.filter((r) => r.deliveryId === a.id).length;
      const bCount = racks.filter((r) => r.deliveryId === b.id).length;
      return bCount - aCount;
    });

  function navigateToDelivery(id: string) {
    localStorage.setItem(LAST_VISITED_KEY, id);
    setLastVisited(id);
    router.push(`/deliveries/${id}`);
  }

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
              <div className="space-y-1">
                <label className="text-xs text-stone-400">Auction date (optional)</label>
                <input type="date" value={auctionDate}
                  onChange={(e) => setAuctionDate(e.target.value)} className={inputCls} />
              </div>
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
              <div className="space-y-1">
                <label className="text-xs text-stone-400">Auction date (optional)</label>
                <input type="date" value={auctionDate}
                  onChange={(e) => setAuctionDate(e.target.value)} className={inputCls} />
              </div>
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
            Register a walk-in when a truck arrives, or schedule a delivery before it shows up.
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
            const zone       = zones.find((z) => z.deliveryId === delivery.id);
            const noteCount  = notes.filter((n) => n.deliveryId === delivery.id).length;
            const auctionDays = delivery.auctionDate ? businessDaysUntil(delivery.auctionDate) : null;
            const auctionUrgent = auctionDays !== null && auctionDays >= 0 && auctionDays <= 3;
            const isPinned   = delivery.id === lastVisited;

            return (
              <li
                key={delivery.id}
                onClick={() => navigateToDelivery(delivery.id)}
                className={`cursor-pointer rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150 ${DELIVERY_STATUS_BORDER[delivery.status]}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-base font-bold text-stone-900">
                        {delivery.consignerJNumber ?? delivery.deliveryCode}
                      </span>
                      <DeliveryStatusBadge status={delivery.status} />
                      {delivery.type === "walkin" && (
                        <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                          walk-in
                        </span>
                      )}
                      {isPinned && (
                        <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[11px] font-medium text-orange-500">
                          recent
                        </span>
                      )}
                      {noteCount > 0 && (
                        <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-600">
                          {noteCount} note{noteCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-stone-700">{delivery.consignerName}</p>
                    <p className="mt-1 text-xs text-stone-400">
                      {delivery.arrivedAt ? `Arrived ${timeAgo(delivery.arrivedAt)}` : `Scheduled ${formatDate(delivery.scheduledDate)}`}
                      {zone && <><span className="mx-1">·</span><span className="font-medium text-stone-500">{zone.name}</span></>}
                    </p>
                    {delivery.auctionDate && (
                      <p className={`mt-0.5 text-xs font-medium ${
                        auctionDays !== null && auctionDays < 0 ? "text-red-500" :
                        auctionUrgent ? "text-amber-600" : "text-stone-400"
                      }`}>
                        Auction: {formatAuctionDate(delivery.auctionDate)}
                        {auctionUrgent && auctionDays !== null && (
                          <span className="ml-1">· {auctionDays === 0 ? "today" : auctionDays === 1 ? "tomorrow" : `${auctionDays}d`}</span>
                        )}
                      </p>
                    )}
                  </div>

                  {nextStatus && (
                    <div className="shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setStatus(delivery.id, nextStatus); }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${DELIVERY_NEXT_BTN[delivery.status]}`}
                      >
                        {DELIVERY_NEXT_LABEL[delivery.status]}
                      </button>
                    </div>
                  )}
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
