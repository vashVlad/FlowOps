import type { DeliveryStatus } from "@/types";
import { DELIVERY_STATUS_BADGE, DELIVERY_STATUS_LABEL } from "@/lib/tokens";

export default function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${DELIVERY_STATUS_BADGE[status]}`}>
      {DELIVERY_STATUS_LABEL[status]}
    </span>
  );
}
