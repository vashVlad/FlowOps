"use client";

import { useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { useZonesStore } from "@/store/zones";
import { useDeliveriesStore } from "@/store/deliveries";
import { useRacksStore } from "@/store/racks";
import { useNotesStore } from "@/store/notes";
import {
  toRack,
  toDelivery,
  toZone,
  toHistoryEvent,
  type RackRow,
  type DeliveryRow,
  type ZoneRow,
  type RackEventRow,
} from "@/supabase/queries";

// ── Subscription ordering constraint ─────────────────────────────────────────
// Subscriptions attach inside the .then() below — only after all three
// hydrations complete. hydrate() uses set({ racks }) which replaces the full
// array; any subscription INSERT fired during hydration would be overwritten.
// Never start subscriptions before the Promise.all resolves.

export default function StoreHydrator() {
  const hydrateZones      = useZonesStore((s) => s.hydrate);
  const hydrateDeliveries = useDeliveriesStore((s) => s.hydrate);
  const hydrateRacks      = useRacksStore((s) => s.hydrate);
  const hydrateNotes      = useNotesStore((s) => s.hydrate);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let cancelled = false; // guard: component may unmount before hydration finishes

    Promise.all([hydrateZones(), hydrateDeliveries(), hydrateRacks(), hydrateNotes()])
      .then(() => {
        if (cancelled) return;

        // Skip subscriptions when Supabase isn't configured (local dev without DB)
        const supabaseConfigured =
          !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
          !!(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
        if (!supabaseConfigured) return;

        try {
          channel = getSupabase()
            .channel("flowops-realtime")

          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "zones" },
            (payload) => {
              if (payload.eventType === "DELETE") {
                useZonesStore.getState().removeZone(
                  (payload.old as { id: string }).id
                );
              } else {
                useZonesStore.getState().upsertZone(
                  toZone(payload.new as ZoneRow)
                );
              }
            }
          )

          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "racks" },
            (payload) => {
              if (payload.eventType === "DELETE") {
                useRacksStore.getState().removeRack(
                  (payload.old as { id: string }).id
                );
              } else {
                useRacksStore.getState().upsertRack(
                  toRack(payload.new as RackRow)
                );
              }
            }
          )

          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "rack_events" },
            (payload) => {
              if (payload.eventType === "DELETE") {
                useRacksStore.getState().removeEvent(
                  (payload.old as { id: string }).id
                );
              } else {
                useRacksStore.getState().upsertEvent(
                  toHistoryEvent(payload.new as RackEventRow)
                );
              }
            }
          )

          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "deliveries" },
            (payload) => {
              if (payload.eventType === "DELETE") {
                useDeliveriesStore.getState().removeDelivery(
                  (payload.old as { id: string }).id
                );
              } else {
                useDeliveriesStore.getState().upsertDelivery(
                  toDelivery(payload.new as DeliveryRow)
                );
              }
            }
          )

            .subscribe();
        } catch (e) {
          // Log but don't crash — app functions without realtime
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
  }, [hydrateZones, hydrateDeliveries, hydrateRacks, hydrateNotes]);

  return null;
}
