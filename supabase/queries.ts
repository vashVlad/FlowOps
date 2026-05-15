/**
 * FlowOps V2 — Supabase Query Reference
 *
 * Pattern:
 *   1. Query Supabase
 *   2. Map DB row (snake_case) → app type (camelCase)
 *   3. Write result into Zustand store (store remains the UI cache)
 */

import { supabase } from "@/lib/supabase";
import type {
  Rack, Delivery, Zone, HistoryEvent, RackNote, DeliveryPhoto,
  RackConsigner, CreateRackConsignerInput,
  RackStatus, Priority, DeliveryStatus, DeliveryType,
  UpdateRackInput, UpdateDeliveryInput,
} from "@/types";

// ── DB row types (snake_case, nullable where Postgres allows NULL) ─────────────

export interface RackRow {
  id: string;
  rack_code: string;
  consigner_name: string;
  status: RackStatus;
  priority: Priority;
  zone_id: string | null;
  delivery_id: string;
  hold_reason: string | null;
  hold_started_at: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliveryRow {
  id: string;
  delivery_code: string;
  consigner_name: string;
  consigner_j_number: string | null;
  expected_rack_count: number;
  type: DeliveryType;
  status: DeliveryStatus;
  scheduled_date: string;
  arrived_at: string | null;
  completed_at: string | null;
  auction_date: string | null;
  donation_percent: number | null;
  trash_percent: number | null;
  created_at: string;
  updated_at: string;
}

export interface ZoneRow {
  id: string;
  name: string;
  label: string | null;
  capacity: number | null;
  delivery_id: string | null;
  reserved: boolean;
  auction_color: string | null;
  auction_date: string | null;
  created_at: string;
}

export interface RackEventRow {
  id: string;
  rack_id: string;
  from_status: RackStatus;
  to_status: RackStatus;
  created_at: string;
}

export interface RackNoteRow {
  id: string;
  rack_id: string | null;
  delivery_id: string | null;
  note: string;
  pinned: boolean;
  created_by: string | null;
  created_at: string;
}

export interface DeliveryPhotoRow {
  id: string;
  delivery_id: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
}

// ── Row → app type mappers ────────────────────────────────────────────────────

export function toRack(row: RackRow): Rack {
  return {
    id:             row.id,
    rackCode:       row.rack_code,
    consignerName:  row.consigner_name,
    status:         row.status,
    priority:       row.priority,
    zoneId:         row.zone_id         ?? undefined,
    deliveryId:     row.delivery_id,
    holdReason:     row.hold_reason     ?? undefined,
    holdStartedAt:  row.hold_started_at ?? undefined,
    isArchived:     row.is_archived,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  };
}

export function toDelivery(row: DeliveryRow): Delivery {
  return {
    id:                row.id,
    deliveryCode:      row.delivery_code,
    consignerName:     row.consigner_name,
    consignerJNumber:  row.consigner_j_number ?? undefined,
    expectedRackCount: row.expected_rack_count,
    type:              row.type,
    status:            row.status,
    scheduledDate:     row.scheduled_date,
    arrivedAt:         row.arrived_at      ?? undefined,
    completedAt:       row.completed_at    ?? undefined,
    auctionDate:       row.auction_date    ?? undefined,
    donationPercent:   row.donation_percent ?? undefined,
    trashPercent:      row.trash_percent    ?? undefined,
    createdAt:         row.created_at,
    updatedAt:         row.updated_at,
  };
}

export function toZone(row: ZoneRow): Zone {
  return {
    id:           row.id,
    name:         row.name,
    label:        row.label         ?? undefined,
    capacity:     row.capacity      ?? undefined,
    deliveryId:   row.delivery_id   ?? undefined,
    reserved:     row.reserved      ?? false,
    auctionColor: row.auction_color ?? undefined,
    auctionDate:  row.auction_date  ?? undefined,
    createdAt:    row.created_at,
  };
}

export function toHistoryEvent(row: RackEventRow): HistoryEvent {
  return {
    id:        row.id,
    rackId:    row.rack_id,
    from:      row.from_status,
    to:        row.to_status,
    timestamp: row.created_at,
  };
}

export function toRackNote(row: RackNoteRow): RackNote {
  return {
    id:          row.id,
    rackId:      row.rack_id      ?? undefined,
    deliveryId:  row.delivery_id  ?? undefined,
    note:        row.note,
    pinned:      row.pinned,
    createdBy:   row.created_by   ?? undefined,
    createdAt:   row.created_at,
  };
}

export function toDeliveryPhoto(row: DeliveryPhotoRow, url?: string): DeliveryPhoto {
  return {
    id:          row.id,
    deliveryId:  row.delivery_id,
    storagePath: row.storage_path,
    url,
    caption:     row.caption ?? undefined,
    createdAt:   row.created_at,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// READS
// ════════════════════════════════════════════════════════════════════════════

export async function fetchZones(): Promise<Zone[]> {
  const { data, error } = await supabase
    .from("zones")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data as ZoneRow[]).map(toZone);
}

export async function fetchDeliveries(): Promise<Delivery[]> {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as DeliveryRow[]).map(toDelivery);
}

export async function fetchRacks(): Promise<Rack[]> {
  const { data, error } = await supabase
    .from("racks")
    .select("*")
    .eq("is_archived", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as RackRow[]).map(toRack);
}

export async function fetchAllRackEvents(): Promise<HistoryEvent[]> {
  const { data, error } = await supabase
    .from("rack_events")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as RackEventRow[]).map(toHistoryEvent);
}

