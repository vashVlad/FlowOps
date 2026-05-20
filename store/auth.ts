import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { type Role, ROLE_HOME, ROLES } from "@/lib/roles";

interface UserRoleRow {
  role: Role;
  is_default: boolean;
}

interface AuthStore {
  session:      Session | null;
  user:         User | null;
  roles:        Role[];        // all granted roles
  activeRole:   Role | null;   // currently selected role (persisted in localStorage)
  roleLoading:  boolean;
  loading:      boolean;
  setSession:   (session: Session | null) => void;
  setActiveRole:(role: Role) => void;
  signIn:       (email: string, password: string) => Promise<string | null>;
  signOut:      () => Promise<void>;
}

async function fetchRoles(userId: string): Promise<{ roles: Role[]; defaultRole: Role | null }> {
  try {
    const { data } = await getSupabase()
      .from("user_roles")
      .select("role, is_default")
      .eq("user_id", userId);

    if (!data || data.length === 0) {
      // No rows — fail open with admin so existing deployments stay accessible
      return { roles: ["admin"], defaultRole: "admin" };
    }

    const rows = data as UserRoleRow[];
    const roles = rows
      .map((r) => r.role)
      .filter((r): r is Role => (ROLES as readonly string[]).includes(r));
    const defaultRow = rows.find((r) => r.is_default);
    const defaultRole = defaultRow ? defaultRow.role : roles[0] ?? "admin";

    return { roles, defaultRole };
  } catch {
    return { roles: ["admin"], defaultRole: "admin" };
  }
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      session:     null,
      user:        null,
      roles:       [],
      activeRole:  null,
      roleLoading: true,
      loading:     true,

      setSession: (session) => {
        set({ session, user: session?.user ?? null, loading: false });
        if (session?.user) {
          fetchRoles(session.user.id).then(({ roles, defaultRole }) => {
            const current = get().activeRole;
            // Keep existing activeRole if it's still in the granted roles list;
            // otherwise fall back to the default role from the DB.
            const activeRole =
              current && roles.includes(current) ? current : defaultRole;
            set({ roles, activeRole, roleLoading: false });
            if (activeRole && typeof document !== "undefined") {
              document.cookie = `flowops-active-role=${activeRole}; path=/; max-age=31536000; SameSite=Lax`;
            }
          });
        } else {
          set({ roles: [], activeRole: null, roleLoading: false });
        }
      },

      setActiveRole: (role) => {
        const { roles } = get();
        if (roles.includes(role)) {
          set({ activeRole: role });
          // Write cookie so middleware (server-side) can read the active role
          if (typeof document !== "undefined") {
            document.cookie = `flowops-active-role=${role}; path=/; max-age=31536000; SameSite=Lax`;
          }
        }
      },

      signIn: async (email, password) => {
        const { error } = await getSupabase().auth.signInWithPassword({ email, password });
        return error?.message ?? null;
      },

      signOut: async () => {
        await getSupabase().auth.signOut();
        set({ session: null, user: null, roles: [], activeRole: null, roleLoading: false });
        if (typeof document !== "undefined") {
          document.cookie = "flowops-active-role=; path=/; max-age=0";
        }
      },
    }),
    {
      name: "flowops-auth",
      // Only persist activeRole — session/user come from Supabase on mount
      partialize: (s) => ({ activeRole: s.activeRole }),
    }
  )
);

// ── Convenience selectors ─────────────────────────────────────────────────────

export function useActiveRole(): Role | null {
  return useAuthStore((s) => s.activeRole);
}

export function useGrantedRoles(): Role[] {
  return useAuthStore((s) => s.roles);
}

export function useIsAdmin(): boolean {
  return useAuthStore((s) => s.roleLoading || s.activeRole === "admin");
}

/** Back-compat: supervisor = admin in the new system */
export function useIsSupervisor(): boolean {
  return useIsAdmin();
}

export function useRoleHome(): string {
  const role = useAuthStore((s) => s.activeRole);
  return role ? ROLE_HOME[role] : "/";
}
