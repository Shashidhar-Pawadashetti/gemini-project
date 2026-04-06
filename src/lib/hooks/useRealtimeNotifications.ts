'use client';

import { useEffect, useRef } from 'react';
import { type QueryClient } from '@tanstack/react-query';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useNotificationStore } from '@/lib/stores/notifications';
import type { Notification } from '@/types';

interface RealtimeNotificationPayload {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

interface UseRealtimeNotificationsOptions {
  queryClient: QueryClient;
  userId: string;
  enabled?: boolean;
}

export function useRealtimeNotifications({
  queryClient,
  userId,
  enabled = true,
}: UseRealtimeNotificationsOptions) {
  const supabase = createBrowserSupabaseClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { incrementUnread } = useNotificationStore();

  useEffect(() => {
    if (!enabled || !userId) return;

    const channel = supabase
      .channel('realtime:public:notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        async (payload) => {
          const newNotification = payload.new as RealtimeNotificationPayload;
          
          queryClient.setQueryData(
            ['notifications'],
            (old: Notification[] | undefined) => {
              if (!old) return old;
              
              const notification: Notification = {
                id: newNotification.id,
                recipient_id: newNotification.recipient_id,
                actor_id: newNotification.actor_id,
                action_type: newNotification.action_type as Notification['action_type'],
                entity_type: newNotification.entity_type,
                entity_id: newNotification.entity_id,
                payload: newNotification.payload as Notification['payload'],
                is_read: newNotification.is_read,
                created_at: newNotification.created_at,
              };
              
              if (!newNotification.is_read) {
                incrementUnread();
              }
              
              return [notification, ...old];
            }
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const updatedNotification = payload.new as RealtimeNotificationPayload;
          
          queryClient.setQueryData(
            ['notifications'],
            (old: Notification[] | undefined) => {
              if (!old) return old;
              
              return old.map((notification) =>
                notification.id === updatedNotification.id
                  ? { ...notification, is_read: updatedNotification.is_read }
                  : notification
              );
            }
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, queryClient, supabase, userId, incrementUnread]);
}
