import type { Rack, Delivery, Zone, HistoryEvent, RackStatus, DeliveryStatus, Priority } from "@/types";
import {
  isRackNeedsAttention,
  getTimeInCurrentStatus,
  WAITING_STAGES,
} from "@/lib/timeTracking";

// ── Result types ──────────────────────────────────────────────────────────────

export interface RackResult {
  type: "rack";
  id: string;
  rackCode: string;
  consignerName: string;
  status: RackStatus;
  priority: Priority;
  zoneName?: string;
  zoneId?: string;
  deliveryCode?: string;
  deliveryJNumber?: string;
  deliveryId?: string;
  needsAttention: boolean;
  isCritical: boolean;
  timeInStageMs: number;
}

export interface DeliveryResult {
  type: "delivery";
  id: string;
  deliveryCode: string;
  consignerJNumber?: string;
  consignerName: string;
  status: DeliveryStatus;
  linkedRackCount: number;
}

export interface ZoneResult {
  type: "zone";
  id: string;
  name: string;
  label?: string;
  rackCount: number;
}

export interface SearchResults {
  racks: RackResult[];
  deliveries: DeliveryResult[];
  zones: ZoneResult[];
}

// ── Scoring helpers ───────────────────────────────────────────────────────────

// Returns a numeric relevance score for how well `value` matches `q`.
// Lower = better: 0 exact, 1 starts-with, 2 word-starts-with, 3 substring, Infinity = no match.
function matchScore(value: string | undefined, q: string): number {
  if (!value) return Infinity;
  const v = value.toLowerCase();
  if (v === q)          return 0;
  if (v.startsWith(q))  return 1;
  // word boundary start: space followed by query
  if (v.includes(" " + q)) return 2;
  if (v.includes(q))    return 3;
  return Infinity;
}

function hit(value: string | undefined, q: string): boolean {
  return matchScore(value, q) < Infinity;
}

// ── Core search ───────────────────────────────────────────────────────────────

export function search(
  query: string,
  racks: Rack[],
  deliveries: Delivery[],
  zones: Zone[],
  history: HistoryEvent[]
): SearchResults {
  const q = query.trim().toLowerCase();
  if (!q) return { racks: [], deliveries: [], zones: [] };

  // Build lookup maps once
  const deliveryMap  = new Map(deliveries.map((d) => [d.id, d]));
  const zoneMap      = new Map(zones.map((z) => [z.id, z]));
  const linkedCounts = new Map<string, number>();
  const racksByZone  = new Map<string, number>();
  for (const rack of racks) {
    if (rack.deliveryId) {
      linkedCounts.set(rack.deliveryId, (linkedCounts.get(rack.deliveryId) ?? 0) + 1);
    }
    if (rack.zoneId) {
      racksByZone.set(rack.zoneId, (racksByZone.get(rack.zoneId) ?? 0) + 1);
    }
  }

  // Severity bucket: 0 = critical, 1 = needs attention, 2 = normal
  function severity(r: RackResult): number {
    if (r.isCritical) return 0;
    if (r.needsAttention && !WAITING_STAGES.has(r.status)) return 1;
    return 2;
  }

  // ── Zone results ──────────────────────────────────────────────────────────
  const zoneResults: ZoneResult[] = zones
    .filter((z) => hit(z.name, q) || hit(z.label, q))
    .map((z): ZoneResult => ({
      type: "zone",
      id: z.id,
      name: z.name,
      label: z.label,
      rackCount: racksByZone.get(z.id) ?? 0,
    }))
    .sort((a, b) => {
      // Exact match first, then starts-with, then substring
      const sa = Math.min(matchScore(a.name, q), matchScore(a.label, q));
      const sb = Math.min(matchScore(b.name, q), matchScore(b.label, q));
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name);
    });

  // ── Rack results ──────────────────────────────────────────────────────────
  const rackResults: RackResult[] = racks
    .filter((rack) => {
      const delivery = rack.deliveryId ? deliveryMap.get(rack.deliveryId) : undefined;
      const zone     = rack.zoneId     ? zoneMap.get(rack.zoneId)         : undefined;
      return (
        hit(rack.rackCode,              q) ||
        hit(rack.consignerName,         q) ||
        hit(delivery?.deliveryCode,     q) ||
        hit(delivery?.consignerJNumber, q) ||
        hit(delivery?.consignerName,    q) ||
        hit(zone?.name,                 q) ||
        hit(zone?.label,                q)
      );
    })
    .map((rack): RackResult => {
      const delivery      = rack.deliveryId ? deliveryMap.get(rack.deliveryId) : undefined;
      const zone          = rack.zoneId     ? zoneMap.get(rack.zoneId)         : undefined;
      const attention     = isRackNeedsAttention(rack, history);
      const timeInStageMs = getTimeInCurrentStatus(rack, history);
      const isCritical    = !WAITING_STAGES.has(rack.status) && attention && rack.priority === "high";
      return {
        type: "rack",
        id: rack.id,
        rackCode: rack.rackCode,
        consignerName: rack.consignerName,
        status: rack.status,
        priority: rack.priority,
        zoneId: rack.zoneId,
        zoneName: zone?.name,
        deliveryId: rack.deliveryId,
        deliveryCode: delivery?.deliveryCode,
        deliveryJNumber: delivery?.consignerJNumber,
        needsAttention: attention,
        isCritical,
        timeInStageMs,
      };
    })
    .sort((a, b) => {
      const sa = severity(a), sb = severity(b);
      if (sa !== sb) return sa - sb;
      // Within same severity: best field match first (prefix > word-start > substring)
      const ra = Math.min(
        matchScore(a.rackCode,       q),
        matchScore(a.consignerName,  q),
        matchScore(a.zoneName,       q),
        matchScore(a.deliveryCode,   q),
        matchScore(a.deliveryJNumber,q),
      );
      const rb = Math.min(
        matchScore(b.rackCode,       q),
        matchScore(b.consignerName,  q),
        matchScore(b.zoneName,       q),
        matchScore(b.deliveryCode,   q),
        matchScore(b.deliveryJNumber,q),
      );
      if (ra !== rb) return ra - rb;
      return b.timeInStageMs - a.timeInStageMs;
    });

  // ── Delivery results ──────────────────────────────────────────────────────
  const deliveryStatusOrder: DeliveryStatus[] = [
    "arrived", "processing", "scheduled", "complete",
  ];

  const deliveryResults: DeliveryResult[] = deliveries
    .filter((d) => hit(d.deliveryCode, q) || hit(d.consignerName, q) || hit(d.consignerJNumber, q))
    .map((d): DeliveryResult => ({
      type: "delivery",
      id: d.id,
      deliveryCode: d.deliveryCode,
      consignerJNumber: d.consignerJNumber,
      consignerName: d.consignerName,
      status: d.status,
      linkedRackCount: linkedCounts.get(d.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        deliveryStatusOrder.indexOf(a.status) -
        deliveryStatusOrder.indexOf(b.status)
    );

  return { racks: rackResults, deliveries: deliveryResults, zones: zoneResults };
}
