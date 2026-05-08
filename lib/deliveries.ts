import type { Delivery, Rack } from "@/types";
import { formatDate } from "@/lib/utils";

/**
 * Estimates the rack count for a new delivery based on historical actuals
 * for the same consigner. Uses linked rack counts, not expectedRackCount,
 * because expectedRackCount is often 0 for walk-ins.
 *
 * Returns null when there is no history or the average rounds to zero.
 */
export function estimateRackCount(
  consignerName: string,
  deliveries: Delivery[],
  racks: Rack[]
): { estimate: number; sampleSize: number } | null {
  const q = consignerName.trim().toLowerCase();
  if (!q) return null;

  const past = deliveries.filter(
    (d) => d.consignerName.trim().toLowerCase().startsWith(q)
  );
  if (past.length === 0) return null;

  const counts = past.map(
    (d) => racks.filter((r) => r.deliveryId === d.id).length
  );
  const estimate = Math.round(
    counts.reduce((a, b) => a + b, 0) / counts.length
  );
  if (estimate === 0) return null;

  return { estimate, sampleSize: past.length };
}

// ── Consigner summary ─────────────────────────────────────────────────────────

export interface ConsignerSummary {
  canonicalName: string;  // correctly-spelled name from most recent past delivery
  deliveryCount: number;
  avgRackCount: number;   // 0 = all past deliveries had no linked racks
  lastDeliveryDate: string; // formatted display string e.g. "Apr 27"
}

export function getConsignerSummary(
  consignerName: string,
  deliveries: Delivery[],
  racks: Rack[]
): ConsignerSummary | null {
  const q = consignerName.trim().toLowerCase();
  if (!q) return null;

  const past = deliveries.filter(
    (d) => d.consignerName.trim().toLowerCase().startsWith(q)
  );
  if (past.length === 0) return null;

  const sorted = [...past].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const counts = past.map(
    (d) => racks.filter((r) => r.deliveryId === d.id).length
  );
  const avgRackCount = Math.round(
    counts.reduce((a, b) => a + b, 0) / counts.length
  );

  return {
    canonicalName: sorted[0].consignerName,
    deliveryCount: past.length,
    avgRackCount,
    lastDeliveryDate: formatDate(sorted[0].scheduledDate),
  };
}
