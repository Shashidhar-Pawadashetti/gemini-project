'use client';

import { useEffect, useRef } from 'react';
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

export function useRealtimeFeed({ queryClient, enabled = true }: UseRealtimeFeedOptions) {
  const supabase = createBrowserSupabaseClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('realtime:public:posts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
          filter: 'visibility=eq.public',
        },
        async (payload) => {
          const newPost = payload.new as RealtimePostPayload;
          
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
  }, [enabled, queryClient, supabase]);
}
