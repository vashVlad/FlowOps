"use client";

import { useState } from "react";
import Link from "next/link";
import { useZonesStore } from "@/store/zones";
import { useRacksStore } from "@/store/racks";
import { useDeliveriesStore } from "@/store/deliveries";
import { FIXED_ZONE_LABELS } from "@/lib/zones";
import { LoadingCards } from "@/components/LoadingCards";
import ErrorBanner from "@/components/ErrorBanner";
import PageHeader from "@/components/ui/PageHeader";
import { STAGE_BAR, DELIVERY_STATUS_BADGE, DELIVERY_STATUS_LABEL } from "@/lib/tokens";
import type { Zone, Delivery, Rack } from "@/types";

const inputCls =
  "w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500";

const MAX_CHIPS = 6;

// ── Rack chips ────────────────────────────────────────────────────────────────

function RackChips({ zoneRacks, max = MAX_CHIPS }: { zoneRacks: Rack[]; max?: number }) {
  if (zoneRacks.length === 0) return null;
  const visible = zoneRacks.slice(0, max);
  const overflow = zoneRacks.length - visible.length;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {visible.map((r) => (
        <span
          key={r.id}
          className={`inline-block rounded px-1 py-0.5 text-[9px] font-mono font-medium leading-none text-white ${r.auctionColor ? "" : STAGE_BAR[r.status]}`}
          style={r.auctionColor ? { backgroundColor: r.auctionColor } : undefined}
        >
          {r.rackCode}
        </span>
      ))}
      {overflow > 0 && (
        <span className="inline-block rounded px-1 py-0.5 text-[9px] font-mono leading-none bg-stone-200 text-stone-500">
          +{overflow}
        </span>
      )}
    </div>
  );
}

// ── Zone cell ─────────────────────────────────────────────────────────────────

