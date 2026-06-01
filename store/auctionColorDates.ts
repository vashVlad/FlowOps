import { create } from "zustand";
import { ok, err, logMutationError, type MutationResult } from "@/lib/store";
import {
  fetchAuctionColorDates,
  upsertAuctionColorDate,
  deleteAuctionColorDate,
} from "@/supabase/queries";

interface AuctionColorDatesStore {
  dates:   Record<string, string>; // colorHex → "YYYY-MM-DD"
  loading: boolean;
  hydrate:   () => Promise<void>;
  setDate:   (colorHex: string, auctionDate: string) => Promise<MutationResult<undefined>>;
  clearDate: (colorHex: string) => Promise<MutationResult<undefined>>;
}

export const useAuctionColorDatesStore = create<AuctionColorDatesStore>()((set) => ({
  dates:   {},
  loading: false,

  hydrate: async () => {
    set({ loading: true });
    try {
      const dates = await fetchAuctionColorDates();
      set({ dates, loading: false });
    } catch (e) {
      set({ loading: false });
      logMutationError("hydrate:auctionColorDates", e);
    }
  },

  setDate: async (colorHex, auctionDate) => {
    try {
      await upsertAuctionColorDate(colorHex, auctionDate);
      set((s) => ({ dates: { ...s.dates, [colorHex]: auctionDate } }));
      return ok(undefined);
    } catch (e) {
      return err(logMutationError("setDate:auctionColorDate", e));
    }
  },

  clearDate: async (colorHex) => {
    try {
      await deleteAuctionColorDate(colorHex);
      set((s) => {
        const next = { ...s.dates };
        delete next[colorHex];
        return { dates: next };
      });
      return ok(undefined);
    } catch (e) {
      return err(logMutationError("clearDate:auctionColorDate", e));
    }
  },
}));
