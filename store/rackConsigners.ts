import { create } from "zustand";
import type { RackConsigner, CreateRackConsignerInput } from "@/types";
import { ok, err, logMutationError, type MutationResult } from "@/lib/store";
import {
  fetchAllRackConsigners,
  createRackConsigner as dbCreate,
  deleteRackConsigner as dbDelete,
} from "@/supabase/queries";

interface RackConsignersStore {
  consigners: RackConsigner[];
  loading:    boolean;
  hydrate:    () => Promise<void>;
  add:        (input: CreateRackConsignerInput) => Promise<MutationResult<RackConsigner>>;
  remove:     (id: string) => Promise<MutationResult<undefined>>;
  upsert:     (c: RackConsigner) => void;
  evict:      (id: string) => void;
}

export const useRackConsignersStore = create<RackConsignersStore>()((set) => ({
  consigners: [],
  loading:    false,

  hydrate: async () => {
    set({ loading: true });
    try {
      const consigners = await fetchAllRackConsigners();
      set({ consigners, loading: false });
    } catch (e) {
      set({ loading: false });
      logMutationError("hydrate:rackConsigners", e);
    }
  },

  add: async (input) => {
    try {
      const created = await dbCreate(input);
      set((s) => ({ consigners: [...s.consigners, created] }));
      return ok(created);
    } catch (e) {
      return err(logMutationError("addRackConsigner", e));
    }
  },

  remove: async (id) => {
    try {
      await dbDelete(id);
      set((s) => ({ consigners: s.consigners.filter((c) => c.id !== id) }));
      return ok(undefined);
    } catch (e) {
      return err(logMutationError("removeRackConsigner", e));
    }
  },

  upsert: (c) => {
    set((s) => {
      const exists = s.consigners.some((x) => x.id === c.id);
      return {
        consigners: exists
          ? s.consigners.map((x) => (x.id === c.id ? c : x))
          : [...s.consigners, c],
      };
    });
  },

  evict: (id) => {
    set((s) => ({ consigners: s.consigners.filter((c) => c.id !== id) }));
  },
}));
