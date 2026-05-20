"use client";

import { useState } from "react";
import Link from "next/link";
import { useDeliveriesStore } from "@/store/deliveries";
import { useRacksStore } from "@/store/racks";
import { usePrintQueueStore } from "@/store/printQueue";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import AuctionColorPicker from "@/components/ui/AuctionColorPicker";
import { today } from "@/lib/utils";
import type { Delivery } from "@/types";

// ── Step 1: Delivery picker ────────────────────────────────────────────────────

function DeliveryPicker({
  selected,
  onSelect,
}: {
  selected: Delivery | null;
  onSelect: (d: Delivery) => void;
}) {
  const deliveries = useDeliveriesStore((s) => s.deliveries);
  const [query, setQuery] = useState("");
  const todayStr = today();

  const active = deliveries
    .filter((d) => d.status !== "complete")
    .sort((a, b) => {
      // Today's and in-progress deliveries first
      const aToday = a.scheduledDate === todayStr || a.status === "arrived" || a.status === "processing";
      const bToday = b.scheduledDate === todayStr || b.status === "arrived" || b.status === "processing";
      if (aToday !== bToday) return aToday ? -1 : 1;
      return a.consignerName.localeCompare(b.consignerName);
    });

  const filtered = query.trim()
    ? active.filter((d) =>
        d.consignerName.toLowerCase().includes(query.toLowerCase()) ||
        d.deliveryCode.toLowerCase().includes(query.toLowerCase())
      )
    : active;

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search delivery or consigner…"
        className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
      />

      <div className="space-y-1.5 max-h-72 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-sm text-stone-400 text-center py-6">No active deliveries found</p>
        )}
        {filtered.map((d) => {
          const isSelected = selected?.id === d.id;
          const isToday    = d.scheduledDate === todayStr;
          return (
            <button
              key={d.id}
              onClick={() => onSelect(d)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-all ${
                isSelected
                  ? "border-orange-400 bg-orange-50"
                  : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50"
              }`}
            >
              <div>
                <p className={`text-sm font-semibold ${isSelected ? "text-orange-800" : "text-stone-900"}`}>
                  {d.consignerName}
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {d.deliveryCode}
                  {isToday && " · Today"}
                  {d.type === "walkin" && " · Walk-in"}
                </p>
              </div>
              {isSelected && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-orange-600 shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 2: Quick rack create ──────────────────────────────────────────────────

function RackCreateForm({
  delivery,
  onCreated,
}: {
  delivery: Delivery;
  onCreated: (rackId: string, rackCode: string) => void;
}) {
  const addRack     = useRacksStore((s) => s.addRack);
  const addToQueue  = usePrintQueueStore((s) => s.add);

  const [auctionColor, setAuctionColor] = useState("");
  const [customCode,   setCustomCode]   = useState("");
  const [creating,     setCreating]     = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const result = await addRack({
        consignerName: delivery.consignerName,
        status:        "unpacking_sorting",
        deliveryId:    delivery.id,
        auctionColor:  auctionColor || undefined,
        rackCode:      customCode.trim() || undefined,
      });
      if (!result.ok) throw new Error(result.error);
      addToQueue(result.data.id);
      onCreated(result.data.id, result.data.rackCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create rack");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-orange-50 border border-orange-100 px-4 py-3 flex items-center gap-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-orange-600 shrink-0">
          <rect x="1" y="3" width="15" height="13" rx="1" />
          <path d="M16 8h4l3 5v4h-7V8z" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-orange-800 truncate">{delivery.consignerName}</p>
          <p className="text-[11px] text-orange-600">{delivery.deliveryCode}</p>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide block mb-2">
          Auction color
        </label>
        <AuctionColorPicker value={auctionColor} onChange={setAuctionColor} />
      </div>

      <div>
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide block mb-1.5">
          Rack code <span className="normal-case text-stone-400 font-normal">(optional — auto-generated if blank)</span>
        </label>
        <input
          type="text"
          value={customCode}
          onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
          placeholder="e.g. RC-0099"
          className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm font-mono text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        onClick={handleCreate}
        disabled={creating}
        className="w-full rounded-xl bg-orange-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {creating ? (
          "Creating…"
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create rack &amp; add to print queue
          </>
        )}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UnpackPage() {
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [recentRacks, setRecentRacks] = useState<{ id: string; code: string }[]>([]);
  const printQueueIds  = usePrintQueueStore((s) => s.ids);

  function handleCreated(id: string, code: string) {
    setRecentRacks((prev) => [{ id, code }, ...prev].slice(0, 5));
  }

  return (
    <>
      <PageHeader
        title="Unpacking"
        subtitle="Create racks and queue labels for printing"
        action={
          printQueueIds.length > 0 ? (
            <Link
              href="/labels/queue"
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print {printQueueIds.length} label{printQueueIds.length !== 1 ? "s" : ""}
            </Link>
          ) : undefined
        }
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Step 1 */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-600 text-[11px] font-bold text-white">1</span>
            <p className="text-sm font-semibold text-stone-900">Select delivery</p>
          </div>
          <DeliveryPicker selected={selectedDelivery} onSelect={setSelectedDelivery} />
        </Card>

        {/* Step 2 */}
        <Card className={!selectedDelivery ? "opacity-40 pointer-events-none" : ""}>
          <div className="flex items-center gap-2 mb-4">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white ${selectedDelivery ? "bg-orange-600" : "bg-stone-300"}`}>2</span>
            <p className="text-sm font-semibold text-stone-900">Create rack</p>
          </div>
          {selectedDelivery ? (
            <RackCreateForm
              delivery={selectedDelivery}
              onCreated={handleCreated}
            />
          ) : (
            <p className="text-sm text-stone-400">Select a delivery first</p>
          )}
        </Card>
      </div>

      {/* Recently created this session */}
      {recentRacks.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
            Created this session
          </p>
          <Card padding="p-0" className="divide-y divide-stone-50">
            {recentRacks.map(({ id, code }) => (
              <div key={id} className="flex items-center justify-between px-4 py-3">
                <p className="text-sm font-mono font-medium text-stone-900">{code}</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-emerald-600 font-medium">Added to queue</span>
                  <Link href={`/racks/${id}`} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
                    View →
                  </Link>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}
    </>
  );
}
