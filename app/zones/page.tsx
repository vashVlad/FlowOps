"use client";

import { useState } from "react";
import Link from "next/link";
import { useZonesStore } from "@/store/zones";
import { useRacksStore } from "@/store/racks";
import { useDeliveriesStore } from "@/store/deliveries";
import { getZoneOccupancy, FIXED_ZONE_LABELS } from "@/lib/zones";
import { LoadingCards } from "@/components/LoadingCards";
import ErrorBanner from "@/components/ErrorBanner";
import PageHeader from "@/components/ui/PageHeader";
import { OCCUPANCY_STYLE, OCCUPANCY_BADGE, OCCUPANCY_LABEL, DELIVERY_STATUS_BADGE, DELIVERY_STATUS_LABEL } from "@/lib/tokens";

const inputCls =
  "w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500";

export default function ZonesPage() {
  const { zones, loading, error: storeError, addZone } = useZonesStore();
  function clearStoreError() { useZonesStore.setState({ error: null }); }
  const { racks } = useRacksStore();
  const { deliveries } = useDeliveriesStore();

  const [showForm, setShowForm] = useState(false);
  const [name, setName]         = useState("");
  const [label, setLabel]       = useState("");
  const [capacity, setCapacity] = useState("");
  const [error, setError]       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Zone name required.");
    if (zones.some((z) => z.name.toUpperCase() === name.trim().toUpperCase()))
      return setError("Zone name already exists.");
    setError("");
    const result = await addZone({
      name: name.trim(),
      label: label.trim() || undefined,
      capacity: capacity ? Number(capacity) : undefined,
    });
    if (!result.ok) return;
    setName(""); setLabel(""); setCapacity(""); setShowForm(false);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Zones"
        action={
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
          >
            {showForm ? "Cancel" : "Add zone"}
          </button>
        }
      />

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-3"
        >
          <p className="text-sm font-medium text-stone-900">New zone</p>
          <input type="text" placeholder="Zone code (e.g. A3, C2)" value={name}
            onChange={(e) => setName(e.target.value)} className={inputCls} autoFocus />
          <input type="text" placeholder="Description (optional)" value={label}
            onChange={(e) => setLabel(e.target.value)} className={inputCls} />
          <input type="number" placeholder="Rack capacity (optional)" value={capacity}
            onChange={(e) => setCapacity(e.target.value)} min={1} className={inputCls} />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit"
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors">
            Create zone
          </button>
        </form>
      )}

      <ErrorBanner error={storeError} onDismiss={clearStoreError} />

      {loading && zones.length === 0 ? (
        <LoadingCards count={3} />
      ) : zones.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-5 py-6 shadow-sm text-center space-y-1">
          <p className="text-sm font-medium text-stone-700">No zones configured</p>
          <p className="text-xs text-stone-400">
            Zones represent physical floor sections — A1, B2, OVF. Create zones to assign racks and track occupancy.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {zones.map((zone) => {
            const { count, status } = getZoneOccupancy(zone.id, racks, zones);
            const assignedDelivery  = deliveries.find((d) => d.id === zone.deliveryId);
            const fixedLabel        = FIXED_ZONE_LABELS[zone.name];
            return (
              <li key={zone.id}>
                <Link
                  href={`/zones/${zone.id}`}
                  className={`block rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150 ${OCCUPANCY_STYLE[status]?.border ?? "border-stone-200"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-stone-900">{zone.name}</span>
                        {OCCUPANCY_LABEL[status] && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${OCCUPANCY_BADGE[status]}`}>
                            {OCCUPANCY_LABEL[status]}
                          </span>
                        )}
                      </div>
                      {fixedLabel ? (
                        <p className="mt-0.5 text-xs text-stone-400">{fixedLabel}</p>
                      ) : assignedDelivery ? (
                        <p className="mt-0.5 text-sm font-mono text-stone-600">
                          {assignedDelivery.consignerJNumber ?? assignedDelivery.consignerName}
                          {count > 0 && <span className="text-stone-400"> · {count} rack{count !== 1 ? "s" : ""}</span>}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs italic text-stone-400">Empty</p>
                      )}
                    </div>
                    {assignedDelivery && (
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${DELIVERY_STATUS_BADGE[assignedDelivery.status]}`}>
                        {DELIVERY_STATUS_LABEL[assignedDelivery.status]}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-stone-400">
                    {count > 0 ? `View ${count} rack${count !== 1 ? "s" : ""} →` : "View zone →"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
