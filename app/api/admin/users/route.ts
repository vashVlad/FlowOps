import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// GET /api/admin/users
// Returns all auth users joined with their user_roles rows.
export async function GET() {
  try {
    const admin = getSupabaseAdmin();

    const [usersRes, rolesRes] = await Promise.all([
      admin.auth.admin.listUsers(),
      admin.from("user_roles").select("user_id, role, is_default"),
    ]);

    if (usersRes.error) throw usersRes.error;
    if (rolesRes.error) throw rolesRes.error;

    const rolesByUser = new Map<string, { role: string; is_default: boolean }[]>();
    for (const row of rolesRes.data ?? []) {
      const arr = rolesByUser.get(row.user_id) ?? [];
      arr.push({ role: row.role, is_default: row.is_default });
      rolesByUser.set(row.user_id, arr);
    }

    const users = usersRes.data.users.map((u) => ({
      id:          u.id,
      email:       u.email ?? "",
      createdAt:   u.created_at,
      lastSignIn:  u.last_sign_in_at ?? null,
      roles:       (rolesByUser.get(u.id) ?? []).map((r) => r.role),
      defaultRole: (rolesByUser.get(u.id) ?? []).find((r) => r.is_default)?.role ?? null,
    }));

    return NextResponse.json({ users });
  } catch (err) {
    console.error("[admin/users GET]", err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
