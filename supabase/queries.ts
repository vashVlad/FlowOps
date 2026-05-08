/**
 * FlowOps V2 — Supabase Query Reference
 *
 * These are drop-in replacements for the current Zustand store actions.
 * The pattern:
 *   1. Query Supabase
 *   2. Map DB row (snake_case) → app type (camelCase)
 *   3. Write result into Zustand store (store remains the UI cache)
 *
 * Install: npm install @supabase/supabase-js
 * Types:   npx supabase gen types typescript --project-id <YOUR_ID> > types/supabase.ts
 */

import { supabase } from "@/lib/supabase";
import type { Rack, Delivery, Zone, HistoryEvent, RackStatus, Priority, DeliveryStatus, DeliveryType } from "@/types";

// ── DB row types (snake_case, nullable where Postgres allows NULL) ─────────────
// Replace these with the generated types from `supabase gen types` in production.

export interface RackRow {
  id: string;
  rack_code: string;
  consigner_name: string;
  status: RackStatus;
  priority: Priority;
  zone_id: string | null;
  delivery_id: string;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliveryRow {
  id: string;
  delivery_code: string;
  consigner_name: string;
  expected_rack_count: number;
  type: DeliveryType;
  status: DeliveryStatus;
  scheduled_date: string;
  arrived_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ZoneRow {
  id: string;
  name: string;
  label: string | null;
  capacity: number | null;
  created_at: string;
}

export interface RackEventRow {
  id: string;
  rack_id: string;
  from_status: RackStatus;
  to_status: RackStatus;
  created_at: string;  // maps to HistoryEvent.timestamp
}

// ── Row → app type mappers ────────────────────────────────────────────────────

export function toRack(row: RackRow): Rack {
  return {
    id:            row.id,
    rackCode:      row.rack_code,
    consignerName: row.consigner_name,
    status:        row.status,
    priority:      row.priority,
    zoneId:        row.zone_id     ?? undefined,
    deliveryId:    row.delivery_id,
    notes:         row.notes       ?? undefined,
    isArchived:    row.is_archived,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  };
}

export function toDelivery(row: DeliveryRow): Delivery {
  return {
    id:                 row.id,
    deliveryCode:       row.delivery_code,
    consignerName:      row.consigner_name,
    expectedRackCount:  row.expected_rack_count,
    type:               row.type,
    status:             row.status,
    scheduledDate:      row.scheduled_date,
    arrivedAt:          row.arrived_at   ?? undefined,
    completedAt:        row.completed_at ?? undefined,
    notes:              row.notes        ?? undefined,
    createdAt:          row.created_at,
    updatedAt:          row.updated_at,
  };
}

export function toZone(row: ZoneRow): Zone {
  return {
    id:        row.id,
    name:      row.name,
    label:     row.label    ?? undefined,
    capacity:  row.capacity ?? undefined,
    createdAt: row.created_at,
  };
}

export function toHistoryEvent(row: RackEventRow): HistoryEvent {
  return {
    id:        row.id,
    rackId:    row.rack_id,
    from:      row.from_status,
    to:        row.to_status,
    timestamp: row.created_at,  // DB column name differs — mapped here
  };
}

// ════════════════════════════════════════════════════════════════════════════
// READS — call these on store initialisation to hydrate Zustand
// ════════════════════════════════════════════════════════════════════════════

/** Load all zones (small table, fetch whole thing). */
export async function fetchZones(): Promise<Zone[]> {
  const { data, error } = await supabase
    .from("zones")
    .select("*")
    .order("name");

  if (error) throw error;
  return (data as ZoneRow[]).map(toZone);
}

/** Load all deliveries ordered by newest first. */
export async function fetchDeliveries(): Promise<Delivery[]> {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as DeliveryRow[]).map(toDelivery);
}

/** Load all active (non-archived) racks ordered by newest first. */
export async function fetchRacks(): Promise<Rack[]> {
  const { data, error } = await supabase
    .from("racks")
    .select("*")
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as RackRow[]).map(toRack);
}

/** Load all rack events. Used to hydrate the history store on app load. */
export async function fetchAllRackEvents(): Promise<HistoryEvent[]> {
  const { data, error } = await supabase
    .from("rack_events")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data as RackEventRow[]).map(toHistoryEvent);
}

// ── Focused reads (use these for detail pages — avoid loading everything) ──

/** Load racks for one delivery. */
export async function fetchRacksByDelivery(deliveryId: string): Promise<Rack[]> {
  const { data, error } = await supabase
    .from("racks")
    .select("*")
    .eq("delivery_id", deliveryId)
    .order("created_at");

  if (error) throw error;
  return (data as RackRow[]).map(toRack);
}

