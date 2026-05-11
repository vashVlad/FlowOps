import { create } from "zustand";

export type ConnectionStatus = "connected" | "connecting" | "disconnected";

interface ConnectionStore {
  status:    ConnectionStatus;
  setStatus: (s: ConnectionStatus) => void;
}

export const useConnectionStore = create<ConnectionStore>()((set) => ({
  status:    "connecting",
  setStatus: (status) => set({ status }),
}));
