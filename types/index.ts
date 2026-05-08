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
  zoneId?: string;   // physical location on the warehouse floor
  deliveryId: string;
  notes?: string;
  isArchived: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface CreateRackInput {
  consignerName: string;
  priority?: Priority;
  zoneId?: string;
  deliveryId: string;
  notes?: string;
  rackCode?: string; // optional manual override; auto-generated if omitted
}

export interface UpdateRackInput {
  rackCode?: string;
  priority?: Priority;
  notes?: string | null;
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

export type DeliveryStatus = "scheduled" | "arrived" | "processing" | "complete";

// "walkin"   — unscheduled, truck just showed up; starts as arrived
// "scheduled" — pre-registered with expected count and date
export type DeliveryType = "scheduled" | "walkin";

export interface Delivery {
  id: string;
  deliveryCode: string;
  consignerName: string;
  consignerJNumber?: string; // optional warehouse J-Number
  expectedRackCount: number; // 0 = unknown (common for walk-ins)
  type: DeliveryType;
  status: DeliveryStatus;
  scheduledDate: string; // YYYY-MM-DD (today for walk-ins)
  arrivedAt?: string;    // ISO 8601
  completedAt?: string;  // ISO 8601
  notes?: string;
  createdAt: string;     // ISO 8601
  updatedAt: string;     // ISO 8601
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
  expectedRackCount: number;
  scheduledDate?: string; // optional for walk-ins (defaults to today)
  notes?: string;
}
