'use client';

import { useEffect, useRef, useCallback } from 'react';
import { type QueryClient } from '@tanstack/react-query';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useMessageStore } from '@/lib/stores/messages';
import type { Message } from '@/types';

interface RealtimeMessagePayload {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  state: string;
  created_at: string;
}

interface UseRealtimeMessagesOptions {
  queryClient: QueryClient;
  conversationId: string;
  currentUserId: string;
  enabled?: boolean;
}

export function useRealtimeMessages({
  queryClient,
  conversationId,
  currentUserId,
  enabled = true,
}: UseRealtimeMessagesOptions) {
  const supabase = createBrowserSupabaseClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  const { incrementUnread, clearConversation } = useMessageStore(
    useCallback((state) => ({
      incrementUnread: state.incrementUnread,
      clearConversation: state.clearConversation,
    }), [])
  );

  const handleInsert = useCallback((payload: { new: RealtimeMessagePayload }) => {
    const newMessage = payload.new;
    
    queryClient.setQueryData(
      ['messages', conversationId],
      (old: { pages: { messages: Message[] }[] } | undefined) => {
        if (!old) return old;
        
        const message: Message = {
          id: newMessage.id,
          conversation_id: newMessage.conversation_id,
          sender_id: newMessage.sender_id,
          content: newMessage.content,
          state: newMessage.state as Message['state'],
          created_at: newMessage.created_at,
        };
        
        if (newMessage.sender_id !== currentUserId) {
          incrementUnread(conversationId);
        }
        
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            messages: [...page.messages, message],
          })),
        };
      }
    );
  }, [conversationId, currentUserId, queryClient, incrementUnread]);

  const handleUpdate = useCallback((payload: { new: RealtimeMessagePayload }) => {
    const updatedMessage = payload.new;
    
    queryClient.setQueryData(
      ['messages', conversationId],
      (old: { pages: { messages: Message[] }[] } | undefined) => {
        if (!old) return old;
        
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            messages: page.messages.map((message) =>
              message.id === updatedMessage.id
                ? { ...message, state: updatedMessage.state as Message['state'] }
                : message
            ),
          })),
        };
      }
    );
  }, [conversationId, queryClient]);

  useEffect(() => {
    if (!enabled || !conversationId) return;

    clearConversation(conversationId);

    const channel = supabase
      .channel(`realtime:messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        handleInsert
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        handleUpdate
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, supabase, conversationId, handleInsert, handleUpdate, clearConversation]);
}
