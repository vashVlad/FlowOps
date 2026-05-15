"use client";

import { useState, Suspense, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useRacksStore } from "@/store/racks";
import { useDeliveriesStore } from "@/store/deliveries";
import { useZonesStore } from "@/store/zones";
import { useNotesStore } from "@/store/notes";
import { useRackConsignersStore } from "@/store/rackConsigners";
import Select from "@/components/Select";
import { LoadingCards } from "@/components/LoadingCards";
import ErrorBanner from "@/components/ErrorBanner";
import PageHeader from "@/components/ui/PageHeader";
import PriorityPicker from "@/components/ui/PriorityPicker";
import { useToastStore } from "@/store/toast";
import { timeAgo } from "@/lib/utils";
import { formatBusinessDuration } from "@/lib/timeTracking";
import { getZoneOccupancy } from "@/lib/zones";
import { isRackNeedsAttention, getTimeInCurrentStatus } from "@/lib/timeTracking";
import {
  PIPELINE_STAGES,
  PRIORITY_BORDER,
  NEXT_STAGE_LABEL,
  STAGE_BADGE,
  STAGE_LABEL,
  AUCTION_COLORS,
} from "@/lib/tokens";
import type { Priority, RackStatus, Rack, Delivery, Zone } from "@/types";

const inputCls =
  "w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500";

type RackFilter = "all" | "needs_attention" | "held" | RackStatus;

const FILTER_OPTIONS: { key: RackFilter; label: string }[] = [
  { key: "all",               label: "All"                  },
  { key: "needs_attention",   label: "Needs Attention"      },
  { key: "held",              label: "Held"                 },
  { key: "unpacking_sorting", label: "Unpacking & Sorting"  },
  { key: "sorted",            label: "Sorted"               },
  { key: "lotting",           label: "Lotting"              },
  { key: "ready",             label: "Ready"                },
  { key: "pickup",            label: "Pickup"               },
];

const STAGE_STEPS = PIPELINE_STAGES.map((s) => s.status);

function rackBorderCls(priority: Priority, needsAttention: boolean, held: boolean) {
  if (held)                               return "border-l-4 border-l-blue-400";
  const critical = needsAttention && priority === "high";
  if (critical)                       return PRIORITY_BORDER.needs_attention;
  if (priority === "high")            return PRIORITY_BORDER.high;
  if (priority === "low")             return PRIORITY_BORDER.low;
  return                                     PRIORITY_BORDER.normal;
}

// ── Stage strip ───────────────────────────────────────────────────────────────