export async function fetchRacksByDelivery(deliveryId: string): Promise<Rack[]> {
  const { data, error } = await supabase
    .from("racks")
    .select("*")
    .eq("delivery_id", deliveryId)
    .order("created_at");
  if (error) throw error;
  return (data as RackRow[]).map(toRack);
}

export async function fetchRacksByZone(zoneId: string): Promise<Rack[]> {
  const { data, error } = await supabase
    .from("racks")
    .select("*")
    .eq("zone_id", zoneId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as RackRow[]).map(toRack);
}

export async function fetchRackEvents(rackId: string): Promise<HistoryEvent[]> {
  const { data, error } = await supabase
    .from("rack_events")
    .select("*")
    .eq("rack_id", rackId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as RackEventRow[]).map(toHistoryEvent);
}

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

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function fetchAllNotes(): Promise<RackNote[]> {
  const { data, error } = await supabase
    .from("rack_notes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as RackNoteRow[]).map(toRackNote);
}

export async function createNote(input: {
  note: string;
  rackId?: string;
  deliveryId?: string;
  createdBy?: string;
}): Promise<RackNote> {
  const { data, error } = await supabase
    .from("rack_notes")
    .insert({
      note:        input.note,
      rack_id:     input.rackId     ?? null,
      delivery_id: input.deliveryId ?? null,
      created_by:  input.createdBy  ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return toRackNote(data as RackNoteRow);
}

export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await supabase
    .from("rack_notes")
    .delete()
    .eq("id", noteId);
  if (error) throw error;
}

// ── Photos ────────────────────────────────────────────────────────────────────

export async function fetchPhotosByDelivery(deliveryId: string): Promise<DeliveryPhoto[]> {
  const { data, error } = await supabase
    .from("delivery_photos")
    .select("*")
    .eq("delivery_id", deliveryId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data as DeliveryPhotoRow[];
  if (rows.length === 0) return [];

  // Batch-generate signed URLs (valid for 1 hour)
  const { data: signed } = await supabase.storage
    .from("delivery-photos")
    .createSignedUrls(rows.map((r) => r.storage_path), 3600);

  const urlMap = new Map(
    (signed ?? []).map((s) => [s.path, s.signedUrl])
  );

  return rows.map((row) => toDeliveryPhoto(row, urlMap.get(row.storage_path) ?? undefined));
}

export async function uploadDeliveryPhoto(
  deliveryId: string,
  file: File,
  caption?: string
): Promise<DeliveryPhoto> {
  const ext  = file.name.split(".").pop() ?? "jpg";
  const path = `${deliveryId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("delivery-photos")
    .upload(path, file, { contentType: file.type || "image/jpeg" });

  if (uploadError) throw uploadError;

  const { data, error: insertError } = await supabase
    .from("delivery_photos")
    .insert({
      delivery_id:  deliveryId,
      storage_path: path,
      caption:      caption ?? null,
    })
    .select()
    .single();

  if (insertError) {
    // Roll back storage upload if metadata insert fails
    await supabase.storage.from("delivery-photos").remove([path]);
    throw insertError;
  }

  const { data: signed } = await supabase.storage
    .from("delivery-photos")
    .createSignedUrl(path, 3600);

  return toDeliveryPhoto(data as DeliveryPhotoRow, signed?.signedUrl ?? undefined);
}

export async function deleteDeliveryPhoto(
  photoId: string,
  storagePath: string
): Promise<void> {
  const { error: dbError } = await supabase
    .from("delivery_photos")
    .delete()
    .eq("id", photoId);
  if (dbError) throw dbError;

  // Best-effort storage cleanup — don't throw if it fails
  await supabase.storage.from("delivery-photos").remove([storagePath]);
}

// ════════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ════════════════════════════════════════════════════════════════════════════

export async function createRack(input: {
  consignerName: string;
  status?: RackStatus;
  priority?: Priority;
  zoneId?: string;
  deliveryId: string;
  rackCode?: string;
  holdReason?: string;
  holdStartedAt?: string;
}): Promise<Rack> {
  const insertData: Record<string, unknown> = {
    consigner_name:  input.consignerName,
    zone_id:         input.zoneId        ?? null,
    delivery_id:     input.deliveryId,
    hold_reason:     input.holdReason    ?? null,
    hold_started_at: input.holdStartedAt ?? null,
  };
  if (input.status)           insertData.status    = input.status;
  if (input.priority)         insertData.priority  = input.priority;
  if (input.rackCode?.trim()) insertData.rack_code = input.rackCode.trim();

  const { data, error } = await supabase
    .from("racks")
    .insert(insertData)
    .select()
    .single();
  if (error) throw error;
  return toRack(data as RackRow);
}

export async function updateRack(rackId: string, patch: UpdateRackInput): Promise<Rack> {
  const update: Record<string, unknown> = {};
  if (patch.rackCode      !== undefined) update.rack_code       = patch.rackCode;
  if (patch.priority      !== undefined) update.priority        = patch.priority;
  if ("holdReason"    in patch)          update.hold_reason     = patch.holdReason     ?? null;
  if ("holdStartedAt" in patch)          update.hold_started_at = patch.holdStartedAt  ?? null;

  const { data, error } = await supabase
    .from("racks")
    .update(update)
    .eq("id", rackId)
    .select()
    .single();
  if (error) throw error;
  return toRack(data as RackRow);
}

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

export async function createDelivery(input: {
  type: DeliveryType;
  consignerName: string;
  consignerJNumber?: string;
  scheduledDate: string;
  auctionDate?: string;
}): Promise<Delivery> {
  const isWalkin = input.type === "walkin";
  const now      = new Date().toISOString();

  const { data, error } = await supabase
    .from("deliveries")
    .insert({
      consigner_name:      input.consignerName,
      consigner_j_number:  input.consignerJNumber?.trim() || null,
      expected_rack_count: 0,
      type:                input.type,
      status:              isWalkin ? "arrived" : "scheduled",
      scheduled_date:      input.scheduledDate,
      arrived_at:          isWalkin ? now : null,
      auction_date:        input.auctionDate ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return toDelivery(data as DeliveryRow);
}

export async function updateDelivery(deliveryId: string, patch: UpdateDeliveryInput): Promise<Delivery> {
  const update: Record<string, unknown> = {};
  if ("consignerName"    in patch) update.consigner_name     = patch.consignerName;
  if ("consignerJNumber" in patch) update.consigner_j_number = patch.consignerJNumber ?? null;
  if ("auctionDate"      in patch) update.auction_date       = patch.auctionDate      ?? null;
  if ("donationPercent"  in patch) update.donation_percent   = patch.donationPercent  ?? null;
  if ("trashPercent"     in patch) update.trash_percent      = patch.trashPercent     ?? null;

  const { data, error } = await supabase
    .from("deliveries")
    .update(update)
    .eq("id", deliveryId)
    .select()
    .single();
  if (error) throw error;
  return toDelivery(data as DeliveryRow);
}

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

export async function updateZone(
  id: string,
  patch: {
    label?: string;
    capacity?: number;
    deliveryId?: string | null;
    reserved?: boolean;
    auctionColor?: string | null;
    auctionDate?: string | null;
  }
): Promise<Zone> {
  const update: Record<string, unknown> = {};
  if ("label"        in patch) update.label         = patch.label         ?? null;
  if ("capacity"     in patch) update.capacity      = patch.capacity      ?? null;
  if ("deliveryId"   in patch) update.delivery_id   = patch.deliveryId    ?? null;
  if ("reserved"     in patch) update.reserved      = patch.reserved;
  if ("auctionColor" in patch) update.auction_color = patch.auctionColor  ?? null;
  if ("auctionDate"  in patch) update.auction_date  = patch.auctionDate   ?? null;
  const { data, error } = await supabase
    .from("zones")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return toZone(data as ZoneRow);
}

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

export async function deleteRack(rackId: string): Promise<void> {
  const { data, error } = await supabase
    .from("racks")
    .delete()
    .eq("id", rackId)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Delete failed — row not found or access denied");
}

export async function deleteDelivery(deliveryId: string): Promise<void> {
  const { data, error } = await supabase
    .from("deliveries")
    .delete()
    .eq("id", deliveryId)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Delete failed — row not found or access denied");
}

// ── Rack Consigners ───────────────────────────────────────────────────────────

interface RackConsignerRow {
  id: string;
  rack_id: string;
  consigner_name: string;
  j_number: string | null;
  created_at: string;
}

function toRackConsigner(row: RackConsignerRow): RackConsigner {
  return {
    id:            row.id,
    rackId:        row.rack_id,
    consignerName: row.consigner_name,
    jNumber:       row.j_number ?? undefined,
    createdAt:     row.created_at,
  };
}

export async function fetchAllRackConsigners(): Promise<RackConsigner[]> {
  const { data, error } = await supabase
    .from("rack_consigners")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return (data as RackConsignerRow[]).map(toRackConsigner);
}

export async function createRackConsigner(input: CreateRackConsignerInput): Promise<RackConsigner> {
  const { data, error } = await supabase
    .from("rack_consigners")
    .insert({
      rack_id:        input.rackId,
      consigner_name: input.consignerName.trim(),
      j_number:       input.jNumber?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return toRackConsigner(data as RackConsignerRow);
}

export async function deleteRackConsigner(id: string): Promise<void> {
  const { error } = await supabase
    .from("rack_consigners")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

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
