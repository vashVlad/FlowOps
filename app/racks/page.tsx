"use client";

import { useState, Suspense, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useRacksStore } from "@/store/racks";
import { useDeliveriesStore } from "@/store/deliveries";
import { useZonesStore } from "@/store/zones";
import { useNotesStore } from "@/store/notes";
import Select from "@/components/Select";
import { LoadingCards } from "@/components/LoadingCards";
import ErrorBanner from "@/components/ErrorBanner";
import PageHeader from "@/components/ui/PageHeader";
import PriorityPicker from "@/components/ui/PriorityPicker";
import { useToastStore } from "@/store/toast";
import { timeAgo } from "@/lib/utils";
import { formatBusinessDuration } from "@/lib/timeTracking";
import { getZoneOccupancy } from "@/lib/zones";
import { isRackStuck, getTimeInCurrentStatus } from "@/lib/timeTracking";
import {
  PIPELINE_STAGES,
  PRIORITY_BORDER,
  NEXT_STAGE_LABEL,
  STAGE_BADGE,
  STAGE_LABEL,
} from "@/lib/tokens";
import type { Priority, RackStatus, Rack, Delivery, Zone } from "@/types";

const inputCls =
  "w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500";

type RackFilter = "all" | "stuck" | "held" | "high" | RackStatus;

const FILTER_OPTIONS: { key: RackFilter; label: string }[] = [
  { key: "all",       label: "All"       },
  { key: "stuck",     label: "Stuck"     },
  { key: "held",      label: "Held"      },
  { key: "high",      label: "High"      },
  { key: "intake",    label: "Intake"    },
  { key: "unpacking", label: "Unpacking" },
  { key: "sorting",   label: "Sorting"   },
  { key: "lotting",   label: "Lotting"   },
  { key: "ready",     label: "Ready"     },
  { key: "pickup",    label: "Pickup"    },
];

const STAGE_STEPS = PIPELINE_STAGES.map((s) => s.status);

