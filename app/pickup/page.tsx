"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useZonesStore } from "@/store/zones";

export default function PickupPage() {
  const router = useRouter();
  const zones  = useZonesStore((s) => s.zones);

  useEffect(() => {
    const pu = zones.find((z) => z.name === "PU");
    if (pu) {
      router.replace(`/zones/${pu.id}`);
    }
  }, [zones, router]);

  return (
    <div className="flex items-center justify-center h-40">
      <p className="text-sm text-stone-400">Loading Pick-Up zone…</p>
    </div>
  );
}
