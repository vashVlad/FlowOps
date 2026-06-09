"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore, useIsAdmin } from "@/store/auth";
import NotificationBell from "@/components/NotificationBell";
import { ROLE_NAV, ROLE_LABELS, ROLE_HOME, type Role } from "@/lib/roles";

export default function Header() {
  const pathname               = usePathname();
  const router                 = useRouter();
  const { user, roles, activeRole, setActiveRole, signOut } = useAuthStore();
  const isAdmin                = useIsAdmin();
  const [profileOpen, setProfileOpen] = useState(false);
  const [roleOpen,    setRoleOpen]    = useState(false);

  const email    = user?.email ?? "";
  const initials = email.slice(0, 2).toUpperCase();

  const navLinks = activeRole ? ROLE_NAV[activeRole] : [];

  function handleRoleSwitch(role: Role) {
    setRoleOpen(false);
    setActiveRole(role);
    router.push(ROLE_HOME[role]);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white px-4 sm:px-6 lg:px-10" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto max-w-[1440px] flex items-center justify-between gap-4 h-11">

        {/* Left: logo + desktop nav */}
        <div className="flex items-center gap-2 min-w-0">
          <Link href={activeRole ? ROLE_HOME[activeRole] : "/"} className="shrink-0 hover:opacity-80 transition-opacity" aria-label="FlowOps home">
            <Image
              src="/FlowOps-Logo.png"
              alt="FlowOps"
              width={110}
              height={36}
              priority
              className="h-7 w-auto"
            />
          </Link>

          <span className="hidden sm:block h-4 w-px bg-stone-200 ml-3 shrink-0" />

          <nav className="hidden sm:flex items-center gap-1 ml-2">
            {navLinks.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                    active
                      ? "text-orange-600 font-medium bg-orange-50"
                      : "text-stone-500 hover:text-stone-800 hover:bg-stone-50"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: bell + role switcher + profile */}
        <div className="flex items-center gap-1 shrink-0">
          <NotificationBell />

          {/* Role switcher — desktop only; mobile uses BottomNav */}
          {roles.length > 1 && activeRole && (
            <div className="relative hidden sm:block">
              <button
                onClick={() => { setRoleOpen((v) => !v); setProfileOpen(false); }}
                className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-stone-100 transition-colors"
              >
                <span className="text-xs font-medium text-stone-700">
                  {ROLE_LABELS[activeRole]}
                </span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 text-stone-400">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {roleOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setRoleOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-stone-200 bg-white shadow-lg overflow-hidden">
                    <p className="px-3 py-2 text-[10px] font-medium text-stone-400 uppercase tracking-wider border-b border-stone-100">
                      Switch role
                    </p>
                    {roles.map((role) => (
                      <button
                        key={role}
                        onClick={() => handleRoleSwitch(role)}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                          role === activeRole
                            ? "bg-orange-50 text-orange-700 font-medium"
                            : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                        }`}
                      >
                        {ROLE_LABELS[role]}
                        {role === activeRole && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-orange-600">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Profile dropdown */}
          <div className="relative">
            <button
              onClick={() => { setProfileOpen((v) => !v); setRoleOpen(false); }}
              className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-stone-100 transition-colors"
            >
              <span className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center text-[11px] font-bold text-orange-700 shrink-0 select-none">
                {initials}
              </span>
              <span className="hidden sm:block text-xs text-stone-600 max-w-[140px] truncate">
                {email}
              </span>
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl border border-stone-200 bg-white shadow-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-stone-100">
                    <p className="text-[11px] text-stone-400 truncate">{email}</p>
                    {activeRole && (
                      <p className="text-[11px] text-stone-500 mt-0.5 font-medium">
                        {ROLE_LABELS[activeRole]}
                      </p>
                    )}
                  </div>
                  {isAdmin && (
                    <Link
                      href="/admin/users"
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors"
                    >
                      Manage users
                    </Link>
                  )}
                  <button
                    onClick={() => { setProfileOpen(false); signOut(); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </header>
  );
}
