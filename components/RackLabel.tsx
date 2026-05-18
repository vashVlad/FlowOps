"use client";

import dynamic from "next/dynamic";
import type { Rack, Delivery } from "@/types";

const QRCodeSVG = dynamic(
  () => import("qrcode.react").then((m) => m.QRCodeSVG),
  { ssr: false }
);

export function RackLabel({
  rack,
  delivery,
  rackUrl,
  printDate,
}: {
  rack: Rack;
  delivery?: Delivery;
  rackUrl: string;
  printDate: string;
}) {
  return (
    <div
      className="w-full bg-white overflow-hidden"
      style={{
        maxWidth: "420px",
        border: "2px solid black",
        fontFamily: "'Courier New', Courier, monospace",
      }}
    >
      <div style={{ backgroundColor: "#000", padding: "20px 28px", textAlign: "center" }}>
        <p style={{ fontSize: "10px", letterSpacing: "0.2em", color: "#888", textTransform: "uppercase", marginBottom: "6px" }}>
          Rack ID
        </p>
        <p style={{ fontSize: "48px", fontWeight: 900, color: "#fff", letterSpacing: "-1px", lineHeight: 1 }}>
          {rack.rackCode}
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "center", padding: "32px 28px 28px", backgroundColor: "#fff" }}>
        {rackUrl ? (
          <QRCodeSVG value={rackUrl} size={280} level="H" marginSize={1} style={{ display: "block" }} />
        ) : (
          <div style={{ width: 280, height: 280, backgroundColor: "#f5f5f5" }} />
        )}
      </div>

      <div style={{ borderTop: "2px solid black", padding: "16px 28px" }}>
        <p style={{ fontSize: "10px", letterSpacing: "0.2em", color: "#888", textTransform: "uppercase", marginBottom: "4px" }}>
          Consigner
        </p>
        <p style={{
          fontSize: "18px", fontWeight: 700, color: "#000",
          marginBottom: delivery?.consignerJNumber ? "10px" : 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
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

      <div style={{ borderTop: "1px solid #e0e0e0", padding: "8px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: "9px", letterSpacing: "0.2em", color: "#bbb", textTransform: "uppercase" }}>FlowOps</p>
        <p style={{ fontSize: "9px", color: "#bbb" }}>{printDate}</p>
      </div>
    </div>
  );
}
