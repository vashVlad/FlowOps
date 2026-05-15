"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRacksStore } from "@/store/racks";
import { useDeliveriesStore } from "@/store/deliveries";
import { isRackNeedsAttention, getTimeInCurrentStatus } from "@/lib/timeTracking";
import { formatBusinessDuration } from "@/lib/timeTracking";
import { STAGE_LABEL, STAGE_BADGE, PRIORITY_BORDER } from "@/lib/tokens";
import { STATUS_ORDER } from "@/lib/racks";
import PageHeader from "@/components/ui/PageHeader";
import { WAITING_STAGES } from "@/lib/timeTracking";
import type { RackStatus } from "@/types";

export default function NeedsAttentionPage() {
  const router = useRouter();
  const { racks, history, loading } = useRacksStore();
  const { deliveries } = useDeliveriesStore();

  const flagged = racks.filter(
    (r) => !r.holdReason && r.status !== "completed" && isRackNeedsAttention(r, history)
  );

  // Group by stage, preserving pipeline order
  const activeStatuses = STATUS_ORDER.filter((s) => s !== "completed") as RackStatus[];
  const groups = activeStatuses
    .map((status) => ({
      status,
      racks: flagged
        .filter((r) => r.status === status)
        .map((r) => ({
          rack:        r,
          timeInStage: getTimeInCurrentStatus(r, history),
          delivery:    deliveries.find((d) => d.id === r.deliveryId),
        }))
        .sort((a, b) => b.timeInStage - a.timeInStage),
    }))
    .filter((g) => g.racks.length > 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Needs Attention"
        subtitle={
          flagged.length > 0
            ? `${flagged.length} rack${flagged.length !== 1 ? "s" : ""} over their stage time limit`
            : "All racks are within time limits"
        }
        action={
          <Link
            href="/racks"
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            ← All racks
          </Link>
        }
      />

      {loading && racks.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-5 py-6 shadow-sm text-center">
          <p className="text-sm text-stone-400">Loading…</p>
        </div>
      ) : flagged.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-5 py-8 shadow-sm text-center space-y-2">
          <div className="flex justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-5 w-5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </span>
          </div>
          <p className="text-sm font-medium text-stone-700">All racks are on track</p>
          <p className="text-xs text-stone-400">No racks have exceeded their stage time limit.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ status, racks: groupRacks }) => (
            <div key={status} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STAGE_BADGE[status]}`}>
                  {STAGE_LABEL[status]}
                </span>
                <span className="text-xs text-stone-400">{groupRacks.length} rack{groupRacks.length !== 1 ? "s" : ""}</span>
                {WAITING_STAGES.has(status) && (
                  <span className="text-[11px] text-stone-400">(scheduled wait)</span>
                )}
              </div>

              <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {groupRacks.map(({ rack, timeInStage, delivery }) => {
                  const isCritical = rack.priority === "high";
                  const borderKey  = isCritical ? "needs_attention" : rack.priority === "low" ? "low" : "normal";

                  return (
                    <li
                      key={rack.id}
                      onClick={() => router.push(`/racks/${rack.id}`)}
                      className={`cursor-pointer rounded-xl border border-stone-200 bg-white px-4 py-3.5 shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150 ${PRIORITY_BORDER[borderKey]}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-sm font-bold text-stone-900">{rack.rackCode}</span>
                            {isCritical && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                                high
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-400 mt-0.5 truncate">{rack.consignerName}</p>
                          {delivery && (
                            <Link
                              href={`/deliveries/${delivery.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[11px] text-stone-400 hover:text-orange-600 font-mono transition-colors"
                            >
                              {delivery.consignerJNumber ?? delivery.deliveryCode}
                            </Link>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-semibold tabular-nums ${isCritical ? "text-red-600" : "text-amber-600"}`}>
                            {formatBusinessDuration(timeInStage)}
                          </p>
                          <p className="text-[11px] text-stone-400">in stage</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