export function StageStrip({ status }: { status: RackStatus }) {
  const completed = status === "completed";
  const idx       = completed ? STAGE_STEPS.length : STAGE_STEPS.indexOf(status);

  return (
    <div className="flex items-center">
      {STAGE_STEPS.map((s, i) => {
        const isPast    = i < idx || completed;
        const isCurrent = !completed && i === idx;
        return (
          <Fragment key={s}>
            <div className={`rounded-full shrink-0 transition-colors ${
              isCurrent
                ? "h-2 w-2 bg-orange-500 ring-2 ring-orange-100"
                : isPast
                ? "h-1.5 w-1.5 bg-stone-300"
                : "h-1.5 w-1.5 bg-stone-200"
            }`} />
            {i < STAGE_STEPS.length - 1 && (
              <div className={`h-px flex-1 mx-1 ${isPast ? "bg-stone-300" : "bg-stone-100"}`} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

// ── Rack card ─────────────────────────────────────────────────────────────────

function RackCard({
  rack, delivery, zone, needsAttention, timeInStage, noteCount, isMixed, onAdvance, onClick,
}: {
  rack: Rack;
  delivery?: Delivery;
  zone?: Zone;
  needsAttention: boolean;
  timeInStage: number;
  noteCount: number;
  isMixed: boolean;
  onAdvance: () => void;
  onClick: () => void;
}) {
  const isCompleted = rack.status === "completed";
  const nextLabel   = NEXT_STAGE_LABEL[rack.status];
  const isHeld      = !!rack.holdReason;
  const isCritical  = needsAttention && !isHeld && rack.priority === "high";

  return (
    <li
      onClick={onClick}
      className={`cursor-pointer rounded-xl border border-stone-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150 overflow-hidden ${rackBorderCls(rack.priority, needsAttention, isHeld)}`}
    >
      {/* TOP — ID · urgency · age */}
      <div className="px-4 pt-2.5 pb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {rack.auctionColor && (
            <span className="h-3 w-3 rounded-full shrink-0 ring-1 ring-stone-200"
              style={{ backgroundColor: rack.auctionColor }} />
          )}
          <span className="font-mono text-base font-bold text-stone-900 tracking-tight">
            {rack.rackCode}
          </span>
          {isHeld ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
              HOLD
            </span>
          ) : isCritical ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-600">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              needs attention · {formatBusinessDuration(timeInStage)}
            </span>
          ) : needsAttention ? (
            <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-600">
              needs attention · {formatBusinessDuration(timeInStage)}
            </span>
          ) : rack.priority === "high" ? (
            <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
              high
            </span>
          ) : rack.priority === "low" ? (
            <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-400">
              low
            </span>
          ) : null}
          {isMixed && (
            <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
              mixed
            </span>
          )}
        </div>
        <span className="text-[11px] text-stone-400 shrink-0">{timeAgo(rack.updatedAt)}</span>
      </div>

      {/* CONSIGNER — name · J-Number */}
      <div className="px-4 pb-1.5">
        <p className="text-xs text-stone-400 truncate">
          {rack.consignerName}
          {delivery?.consignerJNumber && (
            <span className="font-mono ml-1.5">{delivery.consignerJNumber}</span>
          )}
        </p>
      </div>

      {/* Hold reason (if held) */}
      {isHeld && rack.holdReason && (
        <div className="px-4 pb-1.5">
          <p className="text-[11px] text-blue-600 truncate">{rack.holdReason}</p>
        </div>
      )}

      {/* MIDDLE — stage flow · stage label · zone · notes */}
      <div className="px-4 pb-1.5 space-y-1.5">
        <div className="space-y-1">
          <StageStrip status={rack.status} />
          <div className="flex items-center justify-between">
            <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${STAGE_BADGE[rack.status]}`}>
              {STAGE_LABEL[rack.status]}
            </span>
            <div className="flex items-center gap-2">
              {noteCount > 0 && (
                <span className="text-[11px] text-amber-600">
                  {noteCount} note{noteCount !== 1 ? "s" : ""}
                </span>
              )}
              {timeInStage > 0 && !needsAttention && !isHeld && (
                <span className="text-[11px] text-stone-400">{formatBusinessDuration(timeInStage)}</span>
              )}
            </div>
          </div>
        </div>

        {zone && (
          <div className="text-[11px]">
            <Link href={`/zones/${zone.id}`} onClick={(e) => e.stopPropagation()}
              className="font-medium text-stone-500 hover:text-orange-600 transition-colors">
              {zone.name}
            </Link>
          </div>
        )}
      </div>

      {/* BOTTOM — primary action */}
      <div className="px-4 pb-2.5">
        <button
          onClick={(e) => { e.stopPropagation(); onAdvance(); }}
          disabled={isCompleted}
          className={`w-full rounded-lg py-1 text-xs font-medium transition-colors ${
            isCompleted
              ? "bg-stone-50 text-stone-300 cursor-default border border-stone-100"
              : isCritical
              ? "bg-red-500 text-white hover:bg-red-600"
              : "bg-orange-500 text-white hover:bg-orange-600"
          }`}
        >
          {isCompleted ? "Completed" : `Move to ${nextLabel} →`}
        </button>
      </div>
    </li>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function RacksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedDelivery = searchParams.get("delivery") ?? "";
  const preselectedZone     = searchParams.get("zone")     ?? "";

  const { racks, history, loading, error: storeError, addRack, advanceStatus } = useRacksStore();
  function clearStoreError() { useRacksStore.setState({ error: null }); }
  const { deliveries } = useDeliveriesStore();
  const { zones }      = useZonesStore();
  const { notes }      = useNotesStore();
  const { consigners: rackConsigners } = useRackConsignersStore();
  const addToast       = useToastStore((s) => s.add);

  const [query, setQuery]                       = useState("");
  const [filter, setFilter]                     = useState<RackFilter>("all");
  const [colorFilter, setColorFilter]           = useState("");
  const [showForm, setShowForm]                 = useState(!!(preselectedDelivery || preselectedZone));
  const [rackCodeInput, setRackCodeInput]       = useState("");
  const [initialStatus, setInitialStatus]       = useState<RackStatus>("unpacking_sorting");
  const [sortedPriority, setSortedPriority]     = useState<Priority>("normal");
  const [auctionColor, setAuctionColor]         = useState("");
  const [isHeldAtCreation, setIsHeldAtCreation] = useState(false);
  const [zoneId, setZoneId]                     = useState(preselectedZone);
  const [deliveryId, setDeliveryId]             = useState(preselectedDelivery);
  const [consignerInput, setConsignerInput]     = useState("");
  const [formError, setFormError]               = useState("");

  const activeDeliveries = deliveries.filter((d) => d.status !== "complete");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const needsDelivery = initialStatus === "unpacking_sorting";
    const hasOptionalDelivery = initialStatus === "sorted" || initialStatus === "lotting";
    let consignerName = "";
    let resolvedDeliveryId: string | undefined;

    if (needsDelivery) {
      if (!deliveryId) return setFormError("Select a delivery.");
      const selectedDelivery = activeDeliveries.find((d) => d.id === deliveryId);
      if (!selectedDelivery) return setFormError("Select a delivery.");
      consignerName = selectedDelivery.consignerName;
      resolvedDeliveryId = deliveryId;
    } else if (hasOptionalDelivery && deliveryId) {
      const selectedDelivery = activeDeliveries.find((d) => d.id === deliveryId);
      if (selectedDelivery) {
        consignerName = selectedDelivery.consignerName;
        resolvedDeliveryId = deliveryId;
      }
    }

    setFormError("");
    const now = new Date().toISOString();
    const result = await addRack({
      consignerName,
      status:        initialStatus,
      priority:      initialStatus !== "unpacking_sorting" ? sortedPriority : undefined,
      zoneId:        zoneId || undefined,
      deliveryId:    resolvedDeliveryId,
      rackCode:      rackCodeInput.trim() || undefined,
      holdReason:    isHeldAtCreation ? "On Hold" : undefined,
      holdStartedAt: isHeldAtCreation ? now : undefined,
      auctionColor:  auctionColor || undefined,
    });
    if (!result.ok) { setFormError(result.error); return; }
    setRackCodeInput(""); setInitialStatus("unpacking_sorting"); setSortedPriority("normal");
    setAuctionColor(""); setIsHeldAtCreation(false); setZoneId(preselectedZone);
    setDeliveryId(preselectedDelivery); setConsignerInput("");
    setShowForm(false);
    addToast(`${result.data.rackCode} added`);
  }

  const q = query.toLowerCase();
  const filtered = [...racks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).filter((r) => {
    const attention = isRackNeedsAttention(r, history);
    const isHeld    = !!r.holdReason;
    const zone      = r.zoneId     ? zones.find((z) => z.id === r.zoneId)          : undefined;
    const delivery  = r.deliveryId ? deliveries.find((d) => d.id === r.deliveryId) : undefined;

    if (q && !(
      r.rackCode.toLowerCase().includes(q) ||
      r.consignerName.toLowerCase().includes(q) ||
      zone?.name.toLowerCase().includes(q) ||
      delivery?.deliveryCode.toLowerCase().includes(q) ||
      delivery?.consignerName.toLowerCase().includes(q) ||
      (r.holdReason ?? "").toLowerCase().includes(q)
    )) return false;

    if (colorFilter && r.auctionColor !== colorFilter) return false;
    if (filter === "needs_attention") return attention && !isHeld;
    if (filter === "held")            return isHeld;
    if (filter !== "all")             return r.status === filter;
    return true;
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Racks"
        action={
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
          >
            {showForm ? "Cancel" : "Add rack"}
          </button>
        }
      />

      <ErrorBanner error={storeError} onDismiss={clearStoreError} />

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-3">
          <p className="text-sm font-semibold text-stone-900">New rack</p>
          <input type="text" placeholder="Rack ID (optional — auto-generated if blank)" value={rackCodeInput}
            onChange={(e) => { setRackCodeInput(e.target.value); setFormError(""); }} className={inputCls} autoFocus />

          {/* Status at creation */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-stone-600">Initial status</p>
            <div className="grid grid-cols-2 gap-2">
              {(["unpacking_sorting", "sorted", "lotting", "ready"] as const).map((s) => (
                <button key={s} type="button"
                  onClick={() => setInitialStatus(s)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    initialStatus === s
                      ? "border-orange-400 bg-orange-50 text-orange-700"
                      : "border-stone-200 bg-white text-stone-500 hover:border-stone-300"
                  }`}>
                  {s === "unpacking_sorting" ? "Unpacking & Sorting" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Delivery — required for unpacking_sorting, optional for sorted/lotting */}
          {(initialStatus === "unpacking_sorting" || initialStatus === "sorted" || initialStatus === "lotting") && (
            <div className="space-y-1">
              {(initialStatus === "sorted" || initialStatus === "lotting") && (
                <p className="text-xs text-stone-400">Delivery <span className="italic">(optional)</span></p>
              )}
              <Select value={deliveryId} onChange={(e) => setDeliveryId(e.target.value)}>
                <option value="">
                  {initialStatus === "unpacking_sorting" ? "Select a delivery" : "No delivery — skip"}
                </option>
                {activeDeliveries.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.consignerName}{d.consignerJNumber ? ` · ${d.consignerJNumber}` : ""}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <Select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">No zone assigned</option>
            {zones.map((z) => {
              const { count, status } = getZoneOccupancy(z.id, racks, zones);
              const cap  = z.capacity ? ` (${count}/${z.capacity}${status === "full" ? " FULL" : ""})` : ` (${count})`;
              const desc = z.label ? ` — ${z.label}` : "";
              return <option key={z.id} value={z.id}>{z.name}{desc}{cap}</option>;
            })}
          </Select>

          {/* Priority — only when not unpacking_sorting */}
          {initialStatus !== "unpacking_sorting" && (
            <PriorityPicker value={sortedPriority} onChange={setSortedPriority} />
          )}

          {/* Auction color — only when not unpacking_sorting */}
          {initialStatus !== "unpacking_sorting" && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-stone-600">Auction color</p>
              <div className="flex items-center gap-2">
                {[
                  { hex: "#ef4444", label: "Red"    },
                  { hex: "#eab308", label: "Yellow" },
                  { hex: "#22c55e", label: "Green"  },
                  { hex: "#3b82f6", label: "Blue"   },
                  { hex: "#1c1917", label: "Black"  },
                ].map(({ hex, label }) => (
                  <button
                    key={hex}
                    type="button"
                    title={label}
                    onClick={() => setAuctionColor(auctionColor === hex ? "" : hex)}
                    className={`h-6 w-6 rounded-full transition-all ${
                      auctionColor === hex
                        ? "ring-2 ring-offset-2 ring-stone-400 scale-110"
                        : "opacity-70 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
                {auctionColor && (
                  <button
                    type="button"
                    onClick={() => setAuctionColor("")}
                    className="text-xs text-stone-400 hover:text-stone-600 transition-colors ml-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Hold checkbox */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={isHeldAtCreation}
              onChange={(e) => setIsHeldAtCreation(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 accent-orange-600 cursor-pointer" />
            <span className="text-sm text-stone-600">Place on hold</span>
          </label>

          {formError && <p className="text-xs text-red-500">{formError}</p>}
          <button type="submit"
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors">
            Add rack
          </button>
        </form>
      )}

      {/* Filter pills — horizontal scroll on mobile */}
      <div className="-mx-4 sm:mx-0 overflow-x-auto">
        <div className="flex gap-1.5 px-4 sm:px-0 pb-0.5">
        {FILTER_OPTIONS.map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === key
                ? key === "held"
                  ? "bg-blue-600 text-white"
                  : "bg-orange-600 text-white"
                : "bg-stone-100 text-stone-500 hover:bg-stone-200"
            }`}>
            {label}
          </button>
        ))}
        {/* Color filters */}
        <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-stone-200">
          {AUCTION_COLORS.map(({ hex, label }) => (
            <button
              key={hex}
              title={label}
              onClick={() => setColorFilter(colorFilter === hex ? "" : hex)}
              className={`h-5 w-5 rounded-full transition-all ${
                colorFilter === hex
                  ? "ring-2 ring-offset-1 ring-stone-400 scale-110"
                  : "opacity-50 hover:opacity-100"
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
        </div>
      </div>

      <input type="text" placeholder="Search racks, consigners, zones…"
        value={query} onChange={(e) => setQuery(e.target.value)} className={inputCls} />

      {loading && racks.length === 0 ? (
        <LoadingCards />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-5 py-6 shadow-sm text-center space-y-1">
          <p className="text-sm font-medium text-stone-700">
            {racks.length === 0 ? "No racks in the system" : "No racks match your search"}
          </p>
          <p className="text-xs text-stone-400">
            {racks.length === 0
              ? "Create a delivery first, then add racks to begin tracking flow."
              : "Try a different filter or clear the search."}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((rack) => {
            const attention   = isRackNeedsAttention(rack, history);
            const timeInStage = getTimeInCurrentStatus(rack, history);
            const delivery    = deliveries.find((d) => d.id === rack.deliveryId);
            const zone        = zones.find((z) => z.id === rack.zoneId);
            const noteCount   = notes.filter((n) => n.rackId === rack.id).length;
            const isMixed     = rackConsigners.some((c) => c.rackId === rack.id);
            return (
              <RackCard
                key={rack.id}
                rack={rack}
                delivery={delivery}
                zone={zone}
                needsAttention={attention}
                timeInStage={timeInStage}
                noteCount={noteCount}
                isMixed={isMixed}
                onAdvance={() => advanceStatus(rack.id)}
                onClick={() => router.push(`/racks/${rack.id}`)}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function RacksPage() {
  return (
    <Suspense>
      <RacksContent />
    </Suspense>
  );
}
