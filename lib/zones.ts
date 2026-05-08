import type { Rack, Zone, OccupancyStatus } from "@/types";

export interface ZoneOccupancy {
  count:    number;
  capacity: number | undefined;
  pct:      number | null;       // null when zone has no capacity limit
  status:   OccupancyStatus;     // "ok" | "near" | "full"
}

export function occupancyStatus(
  count: number,
  capacity: number | undefined
): OccupancyStatus {
  if (!capacity) return "ok";
  if (count >= capacity) return "full";
  if (count / capacity >= 0.8) return "near";
  return "ok";
}

/**
 * Returns occupancy data for one zone.
 *
 * @param excludeRackId - omit this rack from the count (used on the rack detail
 *   page so a rack's own zone shows the correct count when it's already in that zone)
 */
export function getZoneOccupancy(
  zoneId: string,
  racks: Rack[],
  zones: Zone[],
  excludeRackId?: string
): ZoneOccupancy {
  const zone     = zones.find((z) => z.id === zoneId);
  const count    = racks.filter(
    (r) => r.zoneId === zoneId && r.id !== excludeRackId
  ).length;
  const capacity = zone?.capacity;
  const pct      = capacity
    ? Math.min(100, Math.round((count / capacity) * 100))
    : null;

  return { count, capacity, pct, status: occupancyStatus(count, capacity) };
}
