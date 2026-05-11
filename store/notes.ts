import { create } from "zustand";
import type { RackNote } from "@/types";
import { ok, err, logMutationError, type MutationResult } from "@/lib/store";
import {
  fetchAllNotes,
  createNote as dbCreate,
  deleteNote as dbDelete,
} from "@/supabase/queries";

interface NotesStore {
  notes:   RackNote[];
  loading: boolean;
  hydrate: () => Promise<void>;
  addNote: (
    note: string,
    rackId?: string,
    deliveryId?: string
  ) => Promise<MutationResult<RackNote>>;
  deleteNote: (noteId: string) => Promise<MutationResult<undefined>>;
}

export const useNotesStore = create<NotesStore>()((set) => ({
  notes:   [],
  loading: false,

  hydrate: async () => {
    set({ loading: true });
    try {
      const notes = await fetchAllNotes();
      set({ notes, loading: false });
    } catch (e) {
      set({ loading: false });
      logMutationError("hydrate:notes", e);
    }
  },

  addNote: async (note, rackId, deliveryId) => {
    try {
      const created = await dbCreate({ note, rackId, deliveryId });
      set((state) => ({ notes: [created, ...state.notes] }));
      return ok(created);
    } catch (e) {
      return err(logMutationError("addNote", e));
    }
  },

  deleteNote: async (noteId) => {
    try {
      await dbDelete(noteId);
      set((state) => ({ notes: state.notes.filter((n) => n.id !== noteId) }));
      return ok(undefined);
    } catch (e) {
      return err(logMutationError("deleteNote", e));
    }
  },
}));
