'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { NotificationItem } from './notification-item';
import { Loader2 } from 'lucide-react';
import { useRealtimeNotifications } from '@/lib/hooks/useRealtimeNotifications';
import { useNotificationStore } from '@/lib/stores/notifications';
import type { Notification } from '@/types';

interface NotificationsListProps {
  initialNotifications: Notification[];
  userId: string;
}

export function NotificationsList({ initialNotifications, userId }: NotificationsListProps) {
  const supabase = createBrowserSupabaseClient();
  const queryClient = useQueryClient();
  const { setUnreadCount, clearUnread } = useNotificationStore();

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await fetch('/api/notifications');
      if (!response.ok) throw new Error('Failed to fetch notifications');
      const data = await response.json();
      return data.notifications as Notification[];
    },
    initialData: initialNotifications,
  });

  useRealtimeNotifications({ queryClient, userId });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await fetch('/api/notifications', { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      clearUnread();
    },
  });

  useEffect(() => {
    const unreadCount = notifications?.filter(n => !n.is_read).length || 0;
    setUnreadCount(unreadCount);
  }, [notifications, setUnreadCount]);

  if (!notifications || notifications.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-medium">No notifications yet</p>
        <p className="text-muted-foreground mt-1">
          When someone interacts with your content, you&apos;ll see it here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {notifications.map(notification => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}
    </div>
  );
}
