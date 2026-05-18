"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRacksStore } from "@/store/racks";
import { useDeliveriesStore } from "@/store/deliveries";
import { usePrintQueueStore } from "@/store/printQueue";
import { RackLabel } from "@/components/RackLabel";
import type { Rack, Delivery } from "@/types";

type QueueEntry = { rack: Rack; delivery?: Delivery };

export default function PrintQueuePage() {
  const { racks }      = useRacksStore();
  const { deliveries } = useDeliveriesStore();
  const { ids, remove, clear } = usePrintQueueStore();

  const [baseUrl, setBaseUrl] = useState("");
  const printDate = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const queued: QueueEntry[] = ids
    .map((id): QueueEntry | null => {
      const rack = racks.find((r) => r.id === id);
      if (!rack) return null;
      const delivery = rack.deliveryId ? deliveries.find((d) => d.id === rack.deliveryId) : undefined;
      return { rack, delivery };
    })
    .filter((x): x is QueueEntry => x !== null);

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0.5in; }
          .print-labels { display: block !important; }
          .label-item { page-break-after: always; padding: 0; }
          .label-item:last-child { page-break-after: avoid; }
          .label-item-inner { display: flex; justify-content: center; }
        }
        @media screen {
          .print-labels { display: none; }
        }
      `}</style>

      {/* ── Screen UI ─────────────────────────────────────────────────────────── */}
      <div className="no-print space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-stone-900 tracking-tight">Print Queue</h1>
            <p className="mt-0.5 text-sm text-stone-400">
              {queued.length === 0
                ? "No labels queued"
                : `${queued.length} label${queued.length !== 1 ? "s" : ""} ready to print`}
            </p>
          </div>
          {queued.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={clear}
                className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-500 hover:bg-stone-50 transition-colors"
              >
                Clear all
              </button>
              <button
                onClick={() => window.print()}
                className="rounded-lg bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
              >
                Print all
              </button>
            </div>
          )}
        </div>

        {queued.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white px-5 py-12 shadow-sm text-center space-y-2">
            <p className="text-sm font-medium text-stone-700">Queue is empty</p>
            <p className="text-xs text-stone-400">
              Check "Add to print queue" when creating racks, or use the queue button on any rack detail page.
            </p>
            <Link href="/racks" className="inline-block mt-2 text-xs text-orange-600 hover:underline transition-colors">
              Go to racks →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {queued.map(({ rack, delivery }) => (
              <div
                key={rack.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {rack.auctionColor && (
                    <span
                      className="h-3 w-3 rounded-full shrink-0 ring-1 ring-stone-200"
                      style={{ backgroundColor: rack.auctionColor }}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-stone-900 font-mono">{rack.rackCode}</p>
                    <p className="text-xs text-stone-400 truncate">
                      {rack.consignerName}
                      {delivery?.consignerJNumber && ` · ${delivery.consignerJNumber}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    href={`/racks/${rack.id}/label`}
                    target="_blank"
                    className="text-xs text-stone-400 hover:text-stone-700 transition-colors"
                  >
                    Preview
                  </Link>
                  <button
                    onClick={() => remove(rack.id)}
                    className="text-xs text-stone-400 hover:text-red-500 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {queued.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-sm text-stone-400">
              Set scale to 100% and disable headers/footers in your print dialog.
            </p>
            <button
              onClick={() => window.print()}
              className="shrink-0 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
            >
              Print all
            </button>
          </div>
        )}
      </div>

      {/* ── Print-only labels ─────────────────────────────────────────────────── */}
      <div className="print-labels">
        {queued.map(({ rack, delivery }) => (
          <div key={rack.id} className="label-item">
            <div className="label-item-inner">
              <RackLabel
                rack={rack}
                delivery={delivery}
                rackUrl={baseUrl ? `${baseUrl}/racks/${rack.id}` : ""}
                printDate={printDate}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