function ZoneCell({
  zone, zoneRacks, assignedDelivery, tall = false,
}: {
  zone: Zone;
  zoneRacks: Rack[];
  assignedDelivery?: Delivery;
  tall?: boolean;
}) {
  const name = zone.name;
  const base = `rounded-lg border p-2.5 flex flex-col justify-between hover:shadow-sm hover:-translate-y-px transition-all duration-150 ${
    tall ? "h-full" : "min-h-[80px]"
  }`;

  const colorDot = zone.auctionColor ? (
    <span
      className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-white/60"
      style={{ backgroundColor: zone.auctionColor }}
    />
  ) : null;

  // ── Fixed utility zones (H, B, C) ─────────────────────────────────────────
  if (name === "H" || name === "B" || name === "C") {
    return (
      <Link href={`/zones/${zone.id}`} className={`${base} border-stone-200 bg-stone-100`}>
        <div className="flex items-start justify-between gap-1">
          <span className="text-sm font-bold leading-none text-stone-500">{name}</span>
          {tall && zoneRacks.length > 0 && (
            <span className="text-sm font-bold tabular-nums text-stone-500">{zoneRacks.length}</span>
          )}
        </div>
        <div>
          <p className="text-[10px] text-stone-400 leading-tight">{FIXED_ZONE_LABELS[name]}</p>
          <RackChips zoneRacks={zoneRacks} max={tall ? 20 : MAX_CHIPS} />
        </div>
      </Link>
    );
  }

  // ── PU ────────────────────────────────────────────────────────────────────
  if (name === "PU") {
    return (
      <Link href={`/zones/${zone.id}`} className={`${base} border-violet-200 bg-violet-50`}>
        <div className="flex items-start justify-between gap-1">
          <span className="text-sm font-bold leading-none text-violet-700">{name}</span>
          {colorDot}
        </div>
        <div>
          <p className="text-[10px] text-violet-500 leading-tight">Pick-Up</p>
          <RackChips zoneRacks={zoneRacks} />
        </div>
      </Link>
    );
  }

  // ── Arrived ───────────────────────────────────────────────────────────────
  if (assignedDelivery?.status === "arrived") {
    return (
      <Link href={`/zones/${zone.id}`} className={`${base} border-sky-200 bg-sky-50`}>
        <div className="flex items-start justify-between gap-1">
          <span className="text-sm font-bold leading-none text-sky-700">{name}</span>
          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-medium ${DELIVERY_STATUS_BADGE.arrived}`}>
            {DELIVERY_STATUS_LABEL.arrived}
          </span>
        </div>
        <div>
          {assignedDelivery.consignerJNumber && (
            <p className="text-[10px] font-mono font-semibold text-sky-700 leading-tight">
              {assignedDelivery.consignerJNumber}
            </p>
          )}
          <p className="text-[10px] text-sky-600 leading-tight line-clamp-1">{assignedDelivery.consignerName}</p>
          <RackChips zoneRacks={zoneRacks} />
        </div>
      </Link>
    );
  }

  // ── Processing ────────────────────────────────────────────────────────────
  if (assignedDelivery?.status === "processing") {
    return (
      <Link href={`/zones/${zone.id}`} className={`${base} border-emerald-200 bg-emerald-50`}>
        <div className="flex items-start justify-between gap-1">
          <span className="text-sm font-bold leading-none text-emerald-700">{name}</span>
          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-medium ${DELIVERY_STATUS_BADGE.processing}`}>
            {DELIVERY_STATUS_LABEL.processing}
          </span>
        </div>
        <div>
          {assignedDelivery.consignerJNumber && (
            <p className="text-[10px] font-mono font-semibold text-emerald-700 leading-tight">
              {assignedDelivery.consignerJNumber}
            </p>
          )}
          <p className="text-[10px] text-emerald-600 leading-tight line-clamp-1">{assignedDelivery.consignerName}</p>
          <RackChips zoneRacks={zoneRacks} />
        </div>
      </Link>
    );
  }

  // ── Scheduled ─────────────────────────────────────────────────────────────
  if (assignedDelivery?.status === "scheduled") {
    const dateStr = new Date(assignedDelivery.scheduledDate + "T00:00:00").toLocaleDateString("en-US", {
      month: "short", day: "numeric",
    });
    return (
      <Link href={`/zones/${zone.id}`} className={`${base} border-blue-200 bg-blue-50`}>
        <div className="flex items-start justify-between gap-1">
          <span className="text-sm font-bold leading-none text-blue-700">{name}</span>
          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-medium ${DELIVERY_STATUS_BADGE.scheduled}`}>
            {DELIVERY_STATUS_LABEL.scheduled}
          </span>
        </div>
        <div>
          {assignedDelivery.consignerJNumber && (
            <p className="text-[10px] font-mono font-semibold text-blue-700 leading-tight">
              {assignedDelivery.consignerJNumber}
            </p>
          )}
          <p className="text-[10px] text-blue-600 leading-tight line-clamp-1">{assignedDelivery.consignerName}</p>
          <p className="text-[10px] text-blue-400 leading-tight mt-0.5">{dateStr}</p>
        </div>
      </Link>
    );
  }

  // ── Reserved ──────────────────────────────────────────────────────────────
  if (zone.reserved) {
    return (
      <Link href={`/zones/${zone.id}`} className={`${base} border-amber-200 bg-amber-50`}>
        <div className="flex items-start justify-between gap-1">
          <span className="text-sm font-bold leading-none text-amber-700">{name}</span>
          {colorDot}
        </div>
        <p className="text-[10px] text-amber-500 leading-tight">{zone.label ?? "Reserved"}</p>
      </Link>
    );
  }

  // ── Auction (color set, no delivery) ──────────────────────────────────────
  if (zone.auctionColor) {
    const auctionDate = zone.auctionDate ?? assignedDelivery?.auctionDate;
    return (
      <Link href={`/zones/${zone.id}`} className={`${base} border-stone-200 bg-stone-50`}>
        <div className="flex items-start justify-between gap-1">
          <span className="text-sm font-bold leading-none text-stone-700">{name}</span>
          {colorDot}
        </div>
        {auctionDate && (
          <p className="text-[10px] text-stone-400 leading-tight font-mono">
            {new Date(auctionDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        )}
      </Link>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  return (
    <Link
      href={`/zones/${zone.id}`}
      className={`${base} border-dashed border-stone-200 bg-stone-50 opacity-50 hover:opacity-75 hover:translate-y-0`}
    >
      <span className="text-sm font-bold text-stone-400 leading-none">{name}</span>
    </Link>
  );
}

// ── Zones page ────────────────────────────────────────────────────────────────

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

  const byName = new Map(zones.map((z) => [z.name, z]));

  function resolve(zoneName: string) {
    const z = byName.get(zoneName);
    if (!z) return null;
    return {
      zone:             z,
      zoneRacks:        racks.filter((r) => r.zoneId === z.id),
      assignedDelivery: deliveries.find((d) => d.id === z.deliveryId),
    };
  }

  function cell(zoneName: string) {
    const r = resolve(zoneName);
    if (r) return <ZoneCell zone={r.zone} zoneRacks={r.zoneRacks} assignedDelivery={r.assignedDelivery} />;
    return (
      <div className="rounded-lg border border-dashed border-stone-200 p-2.5 min-h-[80px] opacity-20">
        <span className="text-sm font-bold text-stone-300 leading-none">{zoneName}</span>
      </div>
    );
  }

  const hData    = resolve("H");
  const hasGallery   = ["G4","G5","G6","G7","G2","G1","PU"].some((n) => byName.has(n));
  const hasWarehouse = ["W4","W5","W6","W3","W8","W7","W2","W9","W1","W10","B","C","H"].some((n) => byName.has(n));

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
        <form onSubmit={handleSubmit} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-3">
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
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-5">

          {/* Gallery */}
          {hasGallery && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400 mb-2">Gallery</p>
              <div className="grid grid-cols-4 gap-2">
                {cell("G4")} {cell("G5")} {cell("G6")} {cell("G7")}
                {cell("PU")} {cell("G2")} {cell("G1")} <div />
              </div>
            </div>
          )}

          {hasGallery && hasWarehouse && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-stone-200" />
              <span className="text-[9px] text-stone-300 shrink-0">court</span>
              <div className="flex-1 h-px bg-stone-200" />
            </div>
          )}

          {/* Warehouse — 4-col grid, H spans all 4 rows on the right */}
          {hasWarehouse && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400 mb-2">Warehouse</p>
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gridTemplateRows: "repeat(4, minmax(80px, auto))",
                }}
              >
                <div style={{ gridColumn: 1, gridRow: 1 }}>{cell("W4")}</div>
                <div style={{ gridColumn: 2, gridRow: 1 }}>{cell("W5")}</div>
                <div style={{ gridColumn: 3, gridRow: 1 }}>{cell("W6")}</div>
                <div style={{ gridColumn: 1, gridRow: 2 }}>{cell("W3")}</div>
                <div style={{ gridColumn: 2, gridRow: 2 }}>{cell("W8")}</div>
                <div style={{ gridColumn: 3, gridRow: 2 }}>{cell("W7")}</div>
                <div style={{ gridColumn: 1, gridRow: 3 }}>{cell("W2")}</div>
                <div style={{ gridColumn: 2, gridRow: 3 }}>{cell("W9")}</div>
                <div style={{ gridColumn: 3, gridRow: 3 }}>{cell("B")}</div>
                <div style={{ gridColumn: 1, gridRow: 4 }}>{cell("W1")}</div>
                <div style={{ gridColumn: 2, gridRow: 4 }}>{cell("W10")}</div>
                <div style={{ gridColumn: 3, gridRow: 4 }}>{cell("C")}</div>
                {/* H — full-height right column */}
                <div style={{ gridColumn: 4, gridRow: "1 / 5" }}>
                  {hData ? (
                    <ZoneCell
                      zone={hData.zone}
                      zoneRacks={hData.zoneRacks}
                      assignedDelivery={hData.assignedDelivery}
                      tall
                    />
                  ) : (
                    <div className="h-full rounded-lg border border-dashed border-stone-200 p-2.5 opacity-20">
                      <span className="text-sm font-bold text-stone-300 leading-none">H</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
