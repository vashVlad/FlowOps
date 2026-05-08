"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import NotificationBell from "@/components/NotificationBell";

const links = [
  { href: "/",           label: "Dashboard"  },
  { href: "/deliveries", label: "Deliveries" },
  { href: "/racks",      label: "Racks"      },
  { href: "/zones",      label: "Zones"      },
  { href: "/lotting",    label: "Lotting"    },
  { href: "/search",     label: "Search"     },
  { href: "/reports",    label: "Reports"    },
];

export default function Header() {
  const pathname          = usePathname();
  const { user, signOut } = useAuthStore();
  const [profileOpen, setProfileOpen] = useState(false);

  const email    = user?.email ?? "";
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white px-4 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1440px] flex items-center justify-between gap-4 h-11">

        {/* Left: logo + desktop nav */}
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/" className="shrink-0 hover:opacity-80 transition-opacity" aria-label="FlowOps home">
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
            {links.map(({ href, label }) => {
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

        {/* Right: bell + profile */}
        <div className="flex items-center gap-1 shrink-0">
          <NotificationBell />

          <div className="relative">
            <button
              onClick={() => setProfileOpen((v) => !v)}
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
                  </div>
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
