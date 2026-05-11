"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRacksStore } from "@/store/racks";
import { useDeliveriesStore } from "@/store/deliveries";
import { useZonesStore } from "@/store/zones";

// QR code uses canvas/SVG — defer to client only
const QRCodeSVG = dynamic(
  () => import("qrcode.react").then((m) => m.QRCodeSVG),
  { ssr: false }
);

export default function RackLabelPage() {
  const { id } = useParams<{ id: string }>();
  const { racks }      = useRacksStore();
  const { deliveries } = useDeliveriesStore();
  const { zones }      = useZonesStore();

  // Resolve full URL on client so QR code encodes the real deployed origin
  const [rackUrl, setRackUrl] = useState("");
  useEffect(() => {
    setRackUrl(`${window.location.origin}/racks/${id}`);
  }, [id]);

  const rack     = racks.find((r) => r.id === id);
  const delivery = rack ? deliveries.find((d) => d.id === rack.deliveryId) : undefined;
  const zone     = rack?.zoneId ? zones.find((z) => z.id === rack.zoneId) : undefined;

  if (!rack) {
    return (
      <div className="p-8 text-center space-y-2">
        <p className="text-sm font-medium text-stone-700">Rack not found</p>
        <Link href="/racks" className="text-xs text-orange-600 hover:underline">
          ← Back to racks
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Controls — hidden in print */}
      <div className="no-print flex items-center gap-3 mb-6">
        <Link
          href={`/racks/${id}`}
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
        >
          ← Back
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
        >
          Print
        </button>
      </div>

      {/* Label card */}
      <div className="w-[320px] rounded-xl border-2 border-stone-200 bg-white overflow-hidden shadow-sm">

        {/* Rack code header */}
        <div className="bg-stone-900 px-6 py-4 text-center">
          <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-1">Rack ID</p>
          <p className="text-3xl font-bold text-white tracking-tight font-mono">{rack.rackCode}</p>
        </div>

        {/* QR code — centered, generous padding */}
        <div className="flex justify-center px-6 py-6 bg-white">
          {rackUrl ? (
            <QRCodeSVG
              value={rackUrl}
              size={180}
              level="M"
              marginSize={1}
            />
          ) : (
            <div className="w-[180px] h-[180px] bg-stone-100 rounded animate-pulse" />
          )}
        </div>

        {/* Metadata rows */}
        <div className="px-6 pb-5 border-t border-stone-100 divide-y divide-stone-100">
          <div className="py-3">
            <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-0.5">Consigner</p>
            <p className="text-sm font-semibold text-stone-900 truncate">{rack.consignerName}</p>
          </div>
          {delivery?.consignerJNumber && (
            <div className="py-3">
              <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-0.5">J-Number</p>
              <p className="text-base font-bold text-stone-900 font-mono">{delivery.consignerJNumber}</p>
            </div>
          )}
          <div className="py-3 flex gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-0.5">Stage</p>
              <p className="text-sm font-medium text-stone-800 capitalize">{rack.status}</p>
            </div>
            {zone && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-0.5">Zone</p>
                <p className="text-sm font-bold text-stone-900">{zone.name}</p>
              </div>
            )}
          </div>
        </div>

        {/* Branding footer */}
        <div className="border-t border-stone-100 px-6 py-2.5 text-center">
          <p className="text-[10px] text-stone-300 uppercase tracking-widest">FlowOps</p>
        </div>
      </div>
    </div>
  );
}
