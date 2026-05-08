"use client";

import { useState, Suspense, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useRacksStore } from "@/store/racks";
import { useDeliveriesStore } from "@/store/deliveries";
import { useZonesStore } from "@/store/zones";
import Select from "@/components/Select";
import { LoadingCards } from "@/components/LoadingCards";
import ErrorBanner from "@/components/ErrorBanner";
import PageHeader from "@/components/ui/PageHeader";
import PriorityPicker from "@/components/ui/PriorityPicker";
import { useToastStore } from "@/store/toast";
import { timeAgo, formatDuration } from "@/lib/utils";
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

type RackFilter = "all" | "stuck" | "high" | RackStatus;

const FILTER_OPTIONS: { key: RackFilter; label: string }[] = [
  { key: "all",       label: "All"       },
  { key: "stuck",     label: "Stuck"     },
  { key: "high",      label: "High"      },
  { key: "intake",    label: "Intake"    },
  { key: "unpacking", label: "Unpacking" },
  { key: "sorting",   label: "Sorting"   },
  { key: "lotting",   label: "Lotting"   },
  { key: "ready",     label: "Ready"     },
  { key: "pickup",    label: "Pickup"    },
];

const STAGE_STEPS = PIPELINE_STAGES.map((s) => s.status);

function rackBorderCls(priority: Priority, stuck: boolean) {
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
  rack, delivery, zone, stuck, timeInStage, onAdvance, onClick,
}: {
  rack: Rack;
  delivery?: Delivery;
  zone?: Zone;
  stuck: boolean;
  timeInStage: number;
  onAdvance: () => void;
  onClick: () => void;
}) {
  const isCompleted = rack.status === "completed";
  const nextLabel   = NEXT_STAGE_LABEL[rack.status];
  const isCritical  = stuck && rack.priority === "high";

  return (
    <li
      onClick={onClick}
      className={`cursor-pointer rounded-xl border border-stone-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150 overflow-hidden ${rackBorderCls(rack.priority, stuck)}`}
    >
      {/* TOP — ID · urgency · age */}
      <div className="px-4 pt-2.5 pb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="font-mono text-sm font-bold text-stone-900 tracking-tight">
            {rack.rackCode}
          </span>
          {isCritical ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-600">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              critical · {formatDuration(timeInStage)}
            </span>
          ) : stuck ? (
            <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] text-red-400">
              stuck · {formatDuration(timeInStage)}
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

      {/* MIDDLE — consigner · stage flow · stage label · zone/delivery */}
      <div className="px-4 pb-1.5 space-y-1.5">
        <p className="text-xs text-stone-400 truncate">{rack.consignerName}</p>

        <div className="space-y-1">
          <StageStrip status={rack.status} />
          <div className="flex items-center justify-between">
            <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${STAGE_BADGE[rack.status]}`}>
              {STAGE_LABEL[rack.status]}
            </span>
            {timeInStage > 0 && !stuck && (
              <span className="text-[11px] text-stone-400">{formatDuration(timeInStage)}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px]">
          {zone && (
            <Link
              href={`/zones/${zone.id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-stone-500 hover:text-orange-600 transition-colors"
            >
              {zone.name}
            </Link>
          )}
          {zone && delivery && <span className="text-stone-200">·</span>}
          {delivery && (
            <Link
              href={`/deliveries/${delivery.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-stone-400 hover:text-orange-600 transition-colors"
            >
              {delivery.deliveryCode}
            </Link>
          )}
        </div>
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

  const { racks, history, loading, error: storeError, addRack, advanceStatus } = useRacksStore();
  function clearStoreError() { useRacksStore.setState({ error: null }); }
  const { deliveries } = useDeliveriesStore();
  const { zones }      = useZonesStore();
  const addToast       = useToastStore((s) => s.add);

  const [query, setQuery]                 = useState("");
  const [filter, setFilter]               = useState<RackFilter>("all");
  const [showForm, setShowForm]           = useState(!!preselectedDelivery);
  const [consignerName, setConsignerName] = useState("");
  const [priority, setPriority]           = useState<Priority>("normal");
  const [zoneId, setZoneId]               = useState("");
  const [deliveryId, setDeliveryId]       = useState(preselectedDelivery);
  const [notes, setNotes]                 = useState("");
  const [formError, setFormError]         = useState("");

  const activeDeliveries = deliveries.filter((d) => d.status !== "complete");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consignerName.trim()) return setFormError("Consigner name required.");
    if (!deliveryId)           return setFormError("Select a delivery.");
    setFormError("");
    const result = await addRack({ consignerName: consignerName.trim(), priority, zoneId: zoneId || undefined, deliveryId, notes: notes.trim() || undefined });
    setConsignerName(""); setPriority("normal"); setZoneId(""); setDeliveryId(preselectedDelivery); setNotes("");
    setShowForm(false);
    if (result.ok) addToast(`${result.data.rackCode} added`);
  }

  const q = query.toLowerCase();
  const filtered = racks.filter((r) => {
    const stuck    = isRackStuck(r, history);
    const zone     = r.zoneId     ? zones.find((z) => z.id === r.zoneId)          : undefined;
    const delivery = r.deliveryId ? deliveries.find((d) => d.id === r.deliveryId) : undefined;

    if (q && !(
      r.rackCode.toLowerCase().includes(q) ||
      r.consignerName.toLowerCase().includes(q) ||
      zone?.name.toLowerCase().includes(q) ||
      delivery?.deliveryCode.toLowerCase().includes(q) ||
      delivery?.consignerName.toLowerCase().includes(q)
    )) return false;

    if (filter === "stuck") return stuck;
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
          <input type="text" placeholder="Consigner name" value={consignerName}
            onChange={(e) => setConsignerName(e.target.value)} className={inputCls} autoFocus />
          <PriorityPicker value={priority} onChange={setPriority} />
          <Select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">No zone assigned</option>
            {zones.map((z) => {
              const { count, status } = getZoneOccupancy(z.id, racks, zones);
              const cap  = z.capacity ? ` (${count}/${z.capacity}${status === "full" ? " FULL" : ""})` : ` (${count})`;
              const desc = z.label ? ` — ${z.label}` : "";
              return <option key={z.id} value={z.id}>{z.name}{desc}{cap}</option>;
            })}
          </Select>
          <Select value={deliveryId} onChange={(e) => setDeliveryId(e.target.value)}>
            <option value="">Select a delivery</option>
            {activeDeliveries.map((d) => (
              <option key={d.id} value={d.id}>{d.deliveryCode} — {d.consignerName}</option>
            ))}
          </Select>
          <input type="text" placeholder="Notes (optional)" value={notes}
            onChange={(e) => setNotes(e.target.value)} className={inputCls} />
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
                ? "bg-orange-600 text-white"
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
              ? "Open a delivery and add racks to start tracking."
              : "Try a different filter or clear your search."}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((rack) => {
            const stuck       = isRackStuck(rack, history);
            const timeInStage = getTimeInCurrentStatus(rack, history);
            const delivery    = deliveries.find((d) => d.id === rack.deliveryId);
            const zone        = zones.find((z) => z.id === rack.zoneId);
            return (
              <RackCard
                key={rack.id}
                rack={rack}
                delivery={delivery}
                zone={zone}
                stuck={stuck}
                timeInStage={timeInStage}
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
