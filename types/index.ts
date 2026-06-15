// ── Rack ────────────────────────────────────────────────────────────────────

export type RackStatus =
  | "unpacking_sorting"
  | "sorted"
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
  holdReason?: string;     // set when rack is on hold
  holdStartedAt?: string;  // ISO 8601 — when hold was placed
  auctionColor?: string;   // hex color — auction run identifier
  auctionDate?: string;    // YYYY-MM-DD — auction date for this rack
  puPosition?: string;     // slot id within the PU floor plan (e.g. "r3-2")
  createdAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601
}

export interface CreateRackInput {
  consignerName: string;
  status?: RackStatus;
  priority?: Priority; // only relevant when status is "sorted" at creation
  zoneId?: string;
  deliveryId?: string; // optional: sorted racks created without a delivery
  rackCode?: string; // optional manual override; auto-generated if omitted
  holdReason?: string;
  holdStartedAt?: string;
  auctionColor?: string;
}

export interface UpdateRackInput {
  rackCode?: string;
  priority?: Priority;
  deliveryId?: string;
  holdReason?: string | null;
  holdStartedAt?: string | null;
  auctionColor?: string | null;
  auctionDate?: string | null;
  puPosition?: string | null;
}

// ── History ──────────────────────────────────────────────────────────────────

export interface HistoryEvent {
  id: string;
  rackId: string;
  from: RackStatus;
  to: RackStatus;
  timestamp: string;    // ISO 8601
  performedBy?: string; // email of the user who triggered the transition
}

// ── Delivery ─────────────────────────────────────────────────────────────────

export type DeliveryStatus = "scheduled" | "arrived" | "processing" | "complete";

// "walkin"    — unscheduled, truck just showed up; starts as arrived
// "scheduled" — pre-registered with expected count and date
export type DeliveryType = "scheduled" | "walkin";

export interface Delivery {
  id: string;
  deliveryCode: string;
  consignerName: string;
  consignerJNumber?: string; // optional warehouse J-Number
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
  auctionDate?: string | null;
  donationPercent?: number | null;
  trashPercent?: number | null;
}

// ── Dumpsters ────────────────────────────────────────────────────────────────
// Two physical dumpsters (Gallery, Warehouse). Fill level is built up from
// "add" entries linked to deliveries — each entry's percent also becomes that
// delivery's trashPercent (read-only on the delivery page).

export interface Dumpster {
  id: string;
  name: string;        // "Gallery" | "Warehouse"
  fillPercent: number; // 0–100 current fill level
  arrivedAt: string;   // YYYY-MM-DD — when the current dumpster was placed
  updatedAt: string;
}

export type DumpsterEntryType = "add" | "swap";

export interface DumpsterEntry {
  id: string;
  dumpsterId: string;
  type: DumpsterEntryType;
  percent: number;          // amount added (add) or final level archived (swap)
  deliveryId?: string;
  consignerName?: string;   // denormalized from the linked delivery
  deliveryCode?: string;
  consignerJNumber?: string;
  createdBy?: string;
  createdAt: string;
}

export interface AddDumpsterEntryInput {
  dumpsterId: string;
  deliveryId?: string; // omitted = operational/general use, not tied to a delivery
  percent: number;
}

// ── Zone ─────────────────────────────────────────────────────────────────────

export interface Zone {
  id: string;
  name: string;          // short floor code: "A1", "B2", "OVF"
  label?: string;        // human description or assigned consigner J-number
  deliveryId?: string;   // delivery currently assigned to this zone
  reserved:      boolean; // true = zone is held but no delivery assigned yet
  auctionColor?: string;  // hex color — when set, shows a color dot on the cell
  auctionDate?:  string;  // YYYY-MM-DD — shown on auction cells without a linked delivery
  createdAt: string;
}

export interface CreateZoneInput {
  name: string;
  label?: string;
}

export interface CreateDeliveryInput {
  type: DeliveryType;
  consignerName: string;
  consignerJNumber?: string;
  scheduledDate?: string; // optional for walk-ins (defaults to today)
  auctionDate?: string;   // YYYY-MM-DD — auction cycle deadline
}

// ── Rack Consigners ──────────────────────────────────────────────────────────

export interface RackConsigner {
  id: string;
  rackId?: string;
  consignerName: string;
  jNumber?: string;
  createdAt: string;
}

export interface CreateRackConsignerInput {
  rackId?: string;
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
