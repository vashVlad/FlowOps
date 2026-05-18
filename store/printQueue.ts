import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PrintQueueStore {
  ids: string[];
  add: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
}

export const usePrintQueueStore = create<PrintQueueStore>()(
  persist(
    (set, get) => ({
      ids: [],
      add: (id) =>
        set((s) => ({ ids: s.ids.includes(id) ? s.ids : [...s.ids, id] })),
      remove: (id) =>
        set((s) => ({ ids: s.ids.filter((i) => i !== id) })),
      clear: () => set({ ids: [] }),
      has: (id) => get().ids.includes(id),
    }),
    { name: "flowops-print-queue" }
  )
);
