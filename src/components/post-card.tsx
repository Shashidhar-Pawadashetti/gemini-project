'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Repeat2, Bookmark } from 'lucide-react';
import { formatRelativeTime, formatNumber } from '@/lib/utils';
import type { Post } from '@/types';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(post.is_liked_by_me ?? false);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [isLikeLoading, setIsLikeLoading] = useState(false);

  const handleLike = async () => {
    if (isLikeLoading) return;
    setIsLikeLoading(true);
    
    const previousLiked = isLiked;
    const previousCount = likesCount;
    
    setIsLiked(!isLiked);
    setLikesCount((prev) => (isLiked ? prev - 1 : prev + 1));

    try {
      const response = await fetch(`/api/posts/${post.id}/like`, {
        method: isLiked ? 'DELETE' : 'POST',
      });
      
      if (!response.ok) {
        setIsLiked(previousLiked);
        setLikesCount(previousCount);
      }
    } catch {
      setIsLiked(previousLiked);
      setLikesCount(previousCount);
    } finally {
      setIsLikeLoading(false);
    }
  };

  return (
    <article className="border-b p-4 hover:bg-accent/5 transition-colors">
      <div className="flex gap-3">
        <Link href={`/profile/${post.author?.username}`}>
          <Avatar className="h-12 w-12">
            <AvatarImage src={post.author?.avatar_url || undefined} alt={post.author?.username} />
            <AvatarFallback>{post.author?.display_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
        </Link>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/profile/${post.author?.username}`} className="font-bold hover:underline">
              {post.author?.display_name}
            </Link>
            <span className="text-muted-foreground">@{post.author?.username}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground text-sm">
              {formatRelativeTime(post.created_at)}
            </span>
          </div>

          <Link href={`/post/${post.id}`} className="block">
            <p className="mt-1 whitespace-pre-wrap">{post.content}</p>
          </Link>

          {post.media_urls && post.media_urls.length > 0 && (
            <div className={`mt-3 grid gap-2 ${
              post.media_urls.length === 1 ? 'grid-cols-1' :
              post.media_urls.length === 2 ? 'grid-cols-2' :
              'grid-cols-2'
            }`}>
              {post.media_urls.slice(0, 4).map((url, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                  <Image src={url} alt="" fill className="object-cover" />
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-3 max-w-md">
            <Link href={`/post/${post.id}`} className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm">{formatNumber(post.comments_count)}</span>
            </Link>

            <button
              onClick={handleLike}
              disabled={isLikeLoading}
              className={`flex items-center gap-1 transition-colors ${
                isLiked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'
              }`}
            >
              <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
              <span className="text-sm">{formatNumber(likesCount)}</span>
            </button>

            <button className="flex items-center gap-1 text-muted-foreground hover:text-green-500 transition-colors">
              <Repeat2 className="h-5 w-5" />
              <span className="text-sm">{formatNumber(post.reposts_count)}</span>
            </button>

            <button className="flex items-center gap-1 text-muted-foreground hover:text-blue-500 transition-colors">
              <Bookmark className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
