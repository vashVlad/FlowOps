import { useDeliveriesStore } from "@/store/deliveries";
import { useRacksStore } from "@/store/racks";
import type { Delivery, Rack, CreateDeliveryInput } from "@/types";

export interface DeliveryProgress {
  total:      number;
  processed:  number; // status === "ready" or "completed"
  percentage: number; // 0–100
}

export function getDeliveries(): Delivery[] {
  return useDeliveriesStore.getState().deliveries;
}

export function getDeliveryById(id: string): Delivery | undefined {
  return useDeliveriesStore.getState().deliveries.find((d) => d.id === id);
}

export function getRacksByDelivery(deliveryId: string): Rack[] {
  return useRacksStore.getState().racks.filter((r) => r.deliveryId === deliveryId);
}

export async function createDelivery(input: CreateDeliveryInput): Promise<Delivery> {
  const result = await useDeliveriesStore.getState().addDelivery(input);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

export function getDeliveryProgress(deliveryId: string): DeliveryProgress {
  const racks     = getRacksByDelivery(deliveryId);
  const total     = racks.length;
  const processed = racks.filter(
    (r) => r.status === "ready" || r.status === "completed"
  ).length;
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
  return { total, processed, percentage };
}
