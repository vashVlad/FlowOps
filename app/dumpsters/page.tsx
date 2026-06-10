"use client";

import { useRef, useState } from "react";
import { useDumpstersStore } from "@/store/dumpsters";
import { useDeliveriesStore } from "@/store/deliveries";
import { useToastStore } from "@/store/toast";
import PageHeader from "@/components/ui/PageHeader";
import { SectionLabel } from "@/components/ui/Card";
import ErrorBanner from "@/components/ErrorBanner";
import { LoadingCards } from "@/components/LoadingCards";
import TrashIcon from "@/components/ui/TrashIcon";
import { formatDate, timeAgo } from "@/lib/utils";
import type { Dumpster, DeliveryStatus } from "@/types";

const inputCls =
  "w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500";

type DeliveryFilter = "all" | "active" | "completed";

const OPERATIONAL = "__operational__";

function fillColor(pct: number): string {
  if (pct > 80) return "bg-red-500";
  if (pct > 50) return "bg-amber-500";
  return "bg-emerald-500";
}

function fillTextColor(pct: number): string {
  if (pct > 80) return "text-red-600";
  if (pct > 50) return "text-amber-600";
  return "text-emerald-600";
}

function daysInService(arrivedAt: string): number {
  const ms = Date.now() - new Date(arrivedAt).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function DumpsterVisual({
  fillPercent,
  addPercent = 0,
  onChangeAdd,
}: {
  fillPercent: number;
  /** Pending amount being added on top of the current fill (interactive mode only). */
  addPercent?: number;
  /** When provided, the visual becomes draggable: drag above the current fill line to add more. */
  onChangeAdd?: (add: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const total = Math.min(100, fillPercent + addPercent);

  function applyPointer(clientY: number) {
    const el = containerRef.current;
    if (!onChangeAdd || !el) return;
    const rect = el.getBoundingClientRect();
    const ratio = 1 - (clientY - rect.top) / rect.height;
    const targetTotal = Math.round(Math.min(100, Math.max(0, ratio * 100)));
    const add = Math.max(0, Math.min(100 - fillPercent, targetTotal - fillPercent));
    onChangeAdd(add);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!onChangeAdd) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    applyPointer(e.clientY);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!onChangeAdd || e.buttons !== 1) return;
    applyPointer(e.clientY);
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      className={`relative mx-auto h-32 w-48 ${onChangeAdd ? "cursor-ns-resize touch-none select-none" : ""}`}
    >
      {/* Body — wide steel bin, tapered slightly toward the base (roll-off shape) */}
      <div
        className="absolute inset-x-0 top-2.5 bottom-0 overflow-hidden bg-emerald-800 shadow-inner"
        style={{ clipPath: "polygon(0% 0%, 100% 0%, 90% 100%, 10% 100%)" }}
      >
        {/* Corrugated side ribs */}
        <div
          className="absolute inset-0 opacity-25"
          style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 10px, rgba(0,0,0,0.35) 10px 12px)" }}
        />
        {/* Existing fill */}
        <div
          className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ${fillColor(fillPercent)}`}
          style={{ height: `${fillPercent}%` }}
        />
        {/* Pending addition */}
        {addPercent > 0 && (
          <div
            className="absolute left-0 right-0 bg-orange-400"
            style={{
              bottom: `${fillPercent}%`,
              height: `${addPercent}%`,
              backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.35) 0 6px, transparent 6px 12px)",
            }}
          />
        )}
      </div>
      {/* Top rim */}
      <div className="absolute inset-x-0 top-0 h-3 rounded-[2px] bg-emerald-950 shadow-sm" />
      {/* Skids */}
      <div className="absolute -bottom-1.5 left-[14%] h-1.5 w-[18%] rounded-sm bg-stone-400" />
      <div className="absolute -bottom-1.5 right-[14%] h-1.5 w-[18%] rounded-sm bg-stone-400" />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pt-1.5">
        <span className="rounded-md bg-white/85 px-2 py-0.5 text-sm font-bold tabular-nums text-stone-800 shadow-sm">
          {total}%
        </span>
        {onChangeAdd && addPercent > 0 && (
          <span className="rounded-md bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            +{addPercent}% new
          </span>
        )}
      </div>
    </div>
  );
}

export default function DumpstersPage() {
  const { dumpsters, entries, loading, error, addEntry, swap, deleteEntry } = useDumpstersStore();
  const { deliveries } = useDeliveriesStore();
  const addToast = useToastStore((s) => s.add);
  function clearStoreError() { useDumpstersStore.setState({ error: null }); }

  const [addingFor, setAddingFor]     = useState<string | null>(null);
  const [swapConfirm, setSwapConfirm] = useState<string | null>(null);

  // ── Add form state ──────────────────────────────────────────────────────────
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("active");
  const [deliverySearch, setDeliverySearch] = useState("");
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("");
  const [percentValue, setPercentValue] = useState("");
  const [formError, setFormError] = useState("");

  function openAddForm(dumpsterId: string) {
    setAddingFor(dumpsterId);
    setSwapConfirm(null);
    setDeliveryFilter("active");
    setDeliverySearch("");
    setSelectedDeliveryId("");
    setPercentValue("");
    setFormError("");
  }

  function closeAddForm() {
    setAddingFor(null);
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDeliveryId) return setFormError("Select a delivery, or choose Operational use.");
    const pct = Math.round(Number(percentValue));
    if (!percentValue || isNaN(pct) || pct <= 0 || pct > 100) {
      return setFormError("Drag the dumpster (or enter a percent) to add.");
    }
    setFormError("");
    const result = await addEntry({
      dumpsterId: addingFor!,
      deliveryId: selectedDeliveryId === OPERATIONAL ? undefined : selectedDeliveryId,
      percent: pct,
    });
    if (!result.ok) { setFormError(result.error); return; }
    addToast("Dumpster entry added");
    closeAddForm();
  }

  async function handleSwap(dumpsterId: string) {
    const result = await swap(dumpsterId);
    if (!result.ok) { addToast(result.error); setSwapConfirm(null); return; }
    addToast("Dumpster swapped");
    setSwapConfirm(null);
  }

  async function handleDeleteEntry(entryId: string) {
    const result = await deleteEntry(entryId);
    if (!result.ok) { addToast(result.error); return; }
    addToast("Entry removed");
  }

  const filteredDeliveries = deliveries
    .filter((d) => {
      if (deliveryFilter === "active")    return d.status !== "complete";
      if (deliveryFilter === "completed") return d.status === "complete";
      return true;
    })
    .filter((d) => {
      const q = deliverySearch.trim().toLowerCase();
      if (!q) return true;
      return (
        d.consignerName.toLowerCase().includes(q) ||
        d.deliveryCode.toLowerCase().includes(q) ||
        (d.consignerJNumber ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.consignerName.localeCompare(b.consignerName));

  return (
    <div className="space-y-5">
      <PageHeader title="Dumpsters" subtitle="Track fill levels for customer trash billing" />

      <ErrorBanner error={error} onDismiss={clearStoreError} />

      {loading && dumpsters.length === 0 ? (
        <LoadingCards count={2} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {dumpsters.map((dumpster) => (
            <DumpsterCard
              key={dumpster.id}
              dumpster={dumpster}
              isAdding={addingFor === dumpster.id}
              isSwapConfirming={swapConfirm === dumpster.id}
              addPercent={Number(percentValue) || 0}
              onChangeAdd={(add) => setPercentValue(String(add))}
              onAdd={() => openAddForm(dumpster.id)}
              onCloseAdd={closeAddForm}
              onSwapClick={() => setSwapConfirm(dumpster.id)}
              onSwapCancel={() => setSwapConfirm(null)}
              onSwapConfirm={() => handleSwap(dumpster.id)}
            >
              {addingFor === dumpster.id && (
                <form onSubmit={handleAddSubmit} className="mt-3 space-y-3 border-t border-stone-100 pt-3">
                  <div className="flex gap-1.5">
                    {(["active", "completed", "all"] as DeliveryFilter[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setDeliveryFilter(f)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                          deliveryFilter === f
                            ? "bg-orange-600 text-white"
                            : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Search consigner or delivery code…"
                    value={deliverySearch}
                    onChange={(e) => setDeliverySearch(e.target.value)}
                    className={inputCls}
                  />

                  <div className="max-h-44 overflow-y-auto rounded-lg border border-stone-200">
                    <button
                      type="button"
                      onClick={() => setSelectedDeliveryId(OPERATIONAL)}
                      className={`flex w-full items-center gap-2 border-b border-stone-100 px-3 py-2 text-left text-xs transition-colors ${
                        selectedDeliveryId === OPERATIONAL ? "bg-orange-50" : "hover:bg-stone-50"
                      }`}
                    >
                      <span className="font-medium text-stone-600">Operational use</span>
                      <span className="text-stone-400">— not tied to a delivery</span>
                    </button>
                    {filteredDeliveries.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-stone-400 text-center">No deliveries found.</p>
                    ) : (
                      filteredDeliveries.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setSelectedDeliveryId(d.id)}
                          className={`flex w-full items-center justify-between gap-2 border-b border-stone-100 px-3 py-2 text-left text-xs last:border-b-0 transition-colors ${
                            selectedDeliveryId === d.id ? "bg-orange-50" : "hover:bg-stone-50"
                          }`}
                        >
                          <span className="min-w-0 truncate">
                            <span className="font-medium text-stone-700">{d.consignerName}</span>
                            <span className="ml-1.5 text-stone-400">{d.consignerJNumber ?? d.deliveryCode}</span>
                          </span>
                          <DeliveryStatusDot status={d.status} />
                        </button>
                      ))
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    <p className="text-xs text-stone-400">Drag the dumpster above to set the amount —</p>
                    <span className="text-xs text-stone-400">+</span>
                    <input
                      type="number" min="0" max={100 - dumpster.fillPercent}
                      value={percentValue}
                      onChange={(e) => setPercentValue(e.target.value)}
                      className="w-20 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-center text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <span className="text-sm text-stone-400">%</span>
                  </div>

                  {formError && <p className="text-xs text-red-500">{formError}</p>}

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 transition-colors"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={closeAddForm}
                      className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </DumpsterCard>
          ))}
        </div>
      )}

      {/* ── Activity log ─────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <SectionLabel>Activity</SectionLabel>
        {entries.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white px-5 py-6 shadow-sm text-center">
            <p className="text-xs text-stone-400">No dumpster activity yet.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((entry) => {
              const dumpster = dumpsters.find((d) => d.id === entry.dumpsterId);
              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 shadow-sm"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        entry.type === "swap" ? "bg-blue-50 text-blue-600" : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {entry.type === "swap" ? "Swap" : "Add"}
                    </span>
                    <span className="truncate text-sm text-stone-700">
                      {entry.type === "swap" ? (
                        <>
                          <span className="font-medium">{dumpster?.name ?? "Dumpster"}</span> swapped at{" "}
                          <span className="font-medium tabular-nums">{entry.percent}%</span>
                        </>
                      ) : (
                        <>
                          <span className="font-medium">{entry.consignerName ?? "Operational use"}</span>{" "}
                          <span className="tabular-nums">+{entry.percent}%</span> →{" "}
                          <span className="font-medium">{dumpster?.name ?? "Dumpster"}</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="text-xs text-stone-400">{timeAgo(entry.createdAt)}</span>
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      aria-label="Remove entry"
                      className="text-stone-300 hover:text-red-500 transition-colors"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function DeliveryStatusDot({ status }: { status: DeliveryStatus }) {
  const color =
    status === "complete"   ? "bg-stone-300" :
    status === "processing" ? "bg-orange-400" :
    status === "arrived"    ? "bg-blue-400"   :
                               "bg-stone-200";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} title={status} />;
}

function DumpsterCard({
  dumpster, isAdding, isSwapConfirming, addPercent, onChangeAdd, onAdd, onCloseAdd, onSwapClick, onSwapCancel, onSwapConfirm, children,
}: {
  dumpster: Dumpster;
  isAdding: boolean;
  isSwapConfirming: boolean;
  addPercent: number;
  onChangeAdd: (add: number) => void;
  onAdd: () => void;
  onCloseAdd: () => void;
  onSwapClick: () => void;
  onSwapCancel: () => void;
  onSwapConfirm: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-stone-900">{dumpster.name}</h3>
          <p className="mt-0.5 text-xs text-stone-400">
            Arrived {formatDate(dumpster.arrivedAt)} · {daysInService(dumpster.arrivedAt)}d in service
          </p>
        </div>
        <span className={`text-xs font-semibold tabular-nums ${fillTextColor(dumpster.fillPercent)}`}>
          {dumpster.fillPercent}% full
        </span>
      </div>

      <div className="my-5">
        {isAdding ? (
          <DumpsterVisual
            fillPercent={dumpster.fillPercent}
            addPercent={addPercent}
            onChangeAdd={onChangeAdd}
          />
        ) : (
          <DumpsterVisual fillPercent={dumpster.fillPercent} />
        )}
      </div>

      <div className="flex items-center gap-2">
        {isAdding ? (
          <button
            onClick={onCloseAdd}
            className="flex-1 rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-200 transition-colors"
          >
            Cancel
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="flex-1 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 transition-colors"
          >
            + Add
          </button>
        )}

        {isSwapConfirming ? (
          <div className="flex flex-1 items-center gap-1.5">
            <button
              onClick={onSwapConfirm}
              className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
            >
              Confirm swap
            </button>
            <button
              onClick={onSwapCancel}
              className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={onSwapClick}
            className="flex-1 rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-200 transition-colors"
          >
            Swap dumpster
          </button>
        )}
      </div>

      {children}
    </div>
  );
}
