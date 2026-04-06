import { create } from 'zustand';

interface MessageStore {
  unreadConversations: Record<string, number>;
  incrementUnread: (conversationId: string) => void;
  decrementUnread: (conversationId: string, count?: number) => void;
  clearConversation: (conversationId: string) => void;
  setUnreadCount: (conversationId: string, count: number) => void;
  getTotalUnread: () => number;
}

export const useMessageStore = create<MessageStore>((set, get) => ({
  unreadConversations: {},
  
  incrementUnread: (conversationId) => set((state) => ({
    unreadConversations: {
      ...state.unreadConversations,
      [conversationId]: (state.unreadConversations[conversationId] || 0) + 1,
    },
  })),
  
  decrementUnread: (conversationId, count = 1) => set((state) => ({
    unreadConversations: {
      ...state.unreadConversations,
      [conversationId]: Math.max(0, (state.unreadConversations[conversationId] || 0) - count),
    },
  })),
  
  clearConversation: (conversationId) => set((state) => {
    const { [conversationId]: _, ...rest } = state.unreadConversations;
    return { unreadConversations: rest };
  }),
  
  setUnreadCount: (conversationId, count) => set((state) => ({
    unreadConversations: {
      ...state.unreadConversations,
      [conversationId]: count,
    },
  })),
  
  getTotalUnread: () => {
    const conversations = get().unreadConversations;
    return Object.values(conversations).reduce((sum, count) => sum + count, 0);
  },
}));
