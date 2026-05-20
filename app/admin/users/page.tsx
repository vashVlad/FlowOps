"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/roles";

interface AdminUser {
  id:          string;
  email:       string;
  createdAt:   string;
  lastSignIn:  string | null;
  roles:       Role[];
  defaultRole: Role | null;
}

// ── Role chip ─────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<Role, string> = {
  admin:      "bg-red-50 text-red-700 border-red-200",
  front_desk: "bg-sky-50 text-sky-700 border-sky-200",
  unpacker:   "bg-violet-50 text-violet-700 border-violet-200",
  sorter:     "bg-teal-50 text-teal-700 border-teal-200",
  lotter:     "bg-amber-50 text-amber-700 border-amber-200",
  pickup:     "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function RoleChip({ role, small }: { role: Role; small?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${small ? "text-[10px]" : "text-xs"} ${ROLE_COLORS[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

// ── Edit panel ────────────────────────────────────────────────────────────────

function EditPanel({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: (updated: AdminUser) => void;
}) {
  const [selectedRoles, setSelectedRoles] = useState<Role[]>(user.roles);
  const [defaultRole,   setDefaultRole]   = useState<Role | null>(user.defaultRole ?? user.roles[0] ?? null);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  function toggleRole(role: Role) {
    setSelectedRoles((prev) => {
      const next = prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role];
      if (defaultRole && !next.includes(defaultRole)) {
        setDefaultRole(next[0] ?? null);
      }
      return next;
    });
  }

  async function save() {
    if (selectedRoles.length === 0) { setError("Assign at least one role."); return; }
    if (!defaultRole) { setError("Select a default role."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: selectedRoles, defaultRole }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onSaved({ ...user, roles: selectedRoles, defaultRole });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-stone-900 truncate">{user.email}</p>
            <p className="text-xs text-stone-400 mt-0.5">Edit role assignments</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-stone-500">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Role toggles */}
          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">Granted roles</p>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((role) => {
                const active = selectedRoles.includes(role);
                return (
                  <button
                    key={role}
                    onClick={() => toggleRole(role)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                      active
                        ? `${ROLE_COLORS[role]} shadow-sm`
                        : "bg-stone-50 text-stone-400 border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    {ROLE_LABELS[role]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Default role picker */}
          {selectedRoles.length > 0 && (
            <div>
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">Default role (on login)</p>
              <div className="flex flex-wrap gap-2">
                {selectedRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => setDefaultRole(role)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all flex items-center gap-1.5 ${
                      defaultRole === role
                        ? `${ROLE_COLORS[role]} shadow-sm`
                        : "bg-stone-50 text-stone-400 border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    {defaultRole === role && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {ROLE_LABELS[role]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-stone-100 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Invite modal ──────────────────────────────────────────────────────────────

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [email,         setEmail]         = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);
  const [defaultRole,   setDefaultRole]   = useState<Role | null>(null);
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);

  function toggleRole(role: Role) {
    setSelectedRoles((prev) => {
      const next = prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role];
      if (defaultRole && !next.includes(defaultRole)) setDefaultRole(next[0] ?? null);
      if (!defaultRole && next.length > 0) setDefaultRole(next[0]);
      return next;
    });
  }

  async function send() {
    if (!email.trim()) { setError("Email is required."); return; }
    if (selectedRoles.length === 0) { setError("Assign at least one role."); return; }
    setSending(true); setError(null);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), roles: selectedRoles, defaultRole: defaultRole ?? selectedRoles[0] }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSuccess(true);
      setTimeout(() => { onInvited(); onClose(); }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <p className="text-sm font-semibold text-stone-900">Invite new user</p>
          <p className="text-xs text-stone-400 mt-0.5">They&apos;ll receive a magic link to set their password.</p>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wide block mb-1.5">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="worker@warehouse.com"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">Roles</p>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((role) => {
                const active = selectedRoles.includes(role);
                return (
                  <button
                    key={role}
                    onClick={() => toggleRole(role)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                      active
                        ? `${ROLE_COLORS[role]} shadow-sm`
                        : "bg-stone-50 text-stone-400 border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    {ROLE_LABELS[role]}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedRoles.length > 1 && (
            <div>
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">Default role</p>
              <div className="flex flex-wrap gap-2">
                {selectedRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => setDefaultRole(role)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all flex items-center gap-1.5 ${
                      defaultRole === role
                        ? `${ROLE_COLORS[role]} shadow-sm`
                        : "bg-stone-50 text-stone-400 border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    {defaultRole === role && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {ROLE_LABELS[role]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error   && <p className="text-xs text-red-600">{error}</p>}
          {success && <p className="text-xs text-emerald-600">Invite sent!</p>}
        </div>

        <div className="px-5 py-3 border-t border-stone-100 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={send}
            disabled={sending || success}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
          >
            {sending ? "Sending…" : "Send invite"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [users,       setUsers]       = useState<AdminUser[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [inviteOpen,  setInviteOpen]  = useState(false);

  async function loadUsers() {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  function handleSaved(updated: AdminUser) {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    setEditingUser(null);
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <>
      <PageHeader
        title="User management"
        subtitle={loading ? "Loading…" : `${users.length} user${users.length !== 1 ? "s" : ""}`}
        action={
          <button
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Invite user
          </button>
        }
      />

      <Card padding="p-0" className="mt-4 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-stone-400">Loading users…</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-sm text-stone-400">No users found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">User</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide hidden sm:table-cell">Roles</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide hidden md:table-cell">Last sign-in</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-stone-900 truncate max-w-[200px]">{user.email}</p>
                    <div className="flex flex-wrap gap-1 mt-1 sm:hidden">
                      {user.roles.map((r) => <RoleChip key={r} role={r} small />)}
                      {user.roles.length === 0 && <span className="text-xs text-stone-400">No roles</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((r) => <RoleChip key={r} role={r} small />)}
                      {user.roles.length === 0 && <span className="text-xs text-stone-400">No roles assigned</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-stone-400 hidden md:table-cell">
                    {formatDate(user.lastSignIn)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setEditingUser(user)}
                      className="text-xs text-orange-600 hover:text-orange-700 font-medium transition-colors"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {editingUser && (
        <EditPanel
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={handleSaved}
        />
      )}
      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onInvited={loadUsers}
        />
      )}
    </>
  );
}
