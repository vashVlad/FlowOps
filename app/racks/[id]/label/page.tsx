"use client";

import { Suspense, useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useRacksStore } from "@/store/racks";
import { useDeliveriesStore } from "@/store/deliveries";
import { usePrintQueueStore } from "@/store/printQueue";
import { RackLabel } from "@/components/RackLabel";

function RackLabelContent() {
  const { id }         = useParams<{ id: string }>();
  const router         = useRouter();
  const searchParams   = useSearchParams();
  const { racks }      = useRacksStore();
  const { deliveries } = useDeliveriesStore();
  const { has, add, remove } = usePrintQueueStore();

  const [rackUrl, setRackUrl] = useState("");
  useEffect(() => {
    setRackUrl(`${window.location.origin}/racks/${id}`);
  }, [id]);

  const rack      = racks.find((r) => r.id === id);
  const delivery  = rack ? deliveries.find((d) => d.id === rack.deliveryId) : undefined;
  const printDate = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const inQueue   = rack ? has(rack.id) : false;

  const consignerParam = searchParams.get("consigner");
  const jnumberParam   = searchParams.get("jnumber");
  const consignerOverride = consignerParam
    ? { name: consignerParam, jNumber: jnumberParam ?? undefined }
    : undefined;

  if (!rack) {
    return (
      <div className="p-8 text-center space-y-2">
        <p className="text-sm font-medium text-stone-700">Rack not found</p>
        <button onClick={() => router.back()} className="text-xs text-orange-600 hover:underline">← Back to racks</button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0.6in; }
        }
      `}</style>

      <div className="no-print flex items-center gap-3 mb-8 flex-wrap">
        <button
          onClick={() => router.back()}
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
        >
          Print label
        </button>
        {!consignerOverride && (
          <button
            onClick={() => inQueue ? remove(rack.id) : add(rack.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              inQueue
                ? "border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100"
                : "border-stone-200 text-stone-600 hover:bg-stone-50"
            }`}
          >
            {inQueue ? "In print queue" : "Add to queue"}
          </button>
        )}
        {consignerOverride && (
          <span className="text-xs text-stone-400">Extra consigner label — {consignerOverride.name}</span>
        )}
        <p className="text-xs text-stone-400">Set scale to 100% and disable headers/footers in your print dialog.</p>
      </div>

      <div className="flex justify-center">
        <RackLabel
          rack={rack}
          delivery={delivery}
          rackUrl={rackUrl}
          printDate={printDate}
          consignerOverride={consignerOverride}
        />
      </div>
    </>
  );
}

export default function RackLabelPage() {
  return (
    <Suspense>
      <RackLabelContent />
    </Suspense>
  );
}
