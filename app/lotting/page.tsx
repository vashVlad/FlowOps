"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRacksStore } from "@/store/racks";
import { useDeliveriesStore } from "@/store/deliveries";
import StatusBadge from "@/components/StatusBadge";
import { LoadingCards } from "@/components/LoadingCards";
import PageHeader from "@/components/ui/PageHeader";
import { formatBusinessDuration } from "@/lib/timeTracking";
import { getTimeInCurrentStatus, isRackNeedsAttention } from "@/lib/timeTracking";
import { PRIORITY_BORDER, STAGE_LABEL } from "@/lib/tokens";
import { useToastStore } from "@/store/toast";
import { OperationalAlerts, type AlertItem } from "@/components/OperationalAlerts";
import { LOTTING_QUEUE_WARN } from "@/lib/timeTracking";

export default function LottingPage() {
  const router = useRouter();
  const { racks, history, loading, advanceStatus } = useRacksStore();
  const addToast = useToastStore((s) => s.add);
  const { deliveries } = useDeliveriesStore();

  const sortedQueue = racks
    .filter((r) => r.status === "sorted")
    .map((r) => ({
      rack:           r,
      waitMs:         getTimeInCurrentStatus(r, history),
      needsAttention: isRackNeedsAttention(r, history),
    }))
    .sort((a, b) => {
      // High priority first, then by wait time (longest first)
      if (a.rack.priority === "high" && b.rack.priority !== "high") return -1;
      if (b.rack.priority === "high" && a.rack.priority !== "high") return  1;
      return b.waitMs - a.waitMs;
    });

  const lottingRacks = racks
    .filter((r) => r.status === "lotting")
    .map((r) => ({
      rack:           r,
      waitMs:         getTimeInCurrentStatus(r, history),
      needsAttention: isRackNeedsAttention(r, history),
    }))
    .sort((a, b) => b.waitMs - a.waitMs);

  const totalQueue = sortedQueue.length + lottingRacks.length;

  const lottingAlerts: AlertItem[] = [];
  if (totalQueue > 15) {
    lottingAlerts.push({
      severity: "critical",
      message:  `Lotting queue overloaded — ${totalQueue} racks`,
      detail:   "Exceeds max daily capacity. Add staff or extend hours.",
    });
  } else if (totalQueue > LOTTING_QUEUE_WARN) {
    lottingAlerts.push({
      severity: "warning",
      message:  `Lotting queue high — ${totalQueue} racks`,
      detail:   `Above recommended daily capacity of ${LOTTING_QUEUE_WARN}.`,
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lotting queue"
        action={
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-sm font-medium text-stone-600">
            {totalQueue} rack{totalQueue !== 1 ? "s" : ""}
          </span>
        }
      />

      <OperationalAlerts alerts={lottingAlerts} />

      {loading && racks.length === 0 ? (
        <LoadingCards count={2} />
      ) : totalQueue === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-5 py-6 shadow-sm flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-medium text-stone-700">Lotting queue is clear</p>
            <p className="text-xs text-stone-400">No racks waiting to be lotted.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── Queue: Sorted racks waiting to be lotted ── */}
          {sortedQueue.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Ready to lot
                </p>
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
                  {sortedQueue.length}
                </span>
              </div>
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {sortedQueue.map(({ rack, waitMs, needsAttention }, i) => {
                  const delivery    = deliveries.find((d) => d.id === rack.deliveryId);
                  const isCritical  = needsAttention && rack.priority === "high";
                  const borderKey   = isCritical ? "needs_attention" : rack.priority === "high" ? "high" : rack.priority === "low" ? "low" : "normal";

                  return (
                    <li
                      key={rack.id}
                      onClick={() => router.push(`/racks/${rack.id}`)}
                      className={`cursor-pointer rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150 ${PRIORITY_BORDER[borderKey]}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-mono text-stone-400 shrink-0">#{i + 1}</span>
                            <span className="text-sm font-bold text-stone-900">{rack.rackCode}</span>
                            {isCritical ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                needs attention · {formatBusinessDuration(waitMs)}
                              </span>
                            ) : needsAttention ? (
                              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-xs text-amber-600">
                                needs attention · {formatBusinessDuration(waitMs)}
                              </span>
                            ) : rack.priority === "high" ? (
                              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                                high
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-stone-400 mt-0.5">{rack.consignerName}</p>
                          <div className="mt-1 flex items-center gap-3">
                            <span className="text-xs text-stone-400">
                              {STAGE_LABEL["sorted"]} {formatBusinessDuration(waitMs)}
                            </span>
                            {delivery && (
                              <Link
                                href={`/deliveries/${delivery.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-stone-400 hover:text-orange-600"
                              >
                                {delivery.consignerJNumber ?? delivery.deliveryCode}
                              </Link>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={rack.status} />
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const result = await advanceStatus(rack.id);
                              if (result.ok) addToast(`${rack.rackCode} moved to lotting`);
                            }}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors ${
                              isCritical ? "bg-red-500 hover:bg-red-600" : "bg-orange-500 hover:bg-orange-600"
                            }`}
                          >
                            Start lotting
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* ── Active: racks currently being lotted ── */}
          {lottingRacks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Currently lotting
                </p>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {lottingRacks.length}
                </span>
              </div>
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {lottingRacks.map(({ rack, waitMs, needsAttention }, i) => {
                  const delivery   = deliveries.find((d) => d.id === rack.deliveryId);
                  const isCritical = needsAttention && rack.priority === "high";
                  const borderKey  = isCritical ? "needs_attention" : rack.priority === "high" ? "high" : rack.priority === "low" ? "low" : "normal";

                  return (
                    <li
                      key={rack.id}
                      onClick={() => router.push(`/racks/${rack.id}`)}
                      className={`cursor-pointer rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150 ${PRIORITY_BORDER[borderKey]}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-mono text-stone-400 shrink-0">#{i + 1}</span>
                            <span className="text-sm font-bold text-stone-900">{rack.rackCode}</span>
                            {isCritical ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                needs attention · {formatBusinessDuration(waitMs)}
                              </span>
                            ) : needsAttention ? (
                              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-xs text-amber-600">
                                needs attention · {formatBusinessDuration(waitMs)}
                              </span>
                            ) : rack.priority === "high" ? (
                              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                                high
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-stone-400 mt-0.5">{rack.consignerName}</p>
                          <div className="mt-1 flex items-center gap-3">
                            <span className={`text-xs font-medium ${needsAttention ? "text-amber-600" : "text-stone-400"}`}>
                              In lotting {formatBusinessDuration(waitMs)}
                            </span>
                            {delivery && (
                              <Link
                                href={`/deliveries/${delivery.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-stone-400 hover:text-orange-600"
                              >
                                {delivery.consignerJNumber ?? delivery.deliveryCode}
                              </Link>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={rack.status} />
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const result = await advanceStatus(rack.id);
                              if (result.ok) addToast(`${rack.rackCode} moved to ready`);
                            }}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors ${
                              isCritical ? "bg-red-500 hover:bg-red-600" : "bg-orange-500 hover:bg-orange-600"
                            }`}
                          >
                            Mark ready
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
