'use client';

import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { formatRelativeTime } from '@/lib/utils';
import { useRealtimeMessages } from '@/lib/hooks/useRealtimeMessages';
import { useMessageStore } from '@/lib/stores/messages';
import type { Message } from '@/types';

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.id as string;
  const supabase = createBrowserSupabaseClient();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { clearConversation } = useMessageStore();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
    };
    getUser();
  }, [supabase.auth]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: async ({ pageParam }) => {
      const url = pageParam
        ? `/api/messages/${conversationId}?cursor=${encodeURIComponent(pageParam)}`
        : `/api/messages/${conversationId}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    initialPageParam: null as string | null,
  });

  useRealtimeMessages({
    queryClient,
    conversationId,
    currentUserId: currentUserId ?? '',
    enabled: !!currentUserId,
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(`/api/messages/${conversationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sendMessage.isPending) return;
    sendMessage.mutate(newMessage.trim());
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data]);

  useEffect(() => {
    clearConversation(conversationId);
  }, [conversationId, clearConversation]);

  const messages = data?.pages.flatMap(page => page.messages).reverse() || [];

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="border-b p-4 flex items-center gap-4">
        <Link href="/messages" className="hover:opacity-70">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold">Conversation</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {hasNextPage && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Load more'
              )}
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message: Message) => (
            <div
              key={message.id}
              className={`flex gap-2 ${message.sender_id === currentUserId ? 'flex-row-reverse' : ''}`}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={message.sender?.avatar_url || undefined} alt="" />
                <AvatarFallback>{message.sender?.display_name?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <div className={`max-w-[70%] ${message.sender_id === currentUserId ? 'text-right' : ''}`}>
                <div className={`inline-block px-4 py-2 rounded-lg ${
                  message.sender_id === currentUserId
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}>
                  <p>{message.content}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatRelativeTime(message.created_at)}
                  {message.sender_id === currentUserId && message.state === 'read' && ' · Read'}
                  {message.sender_id === currentUserId && message.state === 'delivered' && ' · Delivered'}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="border-t p-4 flex gap-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          maxLength={2000}
          disabled={sendMessage.isPending}
        />
        <Button type="submit" disabled={!newMessage.trim() || sendMessage.isPending}>
          {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
        </Button>
      </form>
    </div>
  );
}
