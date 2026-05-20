"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeliveriesStore } from "@/store/deliveries";
import { useRacksStore } from "@/store/racks";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import DeliveryStatusBadge from "@/components/DeliveryStatusBadge";
import { today } from "@/lib/utils";
import type { Delivery } from "@/types";

// ── Delivery timeline card ─────────────────────────────────────────────────────

function DeliveryRow({ delivery }: { delivery: Delivery }) {
  const router = useRouter();

  const timeLabel =
    delivery.type === "walkin"
      ? "Walk-in"
      : delivery.scheduledDate === today()
      ? "Today"
      : new Date(delivery.scheduledDate + "T00:00:00").toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric",
        });

  return (
    <button
      onClick={() => router.push(`/deliveries/${delivery.id}`)}
      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-stone-50 transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-stone-900 truncate">{delivery.consignerName}</p>
          <DeliveryStatusBadge status={delivery.status} />
          {delivery.auctionDate && (
            <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              Auction {new Date(delivery.auctionDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
        <p className="text-xs text-stone-400 mt-0.5">
          {delivery.deliveryCode} · {timeLabel}
          {delivery.expectedRackCount > 0 && ` · ${delivery.expectedRackCount} racks expected`}
        </p>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-stone-300 shrink-0">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

// ── Consigner lookup ───────────────────────────────────────────────────────────

function ConsignerLookup() {
  const [query,  setQuery]  = useState("");
  const deliveries          = useDeliveriesStore((s) => s.deliveries);
  const router              = useRouter();

  const matches = query.trim().length >= 2
    ? deliveries
        .filter((d) => d.consignerName.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 6)
    : [];

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-stone-200 bg-white focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-transparent transition-all">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-stone-400 shrink-0">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Look up a consigner…"
          className="flex-1 text-sm text-stone-900 placeholder-stone-400 bg-transparent outline-none"
        />
        {query && (
          <button onClick={() => setQuery("")} className="text-stone-300 hover:text-stone-500 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {matches.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-20 rounded-xl border border-stone-200 bg-white shadow-lg overflow-hidden">
          {matches.map((d) => (
            <button
              key={d.id}
              onClick={() => { router.push(`/deliveries/${d.id}`); setQuery(""); }}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors text-left border-b border-stone-50 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-stone-900">{d.consignerName}</p>
                <p className="text-xs text-stone-400 mt-0.5">{d.deliveryCode} · {d.status}</p>
              </div>
              <DeliveryStatusBadge status={d.status} />
            </button>
          ))}
          <Link
            href={`/consigners?q=${encodeURIComponent(query)}`}
            className="block px-4 py-2.5 text-xs text-orange-600 hover:text-orange-700 font-medium border-t border-stone-100 transition-colors"
          >
            View all results for &quot;{query}&quot; →
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FrontDeskPage() {
  const deliveries = useDeliveriesStore((s) => s.deliveries);
  const racks      = useRacksStore((s) => s.racks);
  const router     = useRouter();

  const todayStr = today();

  // Today's active deliveries — scheduled for today or currently processing/arrived
  const todayDeliveries = deliveries
    .filter((d) =>
      d.status !== "complete" &&
      (d.scheduledDate === todayStr || d.type === "walkin" || d.status === "arrived" || d.status === "processing")
    )
    .sort((a, b) => {
      const order = { processing: 0, arrived: 1, scheduled: 2, complete: 3 };
      return order[a.status] - order[b.status];
    });

  // Upcoming scheduled (future dates, not today)
  const upcomingDeliveries = deliveries
    .filter((d) => d.status === "scheduled" && d.scheduledDate > todayStr)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    .slice(0, 5);

  // Quick stats
  const arrivedCount    = deliveries.filter((d) => d.status === "arrived").length;
  const processingCount = deliveries.filter((d) => d.status === "processing").length;
  const scheduledToday  = deliveries.filter((d) => d.status === "scheduled" && d.scheduledDate === todayStr).length;

  function startWalkIn() {
    router.push("/deliveries?new=walkin");
  }

  function scheduleDelivery() {
    router.push("/deliveries?new=scheduled");
  }

  return (
    <>
      <PageHeader
        title={`Good ${getGreeting()}`}
        subtitle={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      />

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <button
          onClick={startWalkIn}
          className="flex flex-col items-start gap-2 rounded-xl bg-orange-600 px-4 py-4 text-white hover:bg-orange-700 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 opacity-80">
            <rect x="1" y="3" width="15" height="13" rx="1" />
            <path d="M16 8h4l3 5v4h-7V8z" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
          <div>
            <p className="text-sm font-semibold">Walk-in</p>
            <p className="text-xs opacity-70">Truck just arrived</p>
          </div>
        </button>

        <button
          onClick={scheduleDelivery}
          className="flex flex-col items-start gap-2 rounded-xl bg-white border border-stone-200 px-4 py-4 text-stone-900 hover:bg-stone-50 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-stone-400">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <div>
            <p className="text-sm font-semibold">Schedule delivery</p>
            <p className="text-xs text-stone-400">Book future appointment</p>
          </div>
        </button>
      </div>

      {/* Consigner lookup */}
      <div className="mt-4">
        <ConsignerLookup />
      </div>

      {/* Quick stats */}
      {(arrivedCount > 0 || processingCount > 0 || scheduledToday > 0) && (
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: "Arrived", value: arrivedCount, color: "text-amber-600" },
            { label: "Processing", value: processingCount, color: "text-orange-600" },
            { label: "Scheduled today", value: scheduledToday, color: "text-stone-600" },
          ].map(({ label, value, color }) => (
            <Card key={label} padding="px-3 py-3">
              <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
              <p className="text-[11px] text-stone-400 mt-0.5 leading-tight">{label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Today's deliveries */}
      <div className="mt-5">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">Today</p>
        <Card padding="p-0" className="overflow-hidden divide-y divide-stone-50">
          {todayDeliveries.length === 0 ? (
            <p className="px-5 py-6 text-sm text-stone-400 text-center">No active deliveries today</p>
          ) : (
            todayDeliveries.map((d) => <DeliveryRow key={d.id} delivery={d} />)
          )}
        </Card>
      </div>

      {/* Upcoming */}
      {upcomingDeliveries.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">Upcoming</p>
          <Card padding="p-0" className="overflow-hidden divide-y divide-stone-50">
            {upcomingDeliveries.map((d) => <DeliveryRow key={d.id} delivery={d} />)}
          </Card>
        </div>
      )}
    </>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
