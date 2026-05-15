"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRacksStore } from "@/store/racks";
import { useDeliveriesStore } from "@/store/deliveries";
import { useZonesStore } from "@/store/zones";
import StatusBadge from "@/components/StatusBadge";
import DeliveryStatusBadge from "@/components/DeliveryStatusBadge";
import { search } from "@/lib/search";
import { formatBusinessDuration } from "@/lib/timeTracking";
import { PRIORITY_BORDER } from "@/lib/tokens";
import { WAITING_STAGES } from "@/lib/timeTracking";
import type { RackResult, DeliveryResult } from "@/lib/search";

type ResultFilter = "all" | "racks" | "deliveries";

const QUICK_LINKS = [
  { href: "/racks",      label: "All racks"         },
  { href: "/lotting",    label: "Lotting queue"      },
  { href: "/deliveries", label: "Deliveries"         },
  { href: "/zones",      label: "Zones"              },
];

const SEARCH_HINTS = [
  { label: "Rack code",  example: "RC-0042"        },
  { label: "Consigner",  example: "Smith Auctions"  },
  { label: "Delivery",   example: "DEL-0008"        },
  { label: "Zone",       example: "G3, W1, OVF"    },
];

export default function SearchPage() {
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { racks, history } = useRacksStore();
  const { deliveries }     = useDeliveriesStore();
  const { zones }          = useZonesStore();

  const [query,  setQuery]  = useState("");
  const [filter, setFilter] = useState<ResultFilter>("all");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const raw     = search(query, racks, deliveries, zones, history);
  const results = {
    racks:      filter === "deliveries" ? [] : raw.racks,
    deliveries: filter === "racks"      ? [] : raw.deliveries,
  };
  const total    = results.racks.length + results.deliveries.length;
  const hasQuery = query.trim().length > 0;

  return (
    <div className="space-y-4">

      {/* Search input */}
      <div className="relative">
        <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search racks, consigners, deliveries, zones…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search racks and deliveries"
          className="w-full rounded-xl border border-stone-200 bg-white pl-10 pr-10 py-3 text-sm text-stone-900 placeholder:text-stone-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          autoFocus
        />
        {hasQuery ? (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        ) : (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
            <kbd className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[11px] text-stone-400">/</kbd>
          </div>
        )}
      </div>

      {/* Type filter — only show when there's a query */}
      {hasQuery && (
        <div className="flex gap-1.5">
          {(["all", "racks", "deliveries"] as ResultFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-stone-800 text-white"
                  : "bg-stone-100 text-stone-500 hover:bg-stone-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Empty state — no query */}
      {!hasQuery && (
        <div className="space-y-5 pt-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-stone-400">Press</p>
            <kbd className="inline-flex items-center rounded border border-stone-200 bg-stone-50 px-1.5 py-px font-mono text-[11px] text-stone-500">/</kbd>
            <p className="text-xs text-stone-400">from any page to jump here.</p>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 mb-2.5">Quick access</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex items-center rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 shadow-sm hover:bg-stone-50 hover:text-stone-900 transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 mb-3">Search by</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 sm:grid-cols-4">
              {SEARCH_HINTS.map(({ label, example }) => (
                <div key={label}>
                  <p className="text-xs font-medium text-stone-700">{label}</p>
                  <p className="text-[11px] text-stone-400 mt-0.5">{example}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* No results */}
      {hasQuery && total === 0 && (
        <div className="rounded-xl border border-stone-200 bg-white px-5 py-5 shadow-sm text-center">
          <p className="text-sm font-medium text-stone-700">No results for &ldquo;{query}&rdquo;</p>
          <p className="text-xs text-stone-400 mt-1">Check the spelling or try a rack code, delivery code, or consigner name.</p>
        </div>
      )}

      {/* Results */}
      {hasQuery && total > 0 && (
        <div className="space-y-5">
          {results.deliveries.length > 0 && (
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 mb-2">
                Deliveries · {results.deliveries.length}
              </p>
              <ul className="flex flex-col gap-1.5">
                {results.deliveries.map((d) => (
                  <DeliveryRow key={d.id} result={d} />
                ))}
              </ul>
            </section>
          )}

          {results.racks.length > 0 && (
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 mb-2">
                Racks · {results.racks.length}
              </p>
              <ul className="flex flex-col gap-1.5">
                {results.racks.map((r) => (
                  <RackRow key={r.id} result={r} onNavigate={() => router.push(`/racks/${r.id}`)} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function DeliveryRow({ result }: { result: DeliveryResult }) {
  const rackLabel =
    result.linkedRackCount > 0
      ? `${result.linkedRackCount} rack${result.linkedRackCount !== 1 ? "s" : ""}`
      : null;

  return (
    <li className="rounded-xl border border-stone-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150">
      <Link href={`/deliveries/${result.id}`} className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-sm font-bold text-stone-900">
              {result.consignerJNumber ?? result.deliveryCode}
            </span>
            <DeliveryStatusBadge status={result.status} />
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            {result.consignerName}
            {rackLabel && <><span className="text-stone-300"> · </span>{rackLabel}</>}
          </p>
        </div>
        <span className="shrink-0 text-xs text-stone-300">→</span>
      </Link>
    </li>
  );
}

function RackRow({ result, onNavigate }: { result: RackResult; onNavigate: () => void }) {
  const isWaiting    = WAITING_STAGES.has(result.status);
  const showCritical = result.isCritical;
  const showWarning  = !showCritical && result.needsAttention && !isWaiting;
  const borderKey    = showCritical ? "needs_attention" : result.priority === "high" ? "high" : result.priority === "low" ? "low" : "normal";

  return (
    <li
      onClick={onNavigate}
      className={`cursor-pointer rounded-xl border border-stone-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150 ${PRIORITY_BORDER[borderKey]}`}
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-sm font-bold text-stone-900">{result.rackCode}</span>
            {showCritical && (
              <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-600">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                needs attention · {formatBusinessDuration(result.timeInStageMs)}
              </span>
            )}
            {showWarning && (
              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-xs text-amber-600">
                needs attention · {formatBusinessDuration(result.timeInStageMs)}
              </span>
            )}
            {!showCritical && !showWarning && result.priority === "high" && (
              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">high</span>
            )}
          </div>
          <p className="text-xs text-stone-400 mt-0.5 capitalize">
            {result.status}
            <span className="text-stone-300"> · </span>{formatBusinessDuration(result.timeInStageMs)}
            {(result.deliveryJNumber ?? result.deliveryCode) && (
              <><span className="text-stone-300"> · </span>{result.deliveryJNumber ?? result.deliveryCode}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={result.status} />
          <span className="text-xs text-stone-300">→</span>
        </div>
      </div>
    </li>
  );
}
