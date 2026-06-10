import { create } from "zustand";
import type { Dumpster, DumpsterEntry, AddDumpsterEntryInput } from "@/types";
import { ok, err, logMutationError, type MutationResult } from "@/lib/store";
import {
  fetchDumpsters,
  fetchDumpsterEntries,
  addDumpsterEntry as dbAddEntry,
  swapDumpster as dbSwap,
  deleteDumpsterEntry as dbDeleteEntry,
} from "@/supabase/queries";

interface DumpstersStore {
  dumpsters: Dumpster[];
  entries:   DumpsterEntry[];
  loading:   boolean;
  error:     string | null;
  hydrate:        () => Promise<void>;
  addEntry:       (input: AddDumpsterEntryInput) => Promise<MutationResult<DumpsterEntry>>;
  swap:           (dumpsterId: string) => Promise<MutationResult<DumpsterEntry>>;
  deleteEntry:    (entryId: string) => Promise<MutationResult<undefined>>;
  // ── Subscription callbacks (realtime — do not call directly) ──────────────
  upsertDumpster: (dumpster: Dumpster) => void;
}

// ── Standard store shape ──────────────────────────────────────────────────────
// State:    entity arrays + loading boolean + error string | null
// hydrate:  reset error → set loading → fetch → clear loading on success/failure
// Mutations: reset error → DB write first → local update on success → MutationResult<T>

export const useDumpstersStore = create<DumpstersStore>()((set) => ({
  dumpsters: [],
  entries:   [],
  loading:   false,
  error:     null,

  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const [dumpsters, entries] = await Promise.all([fetchDumpsters(), fetchDumpsterEntries()]);
      set({ dumpsters, entries, loading: false });
    } catch (e) {
      set({ loading: false, error: logMutationError("hydrate:dumpsters", e) });
    }
  },

  addEntry: async (input) => {
    set({ error: null });
    try {
      const { entry, dumpster } = await dbAddEntry(input);
      set((state) => ({
        dumpsters: state.dumpsters.map((d) => (d.id === dumpster.id ? dumpster : d)),
        entries:   [entry, ...state.entries],
      }));
      return ok(entry);
    } catch (e) {
      const message = logMutationError("addDumpsterEntry", e);
      set({ error: message });
      return err(message);
    }
  },

  swap: async (dumpsterId) => {
    set({ error: null });
    try {
      const { entry, dumpster } = await dbSwap(dumpsterId);
      set((state) => ({
        dumpsters: state.dumpsters.map((d) => (d.id === dumpster.id ? dumpster : d)),
        entries:   [entry, ...state.entries],
      }));
      return ok(entry);
    } catch (e) {
      const message = logMutationError("swapDumpster", e);
      set({ error: message });
      return err(message);
    }
  },

  deleteEntry: async (entryId) => {
    set({ error: null });
    try {
      await dbDeleteEntry(entryId);
      const [dumpsters, entries] = await Promise.all([fetchDumpsters(), fetchDumpsterEntries()]);
      set({ dumpsters, entries });
      return ok(undefined);
    } catch (e) {
      const message = logMutationError("deleteDumpsterEntry", e);
      set({ error: message });
      return err(message);
    }
  },

  upsertDumpster: (dumpster) => {
    set((state) => ({
      dumpsters: state.dumpsters.some((d) => d.id === dumpster.id)
        ? state.dumpsters.map((d) => (d.id === dumpster.id ? dumpster : d))
        : [...state.dumpsters, dumpster],
    }));
  },
}));
