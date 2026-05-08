"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function KeyboardShortcuts() {
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const isEditing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
        || (e.target as HTMLElement).isContentEditable;

      if (e.key === "/" && !isEditing) {
        e.preventDefault();
        if (pathname !== "/search") router.push("/search");
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, pathname]);

  return null;
}
