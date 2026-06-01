import type { Rack, Zone } from "@/types";

// Zone names whose labels are fixed and must never be overwritten
export const FIXED_ZONE_LABELS: Record<string, string> = {
  H:  "Warehouse Hallway",
  B:  "Lotting Room",
  C:  "Sorting Room",
  PU: "Pick-Up",
};

export function getZoneOccupancy(
  zoneId: string,
  racks: Rack[],
  _zones: Zone[],
  excludeRackId?: string
): { count: number } {
  const count = racks.filter(
    (r) => r.zoneId === zoneId && r.id !== excludeRackId
  ).length;
  return { count };
}
