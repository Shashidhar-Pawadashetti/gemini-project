'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import type { Profile } from '@/types';

interface Conversation {
  id: string;
  other_user: Profile;
  last_message_at: string;
}

interface ConversationsListProps {
  initialConversations: Conversation[];
  currentUserId: string;
}

export function ConversationsList({ initialConversations, currentUserId }: ConversationsListProps) {
  const [showNewMessage, setShowNewMessage] = useState(false);

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const response = await fetch('/api/messages');
      if (!response.ok) throw new Error('Failed to fetch conversations');
      const data = await response.json();
      return data.conversations as Conversation[];
    },
    initialData: initialConversations,
  });

  if (!conversations || conversations.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-medium">No messages yet</p>
        <p className="text-muted-foreground mt-1">
          Start a conversation with someone
        </p>
        <Button className="mt-4" onClick={() => setShowNewMessage(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Message
        </Button>
      </div>
    );
  }

  return (
    <div>
      {conversations.map((conversation: Conversation) => (
        <Link
          key={conversation.id}
          href={`/messages/${conversation.id}`}
          className="flex items-center gap-3 p-4 hover:bg-accent transition-colors"
        >
          <Avatar>
            <AvatarImage src={conversation.other_user?.avatar_url || undefined} alt={conversation.other_user?.username} />
            <AvatarFallback>
              {conversation.other_user?.display_name?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {conversation.other_user?.display_name || 'Unknown User'}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              @{conversation.other_user?.username || 'unknown'}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatRelativeTime(conversation.last_message_at)}
          </p>
        </Link>
      ))}
    </div>
  );
}
