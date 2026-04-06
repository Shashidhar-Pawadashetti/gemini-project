'use client';

import { Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PostCard } from '@/components/post-card';
import Link from 'next/link';
import type { Profile, Post, SearchResponse } from '@/types';
import { formatNumber } from '@/lib/utils';

interface SearchResultsProps {
  data: SearchResponse | null;
  isLoading: boolean;
  isError: boolean;
  query: string;
  searchType: 'all' | 'users' | 'posts' | 'tags';
}

export function SearchResults({ data, isLoading, isError, query, searchType }: SearchResultsProps) {
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
        <p className="text-destructive">Search failed. Please try again.</p>
      </div>
    );
  }

  if (!query || query.length < 2) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-medium">Search Pulse</p>
        <p className="text-muted-foreground mt-1">
          Find people, posts, and topics
        </p>
      </div>
    );
  }

  if (!data) return null;

  const hasResults =
    (searchType === 'all' || searchType === 'users') && data.users?.length > 0 ||
    (searchType === 'all' || searchType === 'posts') && data.posts?.length > 0 ||
    (searchType === 'all' || searchType === 'tags') && data.tags?.length > 0;

  if (!hasResults) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-medium">No results for &quot;{query}&quot;</p>
        <p className="text-muted-foreground mt-1">
          Try different keywords or check your spelling
        </p>
      </div>
    );
  }

  return (
    <div>
      {(searchType === 'all' || searchType === 'users') && data?.users && data.users.length > 0 && (
        <div>
          <h2 className="px-4 py-2 text-sm font-medium text-muted-foreground">People</h2>
          {data.users.map((user) => (
            <Link
              key={user.id}
              href={`/profile/${user.username}`}
              className="flex items-center gap-3 p-4 hover:bg-accent transition-colors"
            >
              <Avatar>
                <AvatarImage src={user.avatar_url || undefined} alt={user.username} />
                <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{user.username}</p>
                <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {formatNumber(user.followers_count)} followers
              </p>
            </Link>
          ))}
        </div>
      )}

      {(searchType === 'all' || searchType === 'posts') && data?.posts && data.posts.length > 0 && (
        <div>
          <h2 className="px-4 py-2 text-sm font-medium text-muted-foreground">Posts</h2>
          {data.posts.map((post) => (
            <PostCard key={post.id} post={post as Post} />
          ))}
        </div>
      )}

      {(searchType === 'all' || searchType === 'tags') && data.tags && data.tags.length > 0 && (
        <div>
          <h2 className="px-4 py-2 text-sm font-medium text-muted-foreground">Tags</h2>
          {data.tags.map((tag) => (
            <Link
              key={tag.tag}
              href={`/search?q=${encodeURIComponent(tag.tag)}&type=tags`}
              className="flex items-center gap-3 p-4 hover:bg-accent transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-bold">#</span>
              </div>
              <div>
                <p className="font-medium">#{tag.tag}</p>
                <p className="text-sm text-muted-foreground">{tag.post_count} posts</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
