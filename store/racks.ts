import { create } from "zustand";
import type { Rack, RackStatus, Priority, HistoryEvent, CreateRackInput, UpdateRackInput } from "@/types";
import { ok, err, logMutationError, type MutationResult } from "@/lib/store";
import { STATUS_ORDER, getNextStatus, getPrevStatus } from "@/lib/racks";
import { useDeliveriesStore } from "@/store/deliveries";
import { useZonesStore } from "@/store/zones";
import {
  fetchRacks,
  fetchAllRackEvents,
  createRack as dbCreate,
  updateRack as dbUpdate,
  deleteRack as dbDelete,
  advanceRackStatus as dbAdvance,
  moveRackToZone as dbMoveToZone,
  archiveCompletedRacks as dbArchiveCompleted,
} from "@/supabase/queries";

interface RacksStore {
  racks:   Rack[];
  history: HistoryEvent[];
  loading: boolean;
  error:   string | null;
  hydrate:            () => Promise<void>;
  addRack:            (input: CreateRackInput) => Promise<MutationResult<Rack>>;
  updateRack:         (id: string, patch: UpdateRackInput) => Promise<MutationResult<Rack>>;
  deleteRack:         (id: string) => Promise<MutationResult<undefined>>;
  advanceStatus:      (id: string) => Promise<MutationResult<undefined>>;
  revertStatus:       (id: string) => Promise<MutationResult<undefined>>;
  advanceToSorted:    (id: string, priority: Priority) => Promise<MutationResult<undefined>>;
  moveToZone:         (rackId: string, zoneId: string | undefined) => Promise<MutationResult<undefined>>;
  closeAuctionCycle:  () => Promise<MutationResult<number>>;
  setHold:            (id: string, reason: string) => Promise<MutationResult<Rack>>;
  clearHold:          (id: string) => Promise<MutationResult<Rack>>;
  // ── Subscription callbacks (realtime — do not call directly) ──────────────
  upsertRack:  (rack: Rack) => void;          // INSERT / UPDATE
  removeRack:  (id: string) => void;          // DELETE
  upsertEvent: (event: HistoryEvent) => void; // INSERT — deduplicates against optimistic events
  removeEvent: (id: string) => void;          // DELETE
}

// ── Standard store shape ──────────────────────────────────────────────────────
// State:    entity array + loading boolean + error string | null
// hydrate:  reset error → set loading → fetch → clear loading on success/failure
// Mutations: reset error → DB write first → local update on success → MutationResult<T>

