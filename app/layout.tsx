import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import AuthGuard from "@/components/AuthGuard";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import StoreHydrator from "@/components/StoreHydrator";
import StuckMonitor from "@/components/StuckMonitor";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import Toaster from "@/components/Toaster";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FlowOps",
  description: "Warehouse flow management",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FlowOps",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#c2410c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-stone-100 font-sans">
        <AuthGuard>
          <StoreHydrator />
          <StuckMonitor />
          <KeyboardShortcuts />
          <Header />
          <main className="flex flex-1 flex-col pb-16 sm:pb-0">
            <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-10">
              {children}
            </div>
          </main>
          <BottomNav />
          <Toaster />
        </AuthGuard>
      </body>
    </html>
  );
}
