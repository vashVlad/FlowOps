import type { RackStatus } from "@/types";

export const STATUS_ORDER: RackStatus[] = [
  "intake",
  "unpacking",
  "sorting",
  "lotting",
  "ready",
  "pickup",
  "completed",
];

export function getNextStatus(current: RackStatus): RackStatus | null {
  const idx = STATUS_ORDER.indexOf(current);
  return idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;
}

export const HOLD_REASONS = [
  "Waiting on remaining boxes",
  "Awaiting director review",
  "Donation/sell decision",
  "Mixed inventory",
  "Space issue",
  "Pickup blocked",
  "Other",
] as const;
