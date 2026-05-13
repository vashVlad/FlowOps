import { create } from "zustand";
import type { Zone, CreateZoneInput } from "@/types";
import { ok, err, logMutationError, type MutationResult } from "@/lib/store";
import {
  fetchZones,
  createZone as dbCreateZone,
  updateZone as dbUpdateZone,
} from "@/supabase/queries";

export interface ZonePatch {
  label?:      string;
  capacity?:   number;
  deliveryId?: string | null;
}

interface ZonesStore {
  zones:   Zone[];
  loading: boolean;
  error:   string | null;
  hydrate:    () => Promise<void>;
  addZone:    (input: CreateZoneInput) => Promise<MutationResult<Zone>>;
  updateZone: (id: string, patch: ZonePatch) => Promise<MutationResult<undefined>>;
  // ── Subscription callbacks (realtime — do not call directly) ──────────────
  upsertZone: (zone: Zone) => void;   // INSERT / UPDATE
  removeZone: (id: string) => void;   // DELETE
}

// ── Standard store shape ──────────────────────────────────────────────────────
// State:    entity array + loading boolean + error string | null
// hydrate:  reset error → set loading → fetch → clear loading on success/failure
// Mutations: reset error → DB write first → local update on success → MutationResult<T>

export const useZonesStore = create<ZonesStore>()((set) => ({
  zones:   [],
  loading: false,
  error:   null,

  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const zones = await fetchZones();
      set({ zones, loading: false });
    } catch (e) {
      set({ loading: false, error: logMutationError("hydrate:zones", e) });
    }
  },

  addZone: async (input) => {
    set({ error: null });
    try {
      const zone = await dbCreateZone(input);
      set((state) => ({ zones: [...state.zones, zone] }));
      return ok(zone);
    } catch (e) {
      const message = logMutationError("addZone", e);
      set({ error: message });
      return err(message);
    }
  },

  updateZone: async (id, patch) => {
    set({ error: null });
    try {
      const updated = await dbUpdateZone(id, patch);
      set((state) => ({
        zones: state.zones.map((z) => (z.id === id ? updated : z)),
      }));
      return ok(undefined);
    } catch (e) {
      const message = logMutationError("updateZone", e);
      set({ error: message });
      return err(message);
    }
  },

  upsertZone: (zone) => {
    set((state) => {
      const exists = state.zones.some((z) => z.id === zone.id);
      return {
        zones: exists
          ? state.zones.map((z) => (z.id === zone.id ? zone : z))
          : [...state.zones, zone],
      };
    });
  },

  removeZone: (id) => {
    set((state) => ({ zones: state.zones.filter((z) => z.id !== id) }));
  },
}));
