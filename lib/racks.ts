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
