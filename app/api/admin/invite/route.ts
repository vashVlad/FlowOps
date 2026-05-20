import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ROLES, type Role } from "@/lib/roles";

// POST /api/admin/invite
// Body: { email: string, roles: Role[], defaultRole: Role }
// Sends a Supabase magic-link invite and assigns roles.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email: string; roles: Role[]; defaultRole: Role };
    const { email, roles, defaultRole } = body;

    if (!email || !Array.isArray(roles) || roles.length === 0) {
      return NextResponse.json({ error: "email and roles are required" }, { status: 400 });
    }
    if (!ROLES.includes(defaultRole as Role) || !roles.includes(defaultRole)) {
      return NextResponse.json({ error: "defaultRole must be in roles list" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Invite user via Supabase Auth (sends magic link email)
    const { data, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email);
    if (inviteErr) throw inviteErr;

    const userId = data.user.id;

    // Assign roles
    const rows = roles.map((role) => ({
      user_id:    userId,
      role,
      is_default: role === defaultRole,
    }));

    const { error: rolesErr } = await admin.from("user_roles").insert(rows);
    if (rolesErr) throw rolesErr;

    return NextResponse.json({ ok: true, userId });
  } catch (err) {
    console.error("[admin/invite POST]", err);
    return NextResponse.json({ error: "Failed to invite user" }, { status: 500 });
  }
}
