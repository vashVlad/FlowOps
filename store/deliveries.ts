import { create } from "zustand";
import type { Delivery, DeliveryStatus, CreateDeliveryInput } from "@/types";
import { ok, err, logMutationError, type MutationResult } from "@/lib/store";
import { today } from "@/lib/utils";
import {
  fetchDeliveries,
  createDelivery as dbCreate,
  setDeliveryStatus,
  deleteDelivery as dbDelete,
} from "@/supabase/queries";

interface DeliveriesStore {
  deliveries: Delivery[];
  loading:    boolean;
  error:      string | null;
  hydrate:        () => Promise<void>;
  addDelivery:    (input: CreateDeliveryInput) => Promise<MutationResult<Delivery>>;
  setStatus:      (id: string, status: DeliveryStatus) => Promise<MutationResult<undefined>>;
  deleteDelivery: (id: string) => Promise<MutationResult<undefined>>;
  // ── Subscription callbacks (realtime — do not call directly) ──────────────
  upsertDelivery: (delivery: Delivery) => void;  // INSERT / UPDATE
  removeDelivery: (id: string) => void;          // DELETE
}

// ── Standard store shape ──────────────────────────────────────────────────────
// State:    entity array + loading boolean + error string | null
// hydrate:  reset error → set loading → fetch → clear loading on success/failure
// Mutations: reset error → DB write first → local update on success → MutationResult<T>

export const useDeliveriesStore = create<DeliveriesStore>()((set) => ({
  deliveries: [],
  loading:    false,
  error:      null,

  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const deliveries = await fetchDeliveries();
      set({ deliveries, loading: false });
    } catch (e) {
      set({ loading: false, error: logMutationError("hydrate:deliveries", e) });
    }
  },

  addDelivery: async (input) => {
    set({ error: null });
    try {
      const delivery = await dbCreate({
        ...input,
        scheduledDate: input.scheduledDate ?? today(),
      });
      set((state) => ({ deliveries: [...state.deliveries, delivery] }));
      return ok(delivery);
    } catch (e) {
      const message = logMutationError("addDelivery", e);
      set({ error: message });
      return err(message);
    }
  },

  setStatus: async (id, status) => {
    set({ error: null });
    try {
      await setDeliveryStatus(id, status);
      const now = new Date().toISOString();
      set((state) => ({
        deliveries: state.deliveries.map((d) => {
          if (d.id !== id) return d;
          return {
            ...d,
            status,
            arrivedAt:   status === "arrived"  ? now : d.arrivedAt,
            completedAt: status === "complete" ? now : d.completedAt,
            updatedAt:   now,
          };
        }),
      }));
      return ok(undefined);
    } catch (e) {
      const message = logMutationError("setStatus:delivery", e);
      set({ error: message });
      return err(message);
    }
  },

  deleteDelivery: async (id) => {
    set({ error: null });
    try {
      await dbDelete(id);
      set((state) => ({ deliveries: state.deliveries.filter((d) => d.id !== id) }));
      return ok(undefined);
    } catch (e) {
      const message = logMutationError("deleteDelivery", e);
      set({ error: message });
      return err(message);
    }
  },

  upsertDelivery: (delivery) => {
    set((state) => {
      const exists = state.deliveries.some((d) => d.id === delivery.id);
      return {
        deliveries: exists
          ? state.deliveries.map((d) => (d.id === delivery.id ? delivery : d))
          : [...state.deliveries, delivery],
      };
    });
  },

  removeDelivery: (id) => {
    set((state) => ({ deliveries: state.deliveries.filter((d) => d.id !== id) }));
  },
}));
