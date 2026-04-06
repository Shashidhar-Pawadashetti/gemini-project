'use client';

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, UserPlus, Repeat2, AtSign, Bell } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import type { Notification } from '@/types';

interface NotificationItemProps {
  notification: Notification;
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const getIcon = () => {
    switch (notification.action_type) {
      case 'like':
        return <Heart className="h-5 w-5 fill-red-500 text-red-500" />;
      case 'comment':
      case 'reply':
        return <MessageCircle className="h-5 w-5 text-blue-500" />;
      case 'follow':
      case 'follow_request':
      case 'follow_approved':
        return <UserPlus className="h-5 w-5 text-green-500" />;
      case 'repost':
        return <Repeat2 className="h-5 w-5 text-green-500" />;
      case 'mention':
        return <AtSign className="h-5 w-5 text-purple-500" />;
      case 'system':
        return <Bell className="h-5 w-5 text-gray-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getMessage = () => {
    const actor = notification.payload?.actor_username || 'Someone';
    switch (notification.action_type) {
      case 'like':
        return `${actor} liked your post`;
      case 'comment':
        return `${actor} commented on your post`;
      case 'reply':
        return `${actor} replied to your comment`;
      case 'follow':
        return `${actor} started following you`;
      case 'follow_request':
        return `${actor} wants to follow you`;
      case 'follow_approved':
        return `${actor} approved your follow request`;
      case 'repost':
        return `${actor} reposted your post`;
      case 'mention':
        return `${actor} mentioned you`;
      case 'system':
        return notification.payload?.post_preview || 'System notification';
      default:
        return 'New notification';
    }
  };

  const href = notification.entity_type === 'post' && notification.entity_id
    ? `/post/${notification.entity_id}`
    : notification.payload?.actor_username
      ? `/profile/${notification.payload.actor_username}`
      : '#';

  const actorUsername = notification.payload?.actor_username;
  const actorAvatar = notification.payload?.actor_avatar_url;
  const actorInitial = actorUsername ? actorUsername[0].toUpperCase() : '?';

  return (
    <Link
      href={href}
      className={`flex items-start gap-3 p-4 hover:bg-accent transition-colors ${
        !notification.is_read ? 'bg-primary/5' : ''
      }`}
    >
      <div className="mt-1">
        {notification.action_type === 'system' ? (
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            {getIcon()}
          </div>
        ) : actorUsername && actorAvatar ? (
          <Avatar className="h-10 w-10">
            <AvatarImage src={actorAvatar || undefined} alt={actorUsername} />
            <AvatarFallback>{actorInitial}</AvatarFallback>
          </Avatar>
        ) : (
          <div className="w-10 h-10 rounded-full bg-muted" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {getIcon()}
          <p className="truncate">{getMessage()}</p>
        </div>
        {notification.payload?.post_preview && (
          <p className="text-sm text-muted-foreground mt-1 truncate">
            &quot;{notification.payload.post_preview}&quot;
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formatRelativeTime(notification.created_at)}
        </p>
      </div>

      {!notification.is_read && (
        <div className="w-2 h-2 rounded-full bg-primary mt-2" />
      )}
    </Link>
  );
}
