'use client';

import { useEffect, useRef, useCallback } from 'react';
import { type QueryClient } from '@tanstack/react-query';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import type { Post } from '@/types';

interface RealtimePostPayload {
  id: string;
  author_id: string;
  content: string | null;
  media_urls: string[];
  visibility: string;
  parent_post_id: string | null;
  repost_of_id: string | null;
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  views_count: number;
  created_at: string;
}

interface UseRealtimeFeedOptions {
  queryClient: QueryClient;
  enabled?: boolean;
}

const MAX_REALTIME_FILTERS = 50;

export function useRealtimeFeed({ queryClient, enabled = true }: UseRealtimeFeedOptions) {
  const supabase = createBrowserSupabaseClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const followedUserIdsRef = useRef<string[]>([]);

  const handleNewPost = useCallback(async (payload: { new: RealtimePostPayload }) => {
    const newPost = payload.new;
    if (!newPost.author_id) return;

    try {
      const response = await fetch(`/api/posts/${newPost.id}`);
      if (!response.ok) return;
      
      const { post } = await response.json() as { post: Post };
      
      queryClient.setQueryData(
        ['feed'],
        (old: { pages: { posts: Post[] }[] } | undefined) => {
          if (!old) return old;
          
          return {
            ...old,
            pages: old.pages.map((page, index) => {
              if (index === 0) {
                return {
                  ...page,
                  posts: [post, ...page.posts],
                };
              }
              return page;
            }),
          };
        }
      );
    } catch (error) {
      console.error('[RealtimeFeed] Error fetching post:', error);
    }
  }, [queryClient]);

  const setupChannel = useCallback(async (userIds: string[]) => {
    if (!enabled || userIds.length === 0) return;
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
    }

    const filters = userIds.slice(0, MAX_REALTIME_FILTERS).map(id => `author_id=eq.${id}`).join('|');
    
    const fallbackFilter = userIds.length > MAX_REALTIME_FILTERS 
      ? `author_id=eq.${userIds[0]}` 
      : filters;

    const channel = supabase
      .channel('realtime:feed:followed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
          filter: fallbackFilter,
        },
        handleNewPost
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[RealtimeFeed] Subscribed to new posts');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[RealtimeFeed] Channel error');
        }
      });

    channelRef.current = channel;
  }, [enabled, supabase, handleNewPost]);

  useEffect(() => {
    if (!enabled) return;

    async function fetchFollowedUsers() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: followers } = await supabase
        .from('followers')
        .select('followed_id')
        .eq('follower_id', user.id)
        .eq('relationship_state', 'active');

      const ids = (followers ?? []).map(f => f.followed_id);
      
      if (JSON.stringify(ids) !== JSON.stringify(followedUserIdsRef.current)) {
        followedUserIdsRef.current = ids;
        setupChannel(ids);
      }
    }

    fetchFollowedUsers();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, supabase, setupChannel]);
}
