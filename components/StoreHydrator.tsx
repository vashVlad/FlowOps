"use client";

import { useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { useZonesStore } from "@/store/zones";
import { useDeliveriesStore } from "@/store/deliveries";
import { useRacksStore } from "@/store/racks";
import { useNotesStore } from "@/store/notes";
import { useConnectionStore } from "@/store/connection";
import {
  toRack,
  toDelivery,
  toZone,
  toHistoryEvent,
  toRackNote,
  type RackRow,
  type DeliveryRow,
  type ZoneRow,
  type RackEventRow,
  type RackNoteRow,
} from "@/supabase/queries";

// ── Subscription ordering constraint ─────────────────────────────────────────
// Subscriptions start only after all hydrations complete. hydrate() does a full
// array replace — any INSERT fired during hydration would be overwritten.

export default function StoreHydrator() {
  const hydrateZones      = useZonesStore((s) => s.hydrate);
  const hydrateDeliveries = useDeliveriesStore((s) => s.hydrate);
  const hydrateRacks      = useRacksStore((s) => s.hydrate);
  const hydrateNotes      = useNotesStore((s) => s.hydrate);
  const setConnStatus     = useConnectionStore((s) => s.setStatus);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    Promise.all([hydrateZones(), hydrateDeliveries(), hydrateRacks(), hydrateNotes()])
      .then(() => {
        if (cancelled) return;

        const supabaseConfigured =
          !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
          !!(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
        if (!supabaseConfigured) return;

        try {
          channel = getSupabase()
            .channel("flowops-realtime")

            .on("postgres_changes", { event: "*", schema: "public", table: "zones" }, (payload) => {
              if (payload.eventType === "DELETE") {
                useZonesStore.getState().removeZone((payload.old as { id: string }).id);
              } else {
                useZonesStore.getState().upsertZone(toZone(payload.new as ZoneRow));
              }
            })

            .on("postgres_changes", { event: "*", schema: "public", table: "racks" }, (payload) => {
              if (payload.eventType === "DELETE") {
                useRacksStore.getState().removeRack((payload.old as { id: string }).id);
              } else {
                useRacksStore.getState().upsertRack(toRack(payload.new as RackRow));
              }
            })

            .on("postgres_changes", { event: "*", schema: "public", table: "rack_events" }, (payload) => {
              if (payload.eventType === "DELETE") {
                useRacksStore.getState().removeEvent((payload.old as { id: string }).id);
              } else {
                useRacksStore.getState().upsertEvent(toHistoryEvent(payload.new as RackEventRow));
              }
            })

            .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, (payload) => {
              if (payload.eventType === "DELETE") {
                useDeliveriesStore.getState().removeDelivery((payload.old as { id: string }).id);
              } else {
                useDeliveriesStore.getState().upsertDelivery(toDelivery(payload.new as DeliveryRow));
              }
            })

            .on("postgres_changes", { event: "*", schema: "public", table: "rack_notes" }, (payload) => {
              if (payload.eventType === "DELETE") {
                useNotesStore.getState().removeNote((payload.old as { id: string }).id);
              } else {
                useNotesStore.getState().upsertNote(toRackNote(payload.new as RackNoteRow));
              }
            })

            .subscribe((status) => {
              if (status === "SUBSCRIBED")                              setConnStatus("connected");
              else if (status === "TIMED_OUT" || status === "CLOSED")  setConnStatus("disconnected");
              else                                                       setConnStatus("connecting");
            });

        } catch (e) {
          setConnStatus("disconnected");
          if (process.env.NODE_ENV !== "production") {
            console.warn("[FlowOps] Realtime subscription failed to start:", e);
          }
        }
      });

    return () => {
      cancelled = true;
      if (channel) {
        try { getSupabase().removeChannel(channel); } catch { /* already torn down */ }
      }
    };
  }, [hydrateZones, hydrateDeliveries, hydrateRacks, hydrateNotes, setConnStatus]);

  return null;
}