export const useRacksStore = create<RacksStore>()((set, get) => ({
  racks:   [],
  history: [],
  loading: false,
  error:   null,

  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const [racks, history] = await Promise.all([
        fetchRacks(),
        fetchAllRackEvents(),
      ]);
      set({ racks, history, loading: false });
    } catch (e) {
      set({ loading: false, error: logMutationError("hydrate:racks", e) });
    }
  },

  addRack: async (input) => {
    set({ error: null });
    try {
      const rack = await dbCreate(input);
      set((state) => ({ racks: [...state.racks, rack] }));
      return ok(rack);
    } catch (e) {
      const isUnique = typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "23505";
      const message  = isUnique ? "Rack ID already exists" : logMutationError("addRack", e);
      set({ error: message });
      return err(message);
    }
  },

  updateRack: async (id, patch) => {
    set({ error: null });
    try {
      const rack = await dbUpdate(id, patch);
      set((state) => ({ racks: state.racks.map((r) => r.id === id ? rack : r) }));
      return ok(rack);
    } catch (e) {
      const isUnique = typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "23505";
      const message  = isUnique ? "Rack ID already exists" : logMutationError("updateRack", e);
      set({ error: message });
      return err(message);
    }
  },

  deleteRack: async (id) => {
    set({ error: null });
    try {
      await dbDelete(id);
      set((state) => ({
        racks:   state.racks.filter((r) => r.id !== id),
        history: state.history.filter((e) => e.rackId !== id),
      }));
      return ok(undefined);
    } catch (e) {
      const message = logMutationError("deleteRack", e);
      set({ error: message });
      return err(message);
    }
  },

  advanceStatus: async (id) => {
    set({ error: null });
    const { racks, history } = get();
    const rack = racks.find((r) => r.id === id);
    if (!rack) {
      const message = logMutationError("advanceStatus", new Error(`rack ${id} not found`));
      set({ error: message });
      return err(message);
    }
    const next = getNextStatus(rack.status);
    if (!next) {
      const message = logMutationError("advanceStatus", new Error(`rack ${id} already completed`));
      set({ error: message });
      return err(message);
    }

    try {
      await dbAdvance(id, next);
    } catch (e) {
      const message = logMutationError("advanceStatus", e);
      set({ error: message });
      return err(message);
    }

    // DB write succeeded — safe to update local state
    const ts = new Date().toISOString();
    const event: HistoryEvent = {
      id: crypto.randomUUID(),
      rackId: id,
      from: rack.status,
      to: next,
      timestamp: ts,
    };
    const updatedRacks = racks.map((r) =>
      r.id === id ? { ...r, status: next, updatedAt: ts } : r
    );

    set({ history: [...history, event], racks: updatedRacks });

    // Auto-assign PU zone when rack moves to pickup
    if (next === "pickup") {
      const puZone = useZonesStore.getState().zones.find((z) => z.name === "PU");
      if (puZone) {
        // Best-effort — failure does not roll back the rack advance
        await get().moveToZone(id, puZone.id);
      }
    }

    // Auto-complete delivery when every linked rack reaches ready (or further)
    if (next === "ready" && rack.deliveryId) {
      const sibs = updatedRacks.filter((r) => r.deliveryId === rack.deliveryId);
      const allDone =
        sibs.length > 0 &&
        sibs.every((r) => r.status === "ready" || r.status === "pickup" || r.status === "completed");
      if (allDone) {
        // Best-effort — failure does not roll back the rack advance
        await useDeliveriesStore.getState().setStatus(rack.deliveryId, "complete");
      }
    }

    return ok(undefined);
  },

  revertStatus: async (id) => {
    set({ error: null });
    const { racks, history } = get();
    const rack = racks.find((r) => r.id === id);
    if (!rack) {
      const message = logMutationError("revertStatus", new Error(`rack ${id} not found`));
      set({ error: message });
      return err(message);
    }
    const prev = getPrevStatus(rack.status);
    if (!prev) {
      const message = logMutationError("revertStatus", new Error(`rack ${id} is already at first status`));
      set({ error: message });
      return err(message);
    }

    try {
      await dbAdvance(id, prev);
    } catch (e) {
      const message = logMutationError("revertStatus", e);
      set({ error: message });
      return err(message);
    }

    const ts = new Date().toISOString();
    const event: HistoryEvent = {
      id: crypto.randomUUID(),
      rackId: id,
      from: rack.status,
      to: prev,
      timestamp: ts,
    };
    set({
      history: [...history, event],
      racks: racks.map((r) =>
        r.id === id ? { ...r, status: prev, updatedAt: ts } : r
      ),
    });

    return ok(undefined);
  },

  moveToZone: async (rackId, zoneId) => {
    set({ error: null });
    try {
      await dbMoveToZone(rackId, zoneId ?? null);
      const ts = new Date().toISOString();
      set((state) => ({
        racks: state.racks.map((r) =>
          r.id === rackId ? { ...r, zoneId, updatedAt: ts } : r
        ),
      }));
      return ok(undefined);
    } catch (e) {
      const message = logMutationError("moveToZone", e);
      set({ error: message });
      return err(message);
    }
  },

  closeAuctionCycle: async () => {
    set({ error: null });
    try {
      const count = await dbArchiveCompleted();
      set((state) => ({
        racks: state.racks.filter((r) => r.status !== "completed"),
      }));
      return ok(count);
    } catch (e) {
      const message = logMutationError("closeAuctionCycle", e);
      set({ error: message });
      return err(message);
    }
  },

  advanceToSorted: async (id, priority) => {
    set({ error: null });
    const { racks, history } = get();
    const rack = racks.find((r) => r.id === id);
    if (!rack) {
      const message = logMutationError("advanceToSorted", new Error(`rack ${id} not found`));
      set({ error: message });
      return err(message);
    }

    try {
      await dbUpdate(id, { priority });
      await dbAdvance(id, "sorted");
    } catch (e) {
      const message = logMutationError("advanceToSorted", e);
      set({ error: message });
      return err(message);
    }

    const ts = new Date().toISOString();
    const event: HistoryEvent = {
      id: crypto.randomUUID(),
      rackId: id,
      from: rack.status,
      to: "sorted",
      timestamp: ts,
    };
    set({
      history: [...history, event],
      racks: racks.map((r) =>
        r.id === id ? { ...r, status: "sorted", priority, updatedAt: ts } : r
      ),
    });

    return ok(undefined);
  },

  setHold: async (id, reason) => {
    return get().updateRack(id, {
      holdReason:    reason,
      holdStartedAt: new Date().toISOString(),
    });
  },

  clearHold: async (id) => {
    return get().updateRack(id, {
      holdReason:    null,
      holdStartedAt: null,
    });
  },

  upsertRack: (rack) => {
    set((state) => {
      // Archived rack arriving via realtime — evict from active store
      if (rack.isArchived) {
        return { racks: state.racks.filter((r) => r.id !== rack.id) };
      }
      const exists = state.racks.some((r) => r.id === rack.id);
      return {
        racks: exists
          ? state.racks.map((r) => (r.id === rack.id ? rack : r))
          : [...state.racks, rack],
      };
    });
  },

  removeRack: (id) => {
    set((state) => ({ racks: state.racks.filter((r) => r.id !== id) }));
  },

  upsertEvent: (event) => {
    set((state) => {
      // Remove any optimistic event for the same transition — advanceStatus creates
      // an event with a local UUID before the DB confirms. When the subscription fires
      // with the real UUID, we replace by content identity (rackId + from + to),
      // not by UUID, to avoid having the same transition recorded twice.
      const deduped = state.history.filter(
        (e) =>
          e.id === event.id || // keep exact match (already the DB version)
          !(e.rackId === event.rackId && e.from === event.from && e.to === event.to)
      );
      const alreadyPresent = deduped.some((e) => e.id === event.id);
      return {
        history: alreadyPresent
          ? deduped.map((e) => (e.id === event.id ? event : e))
          : [...deduped, event],
      };
    });
  },

  removeEvent: (id) => {
    set((state) => ({ history: state.history.filter((e) => e.id !== id) }));
  },
}));
