import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ROLES, type Role } from "@/lib/roles";

// PATCH /api/admin/users/[id]
// Body: { roles: Role[], defaultRole: Role }
// Replaces the user's role assignments entirely.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json() as { roles: Role[]; defaultRole: Role };
    const { roles, defaultRole } = body;

    if (!Array.isArray(roles) || roles.some((r) => !(ROLES as readonly string[]).includes(r))) {
      return NextResponse.json({ error: "Invalid roles" }, { status: 400 });
    }
    if (!ROLES.includes(defaultRole as Role) || !roles.includes(defaultRole)) {
      return NextResponse.json({ error: "defaultRole must be in roles list" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Delete all existing role rows then re-insert
    const { error: delErr } = await admin
      .from("user_roles")
      .delete()
      .eq("user_id", id);

    if (delErr) throw delErr;

    if (roles.length > 0) {
      const rows = roles.map((role) => ({
        user_id:    id,
        role,
        is_default: role === defaultRole,
      }));

      const { error: insErr } = await admin.from("user_roles").insert(rows);
      if (insErr) throw insErr;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/users/[id] PATCH]", err);
    return NextResponse.json({ error: "Failed to update roles" }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id]
// Removes the user from Supabase Auth entirely.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = getSupabaseAdmin();
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/users/[id] DELETE]", err);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
