// ── Role definitions — single source of truth ─────────────────────────────────

export const ROLES = [
  "admin",
  "front_desk",
  "unpacker",
  "sorter",
  "lotter",
  "pickup",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin:      "Admin",
  front_desk: "Front Desk",
  unpacker:   "Unpacker",
  sorter:     "Sorter",
  lotter:     "Lotter",
  pickup:     "Pickup",
};

// Where each role lands after login / when visiting "/"
export const ROLE_HOME: Record<Role, string> = {
  admin:      "/",
  front_desk: "/front-desk",
  unpacker:   "/unpack",
  sorter:     "/racks",
  lotter:     "/lotting",
  pickup:     "/pickup",
};

// Allowed route prefixes per role. "*" means unrestricted.
export const ROLE_ROUTES: Record<Role, string[]> = {
  admin:      ["*"],
  front_desk: ["/front-desk", "/deliveries", "/consigners", "/racks", "/search"],
  unpacker:   ["/unpack", "/racks", "/labels", "/search", "/scan"],
  sorter:     ["/racks", "/unpack", "/search", "/scan"],
  lotter:     ["/lotting", "/racks", "/unpack", "/search", "/scan"],
  pickup:     ["/pickup", "/racks", "/search", "/scan"],
};

// Desktop top nav links per role
export const ROLE_NAV: Record<Role, Array<{ href: string; label: string }>> = {
  admin: [
    { href: "/",            label: "Dashboard"  },
    { href: "/zones",       label: "Zones"      },
    { href: "/racks",       label: "Racks"      },
    { href: "/deliveries",  label: "Deliveries" },
    { href: "/consigners",  label: "Consigners" },
    { href: "/dumpsters",   label: "Dumpsters"  },
    { href: "/reports",     label: "Reports"    },
    { href: "/search",      label: "Search"     },
  ],
  front_desk: [
    { href: "/front-desk",  label: "Home"       },
    { href: "/deliveries",  label: "Deliveries" },
    { href: "/consigners",  label: "Consigners" },
    { href: "/search",      label: "Search"     },
  ],
  unpacker: [
    { href: "/unpack",  label: "Create Rack" },
    { href: "/racks",   label: "Racks"  },
    { href: "/search",  label: "Search" },
  ],
  sorter: [
    { href: "/unpack", label: "Create Rack" },
    { href: "/racks",  label: "Racks"       },
    { href: "/search", label: "Search"      },
  ],
  lotter: [
    { href: "/lotting", label: "Lotting" },
    { href: "/racks",   label: "Racks"   },
    { href: "/search",  label: "Search"  },
  ],
  pickup: [
    { href: "/pickup", label: "Pick-Up" },
    { href: "/racks",  label: "Racks"   },
    { href: "/search", label: "Search"  },
  ],
};

// Mobile bottom nav links per role — includes Scan, which is mobile-only
export const ROLE_NAV_MOBILE: Record<Role, Array<{ href: string; label: string }>> = {
  admin: [
    { href: "/",           label: "Dashboard"  },
    { href: "/racks",      label: "Racks"      },
    { href: "/deliveries", label: "Deliveries" },
    { href: "/scan",       label: "Scan"       },
    { href: "/search",     label: "Search"     },
  ],
  front_desk: ROLE_NAV.front_desk,
  unpacker: [
    { href: "/unpack", label: "Create Rack" },
    { href: "/racks",  label: "Racks"       },
    { href: "/search", label: "Search"      },
    { href: "/scan",   label: "Scan"        },
  ],
  sorter: [
    { href: "/unpack", label: "Create Rack" },
    { href: "/racks",  label: "Racks"       },
    { href: "/search", label: "Search"      },
    { href: "/scan",   label: "Scan"        },
  ],
  lotter: [
    { href: "/lotting", label: "Lotting" },
    { href: "/racks",   label: "Racks"   },
    { href: "/search",  label: "Search"  },
    { href: "/scan",    label: "Scan"    },
  ],
  pickup: [
    { href: "/pickup", label: "Pick-Up" },
    { href: "/racks",  label: "Racks"   },
    { href: "/search", label: "Search"  },
    { href: "/scan",   label: "Scan"    },
  ],
};

// Which rack statuses each role can see on the /racks page.
// undefined = no restriction (admin sees all)
export const ROLE_RACK_STATUSES: Record<Role, string[] | undefined> = {
  admin:      undefined,
  front_desk: undefined,
  unpacker:   ["unpacking_sorting", "sorted"],
  sorter:     ["unpacking_sorting", "ready"],
  lotter:     ["sorted", "lotting", "ready"],
  pickup:     ["ready", "pickup"],
};

// Roles that cannot advance racks (view-only on rack cards)
export const ADVANCE_RESTRICTED_ROLES = new Set<Role>(["front_desk"]);

export function canAdvanceRacks(role: Role): boolean {
  return !ADVANCE_RESTRICTED_ROLES.has(role);
}

export function isAllowedRoute(role: Role, pathname: string): boolean {
  const allowed = ROLE_ROUTES[role];
  if (allowed.includes("*")) return true;
  return allowed.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}
