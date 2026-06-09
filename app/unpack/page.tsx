"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useDeliveriesStore } from "@/store/deliveries";
import { useRacksStore } from "@/store/racks";
import { usePrintQueueStore } from "@/store/printQueue";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import AuctionColorPicker from "@/components/ui/AuctionColorPicker";
import { today, timeAgo } from "@/lib/utils";
import { STAGE_BADGE, STAGE_LABEL, STAGE_DOT } from "@/lib/tokens";
import type { RackStatus } from "@/types";
import type { Delivery, Rack } from "@/types";

// ── Step 1: Delivery picker ────────────────────────────────────────────────────

function DeliveryPicker({
  selected,
  noConsigner,
  onSelect,
  onNoConsigner,
  onDeselect,
}: {
  selected: Delivery | null;
  noConsigner: boolean;
  onSelect: (d: Delivery) => void;
  onNoConsigner: () => void;
  onDeselect: () => void;
}) {
  const deliveries = useDeliveriesStore((s) => s.deliveries);
  const [query, setQuery] = useState("");
  const todayStr = today();

  // Collapsed state: a delivery or no-consigner is confirmed
  if (selected) {
    const jNumber = selected.consignerJNumber?.trim();
    return (
      <button
        onClick={onDeselect}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-left transition-all hover:bg-emerald-100"
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-emerald-500 shrink-0">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-sm font-semibold text-emerald-900 truncate">{selected.consignerName}</span>
          {(jNumber ?? selected.deliveryCode) && (
            <span className="text-xs text-emerald-600 font-mono shrink-0">{jNumber ?? selected.deliveryCode}</span>
          )}
        </div>
      </button>
    );
  }

  if (noConsigner) {
    return (
      <button
        onClick={onDeselect}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-left transition-all hover:bg-emerald-100"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-emerald-500 shrink-0">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span className="text-sm font-semibold text-emerald-900">No consigner</span>
      </button>
    );
  }

  const active = deliveries
    .filter((d) => d.status !== "complete")
    .sort((a, b) => {
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
        <button
          onClick={onNoConsigner}
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 text-left transition-all"
        >
          <p className="text-sm font-semibold text-stone-400">No consigner</p>
        </button>

        {filtered.length === 0 && (
          <p className="text-sm text-stone-400 text-center py-6">No active deliveries found</p>
        )}
        {filtered.map((d) => {
          const isToday = d.scheduledDate === todayStr;
          const jNumber = d.consignerJNumber?.trim();
          return (
            <button
              key={d.id}
              onClick={() => onSelect(d)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50 text-left transition-all"
            >
              <div>
                <p className="text-sm font-semibold text-stone-900">{d.consignerName}</p>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">
                  {jNumber ?? d.deliveryCode}
                  {isToday && <span className="font-sans"> · Today</span>}
                  {d.type === "walkin" && <span className="font-sans"> · Walk-in</span>}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 2: Quick rack create ──────────────────────────────────────────────────

function DuplicateRackCard({ rack, onDeleted }: { rack: Rack; onDeleted: () => void }) {
  const deleteRack = useRacksStore((s) => s.deleteRack);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await deleteRack(rack.id);
    onDeleted();
    setDeleting(false);
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-mono font-semibold text-stone-900">{rack.rackCode}</p>
        <p className="text-[11px] text-stone-500 truncate mt-0.5">
          {rack.consignerName}
          <span className="mx-1.5 text-stone-300">·</span>
          {timeAgo(rack.createdAt)}
        </p>
      </div>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="shrink-0 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
      >
        {deleting ? "Deleting…" : "Delete"}
      </button>
    </div>
  );
}

function RackCreateForm({
  delivery,
  onCreated,
}: {
  delivery: Delivery | null;
  onCreated: (rackId: string, rackCode: string) => void;
}) {
  const addRack      = useRacksStore((s) => s.addRack);
  const racks        = useRacksStore((s) => s.racks);
  const addToQueue   = usePrintQueueStore((s) => s.add);

  const [auctionColor,  setAuctionColor]  = useState("");
  const [customCode,    setCustomCode]    = useState("");
  const [status,        setStatus]        = useState<RackStatus>("unpacking_sorting");
  const [creating,      setCreating]      = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [duplicateRack, setDuplicateRack] = useState<Rack | null>(null);

  const PRIMARY_STATUSES: RackStatus[]   = ["unpacking_sorting", "sorted"];
  const SECONDARY_STATUSES: RackStatus[] = ["lotting", "ready"];
  const [showMoreStatuses, setShowMoreStatuses] = useState(() => SECONDARY_STATUSES.includes(status));

  async function handleCreate() {
    setCreating(true);
    setError(null);
    setDuplicateRack(null);
    try {
      const result = await addRack({
        consignerName: delivery?.consignerName ?? "",
        status,
        deliveryId:    delivery?.id,
        auctionColor:  auctionColor || undefined,
        rackCode:      customCode.trim() || undefined,
      });
      if (!result.ok) {
        const isDuplicate = result.error === "Rack ID already exists";
        if (isDuplicate) {
          const code = customCode.trim().toUpperCase();
          const found = racks.find((r) => r.rackCode === code) ?? null;
          setDuplicateRack(found);
        }
        throw new Error(result.error);
      }
      addToQueue(result.data.id);
      onCreated(result.data.id, result.data.rackCode);
      setCustomCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create rack");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      {delivery ? (
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
      ) : (
        <div className="rounded-lg bg-stone-100 border border-stone-200 px-4 py-3 flex items-center gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-stone-400 shrink-0">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            <line x1="18" y1="6" x2="22" y2="10" />
            <line x1="22" y1="6" x2="18" y2="10" />
          </svg>
          <p className="text-xs font-semibold text-stone-500">No consigner</p>
        </div>
      )}

      <div>
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide block mb-2">
          Auction color
        </label>
        <AuctionColorPicker value={auctionColor} onChange={setAuctionColor} />
      </div>

      <div>
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide block mb-2">
          Status
        </label>
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            {PRIMARY_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  status === s
                    ? "border-orange-300 bg-orange-50 text-orange-700"
                    : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                }`}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${STAGE_DOT[s]}`} />
                {STAGE_LABEL[s]}
              </button>
            ))}
          </div>

          <AnimatePresence initial={false}>
            {showMoreStatuses && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  {SECONDARY_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                        status === s
                          ? "border-orange-300 bg-orange-50 text-orange-700"
                          : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full shrink-0 ${STAGE_DOT[s]}`} />
                      {STAGE_LABEL[s]}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={() => setShowMoreStatuses((v) => !v)}
            className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors pt-0.5"
          >
            <motion.span
              animate={{ rotate: showMoreStatuses ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="inline-flex"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </motion.span>
            {showMoreStatuses ? "Fewer options" : "More statuses"}
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide block mb-1.5">
          Rack ID <span className="normal-case text-stone-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={customCode}
          onChange={(e) => { setCustomCode(e.target.value.toUpperCase()); setDuplicateRack(null); setError(null); }}
          placeholder="e.g. Yellow/Red"
          className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm font-mono text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        {duplicateRack && (
          <div className="mt-2">
            <DuplicateRackCard rack={duplicateRack} onDeleted={() => { setDuplicateRack(null); setError(null); }} />
          </div>
        )}
      </div>

      {error && !duplicateRack && <p className="text-xs text-red-600">{error}</p>}

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
  const [selectedDelivery,  setSelectedDelivery]  = useState<Delivery | null>(null);
  const [noConsignerMode,   setNoConsignerMode]   = useState(false);
  const [recentRacks,       setRecentRacks]       = useState<{ id: string; code: string }[]>([]);
  const printQueueIds = usePrintQueueStore((s) => s.ids);
  const racks         = useRacksStore((s) => s.racks);

  function handleSelectDelivery(d: Delivery) {
    setSelectedDelivery(d);
    setNoConsignerMode(false);
  }

  function handleNoConsigner() {
    setSelectedDelivery(null);
    setNoConsignerMode(true);
  }

  function handleDeselect() {
    setSelectedDelivery(null);
    setNoConsignerMode(false);
  }

  function handleCreated(id: string, code: string) {
    setRecentRacks((prev) => [{ id, code }, ...prev].slice(0, 5));
  }

  return (
    <>
      <PageHeader
        title="Create Rack"
        subtitle="Add a rack to a delivery and queue its label for printing"
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

      {/* Step 1 — collapses to a single row once a selection is made */}
      <AnimatePresence initial={false} mode="wait">
        {selectedDelivery || noConsignerMode ? (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="mt-4 overflow-hidden"
          >
            <Card padding="px-4 py-3">
              <DeliveryPicker
                selected={selectedDelivery}
                noConsigner={noConsignerMode}
                onSelect={handleSelectDelivery}
                onNoConsigner={handleNoConsigner}
                onDeselect={handleDeselect}
              />
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="mt-4 overflow-hidden"
          >
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-600 text-[11px] font-bold text-white">1</span>
                <p className="text-sm font-semibold text-stone-900">Select delivery</p>
              </div>
              <DeliveryPicker
                selected={selectedDelivery}
                noConsigner={noConsignerMode}
                onSelect={handleSelectDelivery}
                onNoConsigner={handleNoConsigner}
                onDeselect={handleDeselect}
              />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 2 */}
      <Card className={`mt-4 ${!selectedDelivery && !noConsignerMode ? "opacity-40 pointer-events-none" : ""}`}>
        <div className="flex items-center gap-2 mb-4">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white ${selectedDelivery || noConsignerMode ? "bg-orange-600" : "bg-stone-300"}`}>2</span>
          <p className="text-sm font-semibold text-stone-900">Create rack</p>
        </div>
        {selectedDelivery || noConsignerMode ? (
          <RackCreateForm
            delivery={selectedDelivery}
            onCreated={handleCreated}
          />
        ) : (
          <p className="text-sm text-stone-400">Select a delivery first</p>
        )}
      </Card>

      {/* Recently created this session */}
      {recentRacks.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
            Created this session
          </p>
          <Card padding="p-0" className="divide-y divide-stone-50">
            {recentRacks.map(({ id, code }) => {
              const rack   = racks.find((r) => r.id === id);
              const status = rack?.status;
              return (
                <div key={id} className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm font-mono font-medium text-stone-900">{code}</p>
                  <div className="flex items-center gap-3">
                    {status && (
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${STAGE_BADGE[status]}`}>
                        {STAGE_LABEL[status]}
                      </span>
                    )}
                    <Link href={`/racks/${id}`} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
                      View →
                    </Link>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}
    </>
  );
}
