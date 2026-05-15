"use client";

import { useEffect } from "react";
import { useRacksStore } from "@/store/racks";
import { useNotificationsStore } from "@/store/notifications";
import { isRackNeedsAttention } from "@/lib/timeTracking";
import { STAGE_LABEL } from "@/lib/tokens";

const CHECK_INTERVAL_MS = 30_000; // 30 seconds

export default function StuckMonitor() {
  const { racks, history } = useRacksStore();
  const { addNotification, trackKey, hasKey } = useNotificationsStore();

  function check() {
    const { racks: currentRacks, history: currentHistory } = useRacksStore.getState();
    for (const rack of currentRacks) {
      if (rack.status === "completed") continue;
      if (rack.holdReason) continue;
      if (!isRackNeedsAttention(rack, currentHistory)) continue;

      const key = `${rack.id}:${rack.status}`;
      if (hasKey(key)) continue;

      trackKey(key);
      addNotification({
        type:     "needs_attention",
        message:  `${rack.rackCode} needs attention in ${STAGE_LABEL[rack.status]}`,
        rackId:   rack.id,
        rackCode: rack.rackCode,
      });
    }
  }

  useEffect(() => { check(); }, [racks, history]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
