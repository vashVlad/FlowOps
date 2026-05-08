import { create } from "zustand";

export interface AppNotification {
  id:        string;
  type:      "stuck" | "bottleneck";
  message:   string;
  rackId?:   string;
  rackCode?: string;
  timestamp: string;
  read:      boolean;
}

interface NotificationsStore {
  notifications:  AppNotification[];
  notifiedKeys:   Set<string>;          // tracks rackId+status combos already notified
  addNotification: (n: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
  markAllRead:     () => void;
  dismiss:         (id: string) => void;
  trackKey:        (key: string) => void;
  hasKey:          (key: string) => boolean;
}

export const useNotificationsStore = create<NotificationsStore>()((set, get) => ({
  notifications: [],
  notifiedKeys:  new Set(),

  addNotification: (n) => {
    const notification: AppNotification = {
      ...n,
      id:        crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      read:      false,
    };
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 50),
    }));
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
  },

  dismiss: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  trackKey: (key) => {
    set((state) => {
      const next = new Set(state.notifiedKeys);
      next.add(key);
      return { notifiedKeys: next };
    });
  },

  hasKey: (key) => get().notifiedKeys.has(key),
}));
