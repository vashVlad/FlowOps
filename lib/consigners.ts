import type { Delivery, Rack } from "@/types";
import { formatDate } from "@/lib/utils";

// ── Consigner profile ─────────────────────────────────────────────────────────

export interface ConsignerProfile {
  key: string;           // normalized name (lowercase) — used for URL slug matching
  name: string;          // display name from most recent delivery
  jNumber?: string;      // from most recent delivery that has one
  deliveryIds: string[];
  totalDeliveries: number;
  activeDeliveries: number;
  totalRacks: number;
  activeRacks: number;
  avgRacksPerDelivery: number;
  lastDeliveryDate: string;       // YYYY-MM-DD
  avgProcessingDays: number | null; // calendar days avg for completed deliveries
  qualityTags: QualityTag[];
}

export interface QualityTag {
  label: string;
  color: "blue" | "amber" | "orange" | "violet";
}

export function buildConsignerProfiles(
  deliveries: Delivery[],
  racks: Rack[]
): ConsignerProfile[] {
  const grouped = new Map<string, Delivery[]>();

  for (const d of deliveries) {
    const key = d.consignerName.trim().toLowerCase();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(d);
  }

  const profiles: ConsignerProfile[] = [];

  for (const [key, ds] of grouped) {
    const sorted = [...ds].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const mostRecent = sorted[0];

    const deliveryIds = ds.map((d) => d.id);
    const deliverySet = new Set(deliveryIds);
    const linkedRacks = racks.filter((r) => deliverySet.has(r.deliveryId));

    const activeDeliveries = ds.filter((d) => d.status !== "complete").length;
    const totalRacks       = linkedRacks.length;
    const activeRacks      = linkedRacks.filter((r) => r.status !== "completed").length;
    const avgRacksPerDelivery = ds.length > 0 ? Math.round(totalRacks / ds.length) : 0;

    // Avg calendar days from creation to completion for completed deliveries
    const completed = ds.filter((d) => d.status === "complete" && d.completedAt);
    let avgProcessingDays: number | null = null;
    if (completed.length > 0) {
      const totalMs = completed.reduce(
        (s, d) => s + (new Date(d.completedAt!).getTime() - new Date(d.createdAt).getTime()),
        0
      );
      avgProcessingDays = Math.round(totalMs / completed.length / 86_400_000);
    }

    // J-number from most recent delivery that has one
    const jNumber = sorted.find((d) => d.consignerJNumber)?.consignerJNumber;

    // Quality tags
    const tags: QualityTag[] = [];
    if (avgRacksPerDelivery >= 8)
      tags.push({ label: "High volume", color: "blue" });
    const heldRacks = linkedRacks.filter((r) => r.holdReason);
    if (heldRacks.length >= 2)
      tags.push({ label: "Frequently held", color: "amber" });
    if (avgProcessingDays !== null && avgProcessingDays > 7)
      tags.push({ label: "Slow to process", color: "orange" });
    profiles.push({
      key,
      name:                 mostRecent.consignerName,
      jNumber,
      deliveryIds,
      totalDeliveries:      ds.length,
      activeDeliveries,
      totalRacks,
      activeRacks,
      avgRacksPerDelivery,
      lastDeliveryDate:     mostRecent.scheduledDate,
      avgProcessingDays,
      qualityTags:          tags,
    });
  }

  return profiles;
}

// ── Intake forecast ───────────────────────────────────────────────────────────

export interface ForecastItem {
  severity: "warning" | "info";
  message: string;
  detail?: string;
}

export function buildIntakeForecast(
  deliveries: Delivery[],
  racks: Rack[]
): ForecastItem[] {
  const items: ForecastItem[] = [];

  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const next7d = new Date(base.getTime() + 7 * 86_400_000);
  const next3d = new Date(base.getTime() + 3 * 86_400_000);

  const scheduledSoon = deliveries.filter((d) => {
    if (d.status !== "scheduled") return false;
    const date = new Date(d.scheduledDate + "T00:00:00");
    return date >= base && date <= next7d;
  });

  if (scheduledSoon.length === 0) return items;

  const expectedTotal  = scheduledSoon.reduce((s, d) => s + d.expectedRackCount, 0);
  const activeRacks    = racks.filter((r) => r.status !== "completed").length;
  const currentLotting = racks.filter((r) => r.status === "lotting").length;

  // High intake week
  if (expectedTotal >= 15) {
    items.push({
      severity: "warning",
      message:  `${expectedTotal} racks expected this week`,
      detail:   `${scheduledSoon.length} scheduled deliveries · ${activeRacks} already active`,
    });
  } else if (scheduledSoon.length >= 2 && expectedTotal >= 6) {
    items.push({
      severity: "info",
      message:  `${scheduledSoon.length} deliveries scheduled this week`,
      detail:   scheduledSoon.map((d) => d.consignerName).join(" · "),
    });
  }

  // Large single delivery incoming ≤ 3 days
  const bigSoon = scheduledSoon.filter(
    (d) => d.expectedRackCount >= 10 && new Date(d.scheduledDate + "T00:00:00") <= next3d
  );
  for (const d of bigSoon) {
    items.push({
      severity: "warning",
      message:  `Large delivery — ${d.consignerName} · ${d.expectedRackCount} racks`,
      detail:   `Arriving ${formatDate(d.scheduledDate)} · plan receiving capacity`,
    });
  }

  // Lotting may compound
  if (currentLotting >= 8 && expectedTotal >= 5) {
    items.push({
      severity: "warning",
      message:  "Lotting load may increase this week",
      detail:   `${currentLotting} in lotting now · ~${expectedTotal} more racks inbound`,
    });
  }

  return items;
}
