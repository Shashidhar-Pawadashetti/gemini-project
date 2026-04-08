'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Repeat2, Bookmark, Quote } from 'lucide-react';
import { formatRelativeTime, formatNumber } from '@/lib/utils';
import { toast } from 'sonner';
import { RepostModal } from './repost-modal';
import type { Post } from '@/types';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const queryClient = useQueryClient();
  const supabase = createBrowserSupabaseClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(post.is_liked_by_me ?? false);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [isRepostModalOpen, setIsRepostModalOpen] = useState(false);

  useEffect(() => {
    async function getCurrentUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
    }
    getCurrentUser();
  }, [supabase]);

  const isOwnPost = currentUserId === post.author_id;

  const handleLike = async () => {
    if (isLikeLoading || isOwnPost) return;
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
        toast.error(isLiked ? 'Failed to unlike post' : 'Failed to like post');
      }
    } catch {
      setIsLiked(previousLiked);
      setLikesCount(previousCount);
      toast.error('Failed to update like');
    } finally {
      setIsLikeLoading(false);
    }
  };

  const openRepostModal = () => {
    setIsRepostModalOpen(true);
  };

  return (
    <article className="border-b p-4 hover:bg-accent/5 transition-colors">
      <RepostModal 
        post={post} 
        open={isRepostModalOpen} 
        onOpenChange={setIsRepostModalOpen} 
      />
      <div className="flex gap-3">
        <Link href={`/profile/${post.author?.username}`}>
          <Avatar className="h-12 w-12">
            <AvatarImage src={post.author?.avatar_url || undefined} alt={post.author?.username} />
            <AvatarFallback>{post.author?.display_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
        </Link>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 md:gap-2 truncate overflow-hidden">
            <Link href={`/profile/${post.author?.username}`} className="font-bold hover:underline truncate">
              {post.author?.display_name}
            </Link>
            <span className="text-muted-foreground shrink-0">@{post.author?.username}</span>
            <span className="text-muted-foreground shrink-0">·</span>
            <span className="text-muted-foreground text-sm shrink-0">
              {formatRelativeTime(post.created_at)}
            </span>
          </div>

          <Link href={`/post/${post.id}`} className="block">
            <p className="mt-1 whitespace-pre-wrap break-words">{post.content}</p>
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
              disabled={isLikeLoading || isOwnPost}
              className={`flex items-center gap-1 transition-colors ${
                isOwnPost 
                  ? 'text-muted-foreground cursor-not-allowed opacity-50' 
                  : isLiked 
                    ? 'text-red-500' 
                    : 'text-muted-foreground hover:text-red-500'
              }`}
            >
              <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
              <span className="text-sm">{formatNumber(likesCount)}</span>
            </button>

            <button 
              onClick={openRepostModal}
              className="flex items-center gap-1 text-muted-foreground hover:text-green-500 transition-colors"
            >
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