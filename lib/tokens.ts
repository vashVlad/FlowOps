import type { RackStatus, Priority, OccupancyStatus } from "@/types";

// ── Stage colors ──────────────────────────────────────────────────────────────

export const STAGE_DOT: Record<RackStatus, string> = {
  unpacking_sorting: "bg-sky-400",
  sorted:            "bg-teal-400",
  lotting:           "bg-amber-400",
  ready:             "bg-emerald-400",
  pickup:            "bg-violet-400",
  completed:         "bg-stone-300",
};

export const STAGE_BAR: Record<RackStatus, string> = {
  unpacking_sorting: "bg-sky-400",
  sorted:            "bg-teal-400",
  lotting:           "bg-amber-400",
  ready:             "bg-emerald-400",
  pickup:            "bg-violet-400",
  completed:         "bg-stone-300",
};

export const STAGE_BADGE: Record<RackStatus, string> = {
  unpacking_sorting: "bg-sky-100 text-sky-700",
  sorted:            "bg-teal-100 text-teal-700",
  lotting:           "bg-amber-100 text-amber-700",
  ready:             "bg-emerald-100 text-emerald-700",
  pickup:            "bg-violet-100 text-violet-700",
  completed:         "bg-stone-100 text-stone-400",
};

export const STAGE_LABEL: Record<RackStatus, string> = {
  unpacking_sorting: "Unpacking & Sorting",
  sorted:            "Sorted",
  lotting:           "Lotting",
  ready:             "Ready",
  pickup:            "Pickup",
  completed:         "Completed",
};

export const STAGE_SHORT_LABEL: Record<RackStatus, string> = {
  unpacking_sorting: "Prep",
  sorted:            "Sorted",
  lotting:           "Lotting",
  ready:             "Ready",
  pickup:            "Pickup",
  completed:         "Completed",
};

export const PIPELINE_STAGES: { status: RackStatus; label: string }[] = [
  { status: "unpacking_sorting", label: "Unpacking & Sorting" },
  { status: "sorted",            label: "Sorted"              },
  { status: "lotting",           label: "Lotting"             },
  { status: "ready",             label: "Ready"               },
  { status: "pickup",            label: "Pickup"              },
];

export const NEXT_STAGE_LABEL: Partial<Record<RackStatus, string>> = {
  unpacking_sorting: "Sorted",
  sorted:            "Lotting",
  lotting:           "Ready",
  ready:             "Pickup",
  pickup:            "Complete",
};

// ── Priority / urgency ────────────────────────────────────────────────────────

export const PRIORITY_BORDER: Record<Priority | "needs_attention", string> = {
  needs_attention: "border-l-4 border-l-red-500",
  high:            "border-l-4 border-l-amber-400",
  normal:          "border-l-4 border-l-orange-300",
  low:             "border-l-4 border-l-stone-200",
};

// ── KPI accent left-borders ───────────────────────────────────────────────────

export const KPI_ACCENT: Record<string, string> = {
  orange:  "border-l-orange-500",
  stone:   "border-l-stone-400",
  amber:   "border-l-amber-400",
  violet:  "border-l-violet-500",
  red:     "border-l-red-500",
  emerald: "border-l-emerald-500",
};

// ── Zone occupancy ────────────────────────────────────────────────────────────

// ── Delivery status ───────────────────────────────────────────────────────────

import type { DeliveryStatus } from "@/types";

export const DELIVERY_STATUS_BADGE: Record<DeliveryStatus, string> = {
  scheduled:  "bg-stone-100 text-stone-600",
  arrived:    "bg-sky-100 text-sky-700",
  processing: "bg-orange-100 text-orange-700",
  complete:   "bg-emerald-100 text-emerald-700",
};

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  scheduled:  "Scheduled",
  arrived:    "Arrived",
  processing: "Processing",
  complete:   "Complete",
};

export const DELIVERY_STATUS_BORDER: Record<DeliveryStatus, string> = {
  scheduled:  "border-l-4 border-l-amber-400",
  arrived:    "border-l-4 border-l-sky-400",
  processing: "border-l-4 border-l-orange-500",
  complete:   "border-l-4 border-l-stone-200",
};

export const DELIVERY_NEXT_LABEL: Record<DeliveryStatus, string> = {
  scheduled:  "Mark arrived",
  arrived:    "Start processing",
  processing: "Mark complete",
  complete:   "",
};

export const DELIVERY_NEXT_BTN: Record<DeliveryStatus, string> = {
  scheduled:  "bg-amber-500 hover:bg-amber-600 text-white transition-colors",
  arrived:    "bg-sky-600 hover:bg-sky-700 text-white transition-colors",
  processing: "bg-emerald-600 hover:bg-emerald-700 text-white transition-colors",
  complete:   "",
};

// ── Notification types ────────────────────────────────────────────────────────

export const NOTIFICATION_DOT: Record<string, string> = {
  needs_attention: "bg-red-500 animate-pulse",
  bottleneck:      "bg-amber-400",
};

// ── Zone occupancy ────────────────────────────────────────────────────────────

export const OCCUPANCY_BADGE: Record<string, string> = {
  ok:   "",
  near: "bg-amber-100 text-amber-700",
  full: "bg-red-100 text-red-600",
};

export const OCCUPANCY_LABEL: Record<string, string> = {
  ok:   "",
  near: "Near capacity",
  full: "Full",
};

export const OCCUPANCY_STYLE: Record<OccupancyStatus | "none", {
  border: string;
  bg:     string;
  name:   string;
  bar:    string;
  dot:    string;
}> = {
  ok:   { border: "border-emerald-200", bg: "bg-emerald-50", name: "text-emerald-700", bar: "bg-emerald-400", dot: "bg-emerald-400" },
  near: { border: "border-amber-300",   bg: "bg-amber-50",   name: "text-amber-700",   bar: "bg-amber-400",   dot: "bg-amber-400"   },
  full: { border: "border-red-300",     bg: "bg-red-50",     name: "text-red-700",     bar: "bg-red-500",     dot: "bg-red-400"     },
  none: { border: "border-stone-200",   bg: "bg-stone-50",   name: "text-stone-700",   bar: "bg-stone-300",   dot: "bg-stone-300"   },
};
