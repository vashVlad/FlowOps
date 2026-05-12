// ── Rack ────────────────────────────────────────────────────────────────────

export type RackStatus =
  | "intake"
  | "unpacking"
  | "sorting"
  | "lotting"
  | "ready"
  | "pickup"
  | "completed";

export type Priority = "high" | "normal" | "low";

export interface Rack {
  id: string;
  rackCode: string;
  consignerName: string;
  status: RackStatus;
  priority: Priority;
  zoneId?: string;         // physical location on the warehouse floor
  deliveryId: string;
  notes?: string;
  holdReason?: string;     // set when rack is on hold
  holdStartedAt?: string;  // ISO 8601 — when hold was placed
  isArchived: boolean;
  createdAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601
}

export interface CreateRackInput {
  consignerName: string;
  priority?: Priority;
  zoneId?: string;
  deliveryId: string;
  rackCode?: string; // optional manual override; auto-generated if omitted
}

export interface UpdateRackInput {
  rackCode?: string;
  priority?: Priority;
  holdReason?: string | null;
  holdStartedAt?: string | null;
}

// ── History ──────────────────────────────────────────────────────────────────

export interface HistoryEvent {
  id: string;
  rackId: string;
  from: RackStatus;
  to: RackStatus;
  timestamp: string; // ISO 8601
}

// ── Delivery ─────────────────────────────────────────────────────────────────

export type DeliveryStatus = "scheduled" | "arrived" | "processing" | "unpacking_complete" | "complete";

// "walkin"    — unscheduled, truck just showed up; starts as arrived
// "scheduled" — pre-registered with expected count and date
export type DeliveryType = "scheduled" | "walkin";

export interface Delivery {
  id: string;
  deliveryCode: string;
  consignerName: string;
  consignerJNumber?: string; // optional warehouse J-Number
  zoneId?: string;           // receiving zone
  expectedRackCount: number; // 0 = unknown (common for walk-ins)
  type: DeliveryType;
  status: DeliveryStatus;
  scheduledDate: string; // YYYY-MM-DD (today for walk-ins)
  arrivedAt?: string;    // ISO 8601
  completedAt?: string;  // ISO 8601
  auctionDate?: string;  // YYYY-MM-DD — auction cycle deadline
  donationPercent?: number; // 0–100 — % of delivery routed to donation
  trashPercent?: number;    // 0–100 — % disposed (dumpster charge)
  createdAt: string;     // ISO 8601
  updatedAt: string;     // ISO 8601
}

export interface UpdateDeliveryInput {
  consignerName?: string;
  consignerJNumber?: string | null;
  zoneId?: string | null;
  expectedRackCount?: number;
  auctionDate?: string | null;
  donationPercent?: number | null;
  trashPercent?: number | null;
}

// ── Zone ─────────────────────────────────────────────────────────────────────

export interface Zone {
  id: string;
  name: string;      // short floor code: "A1", "B2", "OVF"
  label?: string;    // human description: "Receiving dock"
  capacity?: number; // max racks before warning; undefined = unlimited
  createdAt: string;
}

export interface CreateZoneInput {
  name: string;
  label?: string;
  capacity?: number;
}

export type OccupancyStatus = "ok" | "near" | "full";

export interface CreateDeliveryInput {
  type: DeliveryType;
  consignerName: string;
  consignerJNumber?: string;
  zoneId?: string;
  expectedRackCount: number;
  scheduledDate?: string; // optional for walk-ins (defaults to today)
  auctionDate?: string;   // YYYY-MM-DD — auction cycle deadline
}

// ── Rack Consigners ──────────────────────────────────────────────────────────

export interface RackConsigner {
  id: string;
  rackId: string;
  consignerName: string;
  jNumber?: string;
  createdAt: string;
}

export interface CreateRackConsignerInput {
  rackId: string;
  consignerName: string;
  jNumber?: string;
}

// ── Rack Notes ───────────────────────────────────────────────────────────────

export interface RackNote {
  id: string;
  rackId?: string;
  deliveryId?: string;
  note: string;
  pinned: boolean;
  createdBy?: string;
  createdAt: string; // ISO 8601
}

// ── Delivery Photos ───────────────────────────────────────────────────────────

export interface DeliveryPhoto {
  id: string;
  deliveryId: string;
  storagePath: string;
  url?: string;     // signed URL (1h expiry) or public URL
  caption?: string;
  createdAt: string; // ISO 8601
}
