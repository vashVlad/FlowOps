"use client";

import { useState } from "react";
import Link from "next/link";
import { useZonesStore } from "@/store/zones";
import { useRacksStore } from "@/store/racks";
import { useDeliveriesStore } from "@/store/deliveries";
import { getZoneOccupancy } from "@/lib/zones";
import { LoadingCards } from "@/components/LoadingCards";
import ErrorBanner from "@/components/ErrorBanner";
import PageHeader from "@/components/ui/PageHeader";
import { DELIVERY_STATUS_BADGE, DELIVERY_STATUS_LABEL } from "@/lib/tokens";

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
            Zones are physical floor areas — e.g. A1, B2, OVF. Add one above to start assigning racks.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {zones.map((zone) => {
            const { count } = getZoneOccupancy(zone.id, racks, zones);
            const delivery = deliveries.find((d) => d.zoneId === zone.id);

            return (
              <li key={zone.id}
                className="rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className="text-base font-bold text-stone-900">{zone.name}</span>
                    {zone.label ? (
                      <p className="mt-0.5 font-mono text-sm text-stone-700">
                        {zone.label}{count > 0 ? ` · ${count} rack${count !== 1 ? "s" : ""}` : ""}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-sm text-stone-400 italic">Empty</p>
                    )}
                  </div>
                  {delivery && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${DELIVERY_STATUS_BADGE[delivery.status]}`}>
                      {DELIVERY_STATUS_LABEL[delivery.status]}
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <Link href={`/zones/${zone.id}`}
                    className="text-xs font-medium text-stone-400 hover:text-orange-600 transition-colors">
                    View {count > 0 ? `${count} rack${count !== 1 ? "s" : ""}` : "zone"} →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
