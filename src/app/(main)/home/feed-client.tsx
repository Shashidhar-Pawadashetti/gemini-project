'use client';

import { useEffect, useCallback } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { PostCard } from '@/components/post-card';
import { Loader2 } from 'lucide-react';
import { useRealtimeFeed } from '@/lib/hooks/useRealtimeFeed';
import type { Post, FeedResponse } from '@/types';

export function HomeFeed() {
  const queryClient = useQueryClient();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: async ({ pageParam }) => {
      const url = pageParam 
        ? `/api/feed?cursor=${encodeURIComponent(pageParam)}`
        : '/api/feed';
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch feed');
      return response.json() as Promise<FeedResponse>;
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    initialPageParam: null as string | null,
  });

  useRealtimeFeed({ queryClient });

  const handleScroll = useCallback(() => {
    if (
      !isFetchingNextPage &&
      hasNextPage &&
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 300
    ) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-center">
        <p className="text-destructive">Failed to load feed</p>
      </div>
    );
  }

  const posts = data?.pages.flatMap(page => page.posts) ?? [];

  if (posts.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-medium">Your feed is empty</p>
        <p className="text-muted-foreground mt-1">
          Follow some people to see their posts here
        </p>
      </div>
    );
  }

  return (
    <div>
      {posts.map((post: Post) => (
        <PostCard key={post.id} post={post} />
      ))}
      
      {isFetchingNextPage && (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
