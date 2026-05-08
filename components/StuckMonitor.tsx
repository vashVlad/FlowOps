"use client";

import { useEffect } from "react";
import { useRacksStore } from "@/store/racks";
import { useNotificationsStore } from "@/store/notifications";
import { isRackStuck } from "@/lib/timeTracking";

const CHECK_INTERVAL_MS = 30_000; // 30 seconds

export default function StuckMonitor() {
  const { racks, history } = useRacksStore();
  const { addNotification, trackKey, hasKey } = useNotificationsStore();

  function check() {
    const { racks: currentRacks, history: currentHistory } = useRacksStore.getState();
    for (const rack of currentRacks) {
      if (rack.status === "completed") continue;
      if (!isRackStuck(rack, currentHistory)) continue;

      const key = `${rack.id}:${rack.status}`;
      if (hasKey(key)) continue;

      trackKey(key);
      addNotification({
        type:     "stuck",
        message:  `${rack.rackCode} is stuck in ${rack.status}`,
        rackId:   rack.id,
        rackCode: rack.rackCode,
      });
    }
  }

  // Check whenever racks/history updates
  useEffect(() => { check(); }, [racks, history]); // eslint-disable-line react-hooks/exhaustive-deps

  // Also check on a timer in case no realtime events fire
  useEffect(() => {
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
