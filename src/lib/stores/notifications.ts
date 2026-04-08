import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';

interface NotificationStore {
  unreadCount: number;
  incrementUnread: () => void;
  decrementUnread: (count?: number) => void;
  clearUnread: () => void;
  setUnreadCount: (count: number) => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    subscribeWithSelector((set) => ({
      unreadCount: 0,
      incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
      decrementUnread: (count = 1) => set((state) => ({ 
        unreadCount: Math.max(0, state.unreadCount - count) 
      })),
      clearUnread: () => set({ unreadCount: 0 }),
      setUnreadCount: (count) => set({ unreadCount: count }),
      reset: () => set({ unreadCount: 0 }),
    })),
    { name: 'notification-store' }
  )
);
