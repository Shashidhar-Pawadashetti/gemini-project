'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import type { FeedResponse, Post } from '@/types';

async function fetchFeed(cursor: string | null): Promise<FeedResponse> {
  const url = cursor
    ? `/api/feed?cursor=${encodeURIComponent(cursor)}`
    : '/api/feed';

  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch feed');
  return response.json();
}

export function useFeed() {
  const supabase = createBrowserSupabaseClient();

  return useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: async ({ pageParam }) => {
      return fetchFeed(pageParam as string | null);
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    initialPageParam: null as string | null,
    staleTime: 1000 * 60,
  });
}

export function useFeedOptimistic() {
  return {
    posts: [] as Post[],
    isLoading: true,
    isError: false,
    hasNextPage: false,
    fetchNextPage: async () => {},
    isFetchingNextPage: false,
  };
}
