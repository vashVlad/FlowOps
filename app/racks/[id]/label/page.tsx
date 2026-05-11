"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRacksStore } from "@/store/racks";
import { useDeliveriesStore } from "@/store/deliveries";

const QRCodeSVG = dynamic(
  () => import("qrcode.react").then((m) => m.QRCodeSVG),
  { ssr: false }
);

export default function RackLabelPage() {
  const { id } = useParams<{ id: string }>();
  const { racks }      = useRacksStore();
  const { deliveries } = useDeliveriesStore();

  const [rackUrl, setRackUrl] = useState("");
  useEffect(() => {
    setRackUrl(`${window.location.origin}/racks/${id}`);
  }, [id]);

  const rack      = racks.find((r) => r.id === id);
  const delivery  = rack ? deliveries.find((d) => d.id === rack.deliveryId) : undefined;
  const printDate = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (!rack) {
    return (
      <div className="p-8 text-center space-y-2">
        <p className="text-sm font-medium text-stone-700">Rack not found</p>
        <Link href="/racks" className="text-xs text-orange-600 hover:underline">← Back to racks</Link>
      </div>
    );
  }

  return (
    <>
      {/* @page margins — only active during print */}
      <style>{`
        @media print {
          @page { margin: 0.6in; }
        }
      `}</style>

      {/* Controls — hidden in print */}
      <div className="no-print flex items-center gap-3 mb-8">
        <Link
          href={`/racks/${id}`}
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
        >
          ← Back
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
        >
          Print label
        </button>
        <p className="text-xs text-stone-400">Set scale to 100% and disable headers/footers in your print dialog.</p>
      </div>

      {/* Label — centered on screen + in print */}
      <div className="flex justify-center">
        <div
          className="w-full bg-white overflow-hidden"
          style={{
            maxWidth: "420px",
            border: "2px solid black",
            fontFamily: "'Courier New', Courier, monospace",
          }}
        >
          {/* ── Rack code — large, high contrast ── */}
          <div style={{ backgroundColor: "#000", padding: "20px 28px", textAlign: "center" }}>
            <p style={{ fontSize: "10px", letterSpacing: "0.2em", color: "#888", textTransform: "uppercase", marginBottom: "6px" }}>
              Rack ID
            </p>
            <p style={{ fontSize: "48px", fontWeight: 900, color: "#fff", letterSpacing: "-1px", lineHeight: 1 }}>
              {rack.rackCode}
            </p>
          </div>

          {/* ── QR code — centered, large ── */}
          <div style={{ display: "flex", justifyContent: "center", padding: "32px 28px 28px", backgroundColor: "#fff" }}>
            {rackUrl ? (
              <QRCodeSVG
                value={rackUrl}
                size={280}
                level="H"
                marginSize={1}
                style={{ display: "block" }}
              />
            ) : (
              <div style={{ width: 280, height: 280, backgroundColor: "#f5f5f5" }} />
            )}
          </div>

          {/* ── Consigner + J-Number ── */}
          <div style={{ borderTop: "2px solid black", padding: "16px 28px" }}>
            <p style={{ fontSize: "10px", letterSpacing: "0.2em", color: "#888", textTransform: "uppercase", marginBottom: "4px" }}>
              Consigner
            </p>
            <p style={{ fontSize: "18px", fontWeight: 700, color: "#000", marginBottom: delivery?.consignerJNumber ? "10px" : 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {rack.consignerName}
            </p>
            {delivery?.consignerJNumber && (
              <>
                <p style={{ fontSize: "10px", letterSpacing: "0.2em", color: "#888", textTransform: "uppercase", marginBottom: "4px" }}>
                  J-Number
                </p>
                <p style={{ fontSize: "28px", fontWeight: 900, color: "#000", letterSpacing: "0.05em" }}>
                  {delivery.consignerJNumber}
                </p>
              </>
            )}
          </div>

          {/* ── Footer ── */}
          <div style={{ borderTop: "1px solid #e0e0e0", padding: "8px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: "9px", letterSpacing: "0.2em", color: "#bbb", textTransform: "uppercase" }}>FlowOps</p>
            <p style={{ fontSize: "9px", color: "#bbb" }}>{printDate}</p>
          </div>
        </div>
      </div>
    </>
  );
}
