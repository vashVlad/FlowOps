"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useZonesStore } from "@/store/zones";

export default function PickupPage() {
  const router = useRouter();
  const zones  = useZonesStore((s) => s.zones);

  const pu = zones.find((z) => z.name === "PU");

  useEffect(() => {
    if (pu) router.replace(`/zones/${pu.id}`);
  }, [pu, router]);

  if (zones.length > 0 && !pu) {
    return (
      <div className="flex items-center justify-center h-40 text-center px-4">
        <p className="text-sm text-stone-400">
          Pick-Up zone not found. Ask an admin to create a zone named &quot;PU&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-40">
      <p className="text-sm text-stone-400">Loading Pick-Up zone…</p>
    </div>
  );
}