function rackBorderCls(priority: Priority, stuck: boolean, held: boolean) {
  if (held)                      return "border-l-4 border-l-blue-400";
  const critical = stuck && priority === "high";
  if (critical)              return PRIORITY_BORDER.stuck;
  if (priority === "high")   return PRIORITY_BORDER.high;
  if (priority === "low")    return PRIORITY_BORDER.low;
  return                            PRIORITY_BORDER.normal;
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
  rack, delivery, zone, stuck, timeInStage, noteCount, onAdvance, onClick,
}: {
  rack: Rack;
  delivery?: Delivery;
  zone?: Zone;
  stuck: boolean;
  timeInStage: number;
  noteCount: number;
  onAdvance: () => void;
  onClick: () => void;
})
 {
  const isCompleted = rack.status === "completed";
  const nextLabel   = NEXT_STAGE_LABEL[rack.status];
  const isHeld      = !!rack.holdReason;
  const isCritical  = stuck && !isHeld && rack.priority === "high";

  return (
    <li
      onClick={onClick}
      className={`cursor-pointer rounded-xl border border-stone-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150 overflow-hidden ${rackBorderCls(rack.priority, stuck, isHeld)}`}
    >
      {/* TOP — ID · urgency · age */}
      <div className="px-4 pt-2.5 pb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
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
              critical · {formatBusinessDuration(timeInStage)}
            </span>
          ) : stuck ? (
            <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] text-red-400">
              stuck · {formatBusinessDuration(timeInStage)}
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
              {rack.itemCount != null && (
                <span className="text-[11px] text-stone-400 tabular-nums">
                  {rack.itemCount} item{rack.itemCount !== 1 ? "s" : ""}
                </span>
              )}
              {noteCount > 0 && (
                <span className="text-[11px] text-amber-600">
                  {noteCount} note{noteCount !== 1 ? "s" : ""}
                </span>
              )}
              {timeInStage > 0 && !stuck && !isHeld && (
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
  const addToast       = useToastStore((s) => s.add);

  const [query, setQuery]                 = useState("");
  const [filter, setFilter]               = useState<RackFilter>("all");
  const [showForm, setShowForm]           = useState(!!(preselectedDelivery || preselectedZone));
  const [rackCodeInput, setRackCodeInput] = useState("");
  const [priority, setPriority]           = useState<Priority>("normal");
  const [zoneId, setZoneId]               = useState(preselectedZone);
  const [deliveryId, setDeliveryId]       = useState(preselectedDelivery);
  const [formItemCount, setFormItemCount] = useState("");
  const [formError, setFormError]         = useState("");

  const activeDeliveries = deliveries.filter((d) => d.status !== "complete");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!deliveryId) return setFormError("Select a delivery.");
    const selectedDelivery = activeDeliveries.find((d) => d.id === deliveryId);
    if (!selectedDelivery) return setFormError("Select a delivery.");
    setFormError("");
    const itemCount = formItemCount.trim() ? Number(formItemCount.trim()) : undefined;
    const result = await addRack({
      consignerName: selectedDelivery.consignerName,
      priority,
      zoneId: zoneId || undefined,
      deliveryId,
      itemCount: !isNaN(itemCount!) && itemCount! >= 0 ? itemCount : undefined,
      rackCode:  rackCodeInput.trim() || undefined,
    });
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setRackCodeInput(""); setPriority("normal"); setZoneId(preselectedZone);
    setDeliveryId(preselectedDelivery); setFormItemCount("");
    setShowForm(false);
    addToast(`${result.data.rackCode} added`);
  }

  const q = query.toLowerCase();
  const filtered = racks.filter((r) => {
    const stuck    = isRackStuck(r, history);
    const isHeld   = !!r.holdReason;
    const zone     = r.zoneId     ? zones.find((z) => z.id === r.zoneId)          : undefined;
    const delivery = r.deliveryId ? deliveries.find((d) => d.id === r.deliveryId) : undefined;

    if (q && !(
      r.rackCode.toLowerCase().includes(q) ||
      r.consignerName.toLowerCase().includes(q) ||
      zone?.name.toLowerCase().includes(q) ||
      delivery?.deliveryCode.toLowerCase().includes(q) ||
      delivery?.consignerName.toLowerCase().includes(q) ||
      (r.holdReason ?? "").toLowerCase().includes(q)
    )) return false;

    if (filter === "stuck") return stuck && !isHeld;
    if (filter === "held")  return isHeld;
    if (filter === "high")  return r.priority === "high";
    if (filter !== "all")   return r.status === filter;
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
          <Select value={deliveryId} onChange={(e) => setDeliveryId(e.target.value)}>
            <option value="">Select a delivery</option>
            {activeDeliveries.map((d) => (
              <option key={d.id} value={d.id}>
                {d.consignerName}{d.consignerJNumber ? ` · ${d.consignerJNumber}` : ""}
              </option>
            ))}
          </Select>
          <Select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">No zone assigned</option>
            {zones.map((z) => {
              const { count, status } = getZoneOccupancy(z.id, racks, zones);
              const cap  = z.capacity ? ` (${count}/${z.capacity}${status === "full" ? " FULL" : ""})` : ` (${count})`;
              const desc = z.label ? ` — ${z.label}` : "";
              return <option key={z.id} value={z.id}>{z.name}{desc}{cap}</option>;
            })}
          </Select>
          <PriorityPicker value={priority} onChange={setPriority} />
          <input type="number" placeholder="Item count (optional, e.g. 24)" value={formItemCount}
            onChange={(e) => setFormItemCount(e.target.value)} min={0} className={inputCls} />
          {formError && <p className="text-xs text-red-500">{formError}</p>}
          <button type="submit"
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors">
            Add rack
          </button>
        </form>
      )}

      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5">
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
            const stuck       = isRackStuck(rack, history);
            const timeInStage = getTimeInCurrentStatus(rack, history);
            const delivery    = deliveries.find((d) => d.id === rack.deliveryId);
            const zone        = zones.find((z) => z.id === rack.zoneId);
            const noteCount   = notes.filter((n) => n.rackId === rack.id).length;
            return (
              <RackCard
                key={rack.id}
                rack={rack}
                delivery={delivery}
                zone={zone}
                stuck={stuck}
                timeInStage={timeInStage}
                noteCount={noteCount}
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