/** Load racks currently in a zone. */
export async function fetchRacksByZone(zoneId: string): Promise<Rack[]> {
  const { data, error } = await supabase
    .from("racks")
    .select("*")
    .eq("zone_id", zoneId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data as RackRow[]).map(toRack);
}

/** Load history for one rack (used by time tracking functions). */
export async function fetchRackEvents(rackId: string): Promise<HistoryEvent[]> {
  const { data, error } = await supabase
    .from("rack_events")
    .select("*")
    .eq("rack_id", rackId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data as RackEventRow[]).map(toHistoryEvent);
}

/** Dashboard aggregate: rack count per status. Single query, no JS loops. */
export async function fetchStatusCounts(): Promise<Record<RackStatus, number>> {
  const { data, error } = await supabase
    .from("racks")
    .select("status");

  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data as { status: string }[]) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts as Record<RackStatus, number>;
}

/** Zone occupancy: counts per zone in one query. */
export async function fetchZoneOccupancy(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("racks")
    .select("zone_id")
    .not("zone_id", "is", null);

  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data as { zone_id: string }[]) {
    counts[row.zone_id] = (counts[row.zone_id] ?? 0) + 1;
  }
  return counts;
}

// ════════════════════════════════════════════════════════════════════════════
// MUTATIONS — replace current Zustand store actions
// ════════════════════════════════════════════════════════════════════════════

/** Create a rack. rack_code is auto-generated by the DB sequence. */
export async function createRack(input: {
  consignerName: string;
  priority?: Priority;
  zoneId?: string;
  deliveryId: string;
  notes?: string;
}): Promise<Rack> {
  const { data, error } = await supabase
    .from("racks")
    .insert({
      consigner_name: input.consignerName,
      priority:       input.priority ?? "normal",
      zone_id:        input.zoneId   ?? null,
      delivery_id:    input.deliveryId,
      notes:          input.notes    ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return toRack(data as RackRow);
}

/**
 * Advance a rack's status.
 * Calls the advance_rack_status() Postgres function, which atomically
 * updates racks.status AND inserts a rack_events row in one transaction.
 */
export async function advanceRackStatus(
  rackId: string,
  toStatus: RackStatus
): Promise<void> {
  const { error } = await supabase.rpc("advance_rack_status", {
    p_rack_id:   rackId,
    p_to_status: toStatus,
  });

  if (error) throw error;
}

/** Move a rack to a different zone (or unassign it). */
export async function moveRackToZone(
  rackId: string,
  zoneId: string | null
): Promise<void> {
  const { error } = await supabase
    .from("racks")
    .update({ zone_id: zoneId })
    .eq("id", rackId);

  if (error) throw error;
}

/** Create a delivery. delivery_code is auto-generated by the DB sequence. */
export async function createDelivery(input: {
  type: DeliveryType;
  consignerName: string;
  expectedRackCount: number;
  scheduledDate: string;
  notes?: string;
}): Promise<Delivery> {
  const isWalkin = input.type === "walkin";
  const now      = new Date().toISOString();

  const { data, error } = await supabase
    .from("deliveries")
    .insert({
      consigner_name:       input.consignerName,
      expected_rack_count:  input.expectedRackCount,
      type:                 input.type,
      status:               isWalkin ? "arrived" : "scheduled",
      scheduled_date:       input.scheduledDate,
      arrived_at:           isWalkin ? now : null,
      notes:                input.notes ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return toDelivery(data as DeliveryRow);
}

/** Advance a delivery's status. */
export async function setDeliveryStatus(
  deliveryId: string,
  status: DeliveryStatus
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("deliveries")
    .update({
      status,
      arrived_at:   status === "arrived"  ? now : undefined,
      completed_at: status === "complete" ? now : undefined,
    })
    .eq("id", deliveryId);

  if (error) throw error;
}

/** Update a zone's label and/or capacity. */
export async function updateZone(
  id: string,
  patch: { label: string | undefined; capacity: number | undefined }
): Promise<Zone> {
  const { data, error } = await supabase
    .from("zones")
    .update({
      label:    patch.label    ?? null,
      capacity: patch.capacity ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return toZone(data as ZoneRow);
}

/**
 * Archive all completed racks for the current auction cycle.
 * Returns the number of racks archived.
 */
export async function archiveCompletedRacks(): Promise<number> {
  const { data, error } = await supabase
    .from("racks")
    .update({ is_archived: true })
    .eq("status", "completed")
    .eq("is_archived", false)
    .select("id");

  if (error) throw error;
  return (data as { id: string }[]).length;
}

/** Create a zone. */
export async function createZone(input: {
  name: string;
  label?: string;
  capacity?: number;
}): Promise<Zone> {
  const { data, error } = await supabase
    .from("zones")
    .insert({
      name:     input.name.toUpperCase().trim(),
      label:    input.label    ?? null,
      capacity: input.capacity ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return toZone(data as ZoneRow);
}
