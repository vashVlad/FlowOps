import type { RackStatus } from "@/types";
import { STAGE_BADGE, STAGE_LABEL } from "@/lib/tokens";

export default function StatusBadge({ status }: { status: RackStatus }) {
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STAGE_BADGE[status]}`}>
      {STAGE_LABEL[status]}
    </span>
  );
}
