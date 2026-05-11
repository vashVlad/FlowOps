"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useDeliveriesStore } from "@/store/deliveries";
import { useRacksStore } from "@/store/racks";
import PageHeader from "@/components/ui/PageHeader";
import { LoadingCards } from "@/components/LoadingCards";
import { buildConsignerProfiles, type ConsignerProfile } from "@/lib/consigners";
import { formatDate } from "@/lib/utils";

const inputCls =
  "w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500";

const TAG_COLOR: Record<string, string> = {
  blue:   "bg-blue-50 text-blue-700",
  amber:  "bg-amber-50 text-amber-700",
  orange: "bg-orange-50 text-orange-700",
  violet: "bg-violet-50 text-violet-700",
};

type SortKey = "active" | "racks" | "newest" | "name";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "active",  label: "Most active"  },
  { key: "racks",   label: "Most racks"   },
  { key: "newest",  label: "Newest"       },
  { key: "name",    label: "Name A–Z"     },
];

function sortProfiles(profiles: ConsignerProfile[], sort: SortKey): ConsignerProfile[] {
  return [...profiles].sort((a, b) => {
    switch (sort) {
      case "active":  return (b.activeDeliveries - a.activeDeliveries) || (b.totalDeliveries - a.totalDeliveries);
      case "racks":   return b.totalRacks - a.totalRacks;
      case "newest":  return b.lastDeliveryDate.localeCompare(a.lastDeliveryDate);
      case "name":    return a.name.localeCompare(b.name);
    }
  });
}

function ConsignerCard({ profile }: { profile: ConsignerProfile }) {
  const isActive = profile.activeDeliveries > 0;
  return (
    <Link
      href={`/consigners/${encodeURIComponent(profile.name)}`}
      className={`block rounded-xl border bg-white px-5 py-4 shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150 overflow-hidden border-l-4 ${
        isActive ? "border-l-orange-400 border-stone-200" : "border-l-stone-200 border-stone-200"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold text-stone-900 truncate">{profile.name}</p>
          {profile.jNumber && (
            <p className="text-xs font-mono text-stone-500 mt-0.5">{profile.jNumber}</p>
          )}
        </div>
        {isActive && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[11px] font-medium text-orange-700">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
            active
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="mt-3 flex items-center gap-4 text-xs text-stone-500">
        <span>
          <span className="font-semibold text-stone-800">{profile.totalDeliveries}</span>{" "}
          {profile.totalDeliveries === 1 ? "delivery" : "deliveries"}
          {profile.activeDeliveries > 0 && (
            <span className="text-orange-600 ml-1">· {profile.activeDeliveries} active</span>
          )}
        </span>
        <span>
          <span className="font-semibold text-stone-800">{profile.totalRacks}</span> racks
          {profile.activeRacks > 0 && (
            <span className="text-orange-600 ml-1">· {profile.activeRacks} active</span>
          )}
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-4 text-xs text-stone-400">
        {profile.avgRacksPerDelivery > 0 && (
          <span>avg {profile.avgRacksPerDelivery} racks/delivery</span>
        )}
        {profile.avgProcessingDays !== null && (
          <span>avg {profile.avgProcessingDays}d to complete</span>
        )}
        <span>last {formatDate(profile.lastDeliveryDate)}</span>
      </div>

      {/* Quality tags */}
      {profile.qualityTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {profile.qualityTags.map((tag) => (
            <span
              key={tag.label}
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TAG_COLOR[tag.color]}`}
            >
              {tag.label}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

export default function ConsignersPage() {
  const { deliveries, loading: dLoading } = useDeliveriesStore();
  const { racks,      loading: rLoading } = useRacksStore();

  const [query, setQuery] = useState("");
  const [sort, setSort]   = useState<SortKey>("active");

  const profiles = useMemo(
    () => buildConsignerProfiles(deliveries, racks),
    [deliveries, racks]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? profiles.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.jNumber?.toLowerCase().includes(q) ?? false)
        )
      : profiles;
    return sortProfiles(base, sort);
  }, [profiles, query, sort]);

  const isLoading = dLoading || rLoading;
  const activeCount = profiles.filter((p) => p.activeDeliveries > 0).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Consigners"
        subtitle={
          isLoading
            ? undefined
            : `${profiles.length} consigners · ${activeCount} currently active`
        }
      />

      {!isLoading && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search consigners or J-numbers…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={inputCls}
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="shrink-0 rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {SORT_OPTIONS.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      )}

      {isLoading && profiles.length === 0 ? (
        <LoadingCards count={4} />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-5 py-8 shadow-sm text-center space-y-1">
          <p className="text-sm font-medium text-stone-700">
            {profiles.length === 0 ? "No consigners yet" : "No consigners match"}
          </p>
          <p className="text-xs text-stone-400">
            {profiles.length === 0
              ? "Consigners appear automatically once deliveries are created."
              : "Try a different search."}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((p) => (
            <li key={p.key}>
              <ConsignerCard profile={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
