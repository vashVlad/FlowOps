import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

interface AuthStore {
  session: Session | null;
  user:    User | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  signIn:     (email: string, password: string) => Promise<string | null>;
  signOut:    () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()((set) => ({
  session: null,
  user:    null,
  loading: true,

  setSession: (session) =>
    set({ session, user: session?.user ?? null, loading: false }),

  signIn: async (email, password) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  },

  signOut: async () => {
    await getSupabase().auth.signOut();
    set({ session: null, user: null });
  },
}));
