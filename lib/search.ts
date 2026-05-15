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

export interface SearchResults {
  racks: RackResult[];
  deliveries: DeliveryResult[];
}

// ── Core search ───────────────────────────────────────────────────────────────

function hit(value: string | undefined, q: string): boolean {
  return !!value?.toLowerCase().includes(q);
}

export function search(
  query: string,
  racks: Rack[],
  deliveries: Delivery[],
  zones: Zone[],
  history: HistoryEvent[]
): SearchResults {
  const q = query.trim().toLowerCase();
  if (!q) return { racks: [], deliveries: [] };

  // Build lookup maps once — O(1) per item inside the filter
  const deliveryMap   = new Map(deliveries.map((d) => [d.id, d]));
  const zoneMap       = new Map(zones.map((z) => [z.id, z]));
  const linkedCounts  = new Map<string, number>();
  const racksByDelivery = new Map<string, Rack[]>();
  for (const rack of racks) {
    if (rack.deliveryId) {
      linkedCounts.set(rack.deliveryId, (linkedCounts.get(rack.deliveryId) ?? 0) + 1);
      if (!racksByDelivery.has(rack.deliveryId)) racksByDelivery.set(rack.deliveryId, []);
      racksByDelivery.get(rack.deliveryId)!.push(rack);
    }
  }

  // Severity bucket: 0 = critical, 1 = needs attention, 2 = normal
  function severity(r: RackResult): number {
    if (r.isCritical) return 0;
    if (r.needsAttention && !WAITING_STAGES.has(r.status)) return 1;
    return 2;
  }

  // ── Rack results ──────────────────────────────────────────────────────────
  const rackResults: RackResult[] = racks
    .filter((rack) => {
      const delivery = rack.deliveryId ? deliveryMap.get(rack.deliveryId) : undefined;
      const zone     = rack.zoneId     ? zoneMap.get(rack.zoneId)         : undefined;
      return (
        hit(rack.rackCode,           q) ||
        hit(rack.consignerName,      q) ||
        hit(delivery?.deliveryCode,      q) ||
        hit(delivery?.consignerJNumber,  q) ||
        hit(delivery?.consignerName,     q) ||
        hit(zone?.name,              q) ||
        hit(zone?.label,             q)
      );
    })
    .map((rack): RackResult => {
      const delivery      = rack.deliveryId ? deliveryMap.get(rack.deliveryId)     : undefined;
      const zone          = rack.zoneId     ? zoneMap.get(rack.zoneId)             : undefined;
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
      return b.timeInStageMs - a.timeInStageMs;
    });

  // ── Delivery results ──────────────────────────────────────────────────────
  const deliveryStatusOrder: DeliveryStatus[] = [
    "arrived", "processing", "scheduled", "complete",
  ]; // unpacking_complete removed from pipeline

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

  return { racks: rackResults, deliveries: deliveryResults };
}
