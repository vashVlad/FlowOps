"use client";

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

        {/* Right: bell + logout */}
        <div className="flex items-center gap-1 shrink-0">
          <NotificationBell />
          <button
            onClick={() => signOut()}
            aria-label={`Sign out${user?.email ? ` (${user.email})` : ""}`}
            title={user?.email ?? "Sign out"}
            className="flex items-center justify-center rounded-lg p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5 h-[18px] w-[18px]">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>

      </div>
    </header>
  );
}
