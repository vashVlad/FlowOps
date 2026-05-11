"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRacksStore } from "@/store/racks";
import { useDeliveriesStore } from "@/store/deliveries";
import StatusBadge from "@/components/StatusBadge";
import { LoadingCards } from "@/components/LoadingCards";
import PageHeader from "@/components/ui/PageHeader";
import { formatBusinessDuration } from "@/lib/timeTracking";
import { getTimeInCurrentStatus, isRackStuck } from "@/lib/timeTracking";
import { PRIORITY_BORDER } from "@/lib/tokens";
import { useToastStore } from "@/store/toast";
import { OperationalAlerts, type AlertItem } from "@/components/OperationalAlerts";
import { LOTTING_QUEUE_WARN } from "@/lib/timeTracking";

export default function LottingPage() {
  const router = useRouter();
  const { racks, history, loading, advanceStatus } = useRacksStore();
  const addToast = useToastStore((s) => s.add);
  const { deliveries } = useDeliveriesStore();

  const lottingRacks = racks
    .filter((r) => r.status === "lotting")
    .map((r) => ({
      rack:   r,
      waitMs: getTimeInCurrentStatus(r, history),
      stuck:  isRackStuck(r, history),
    }))
    .sort((a, b) => b.waitMs - a.waitMs);

  const lottingAlerts: AlertItem[] = [];
  if (lottingRacks.length > 15) {
    lottingAlerts.push({
      severity: "critical",
      message:  `Lotting queue overloaded — ${lottingRacks.length} racks`,
      detail:   "Exceeds max daily capacity. Add staff or extend hours.",
    });
  } else if (lottingRacks.length > LOTTING_QUEUE_WARN) {
    lottingAlerts.push({
      severity: "warning",
      message:  `Lotting queue high — ${lottingRacks.length} racks`,
      detail:   `Above recommended daily capacity of ${LOTTING_QUEUE_WARN}.`,
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lotting queue"
        action={
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-sm font-medium text-stone-600">
            {lottingRacks.length} rack{lottingRacks.length !== 1 ? "s" : ""}
          </span>
        }
      />

      <OperationalAlerts alerts={lottingAlerts} />

      {loading && racks.length === 0 ? (
        <LoadingCards count={2} />
      ) : lottingRacks.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-5 py-6 shadow-sm flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-medium text-stone-700">Lotting queue is clear</p>
            <p className="text-xs text-stone-400">No racks in the lotting queue.</p>
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {lottingRacks.map(({ rack, waitMs, stuck }, i) => {
            const delivery = deliveries.find((d) => d.id === rack.deliveryId);
            const isCritical = stuck && rack.priority === "high";
            const borderKey  = isCritical ? "stuck" : rack.priority === "high" ? "high" : rack.priority === "low" ? "low" : "normal";

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
                          critical · {formatBusinessDuration(waitMs)}
                        </span>
                      ) : stuck ? (
                        <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-xs text-red-400">
                          stuck · {formatBusinessDuration(waitMs)}
                        </span>
                      ) : rack.priority === "high" ? (
                        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                          high
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">{rack.consignerName}</p>
                    <div className="mt-1 flex items-center gap-3">
                      <span className={`text-xs font-medium ${
                        stuck ? "text-orange-600" :
                        waitMs > 4 * 24 * 60 * 60 * 1000 ? "text-amber-600" :
                        "text-stone-400"
                      }`}>
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
  );
}
