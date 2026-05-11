import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

export type UserRole = "supervisor" | "worker";

interface AuthStore {
  session:     Session | null;
  user:        User | null;
  role:        UserRole;
  roleLoading: boolean;
  loading:     boolean;
  setSession:  (session: Session | null) => void;
  signIn:      (email: string, password: string) => Promise<string | null>;
  signOut:     () => Promise<void>;
}

async function fetchRole(userId: string): Promise<UserRole> {
  try {
    const { data } = await getSupabase()
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.role as UserRole) ?? "supervisor"; // fail open
  } catch {
    return "supervisor"; // fail open — table may not exist yet
  }
}

export const useAuthStore = create<AuthStore>()((set) => ({
  session:     null,
  user:        null,
  role:        "supervisor",
  roleLoading: true,
  loading:     true,

  setSession: (session) => {
    set({ session, user: session?.user ?? null, loading: false });
    if (session?.user) {
      fetchRole(session.user.id).then((role) =>
        set({ role, roleLoading: false })
      );
    } else {
      set({ role: "supervisor", roleLoading: false });
    }
  },

  signIn: async (email, password) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  },

  signOut: async () => {
    await getSupabase().auth.signOut();
    set({ session: null, user: null, role: "supervisor", roleLoading: false });
  },
}));

/** Returns true when the current user is a supervisor (or role is still loading — fail open). */
export function useIsSupervisor(): boolean {
  return useAuthStore((s) => s.roleLoading || s.role === "supervisor");
}
