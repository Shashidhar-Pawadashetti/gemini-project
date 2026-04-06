'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { CommentForm } from './comment-form';
import type { Comment } from '@/types';

interface CommentListProps {
  comments: (Comment & { replies?: Comment[] })[];
  postId: string;
}

export function CommentList({ comments, postId }: CommentListProps) {
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  if (comments.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No replies yet. Be the first to reply!
      </div>
    );
  }

  return (
    <div>
      {comments.map(comment => (
        <div key={comment.id} className="border-b">
          <div className="flex gap-3 p-4">
            <Link href={`/profile/${comment.author?.username}`}>
              <Avatar className="h-10 w-10">
                <AvatarImage src={comment.author?.avatar_url || undefined} alt={comment.author?.username} />
                <AvatarFallback>{comment.author?.display_name?.[0] || 'U'}</AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Link href={`/profile/${comment.author?.username}`} className="font-bold hover:underline">
                  {comment.author?.display_name}
                </Link>
                <span className="text-sm text-muted-foreground">
                  @{comment.author?.username}
                </span>
                <span className="text-sm text-muted-foreground">·</span>
                <span className="text-sm text-muted-foreground">
                  {formatRelativeTime(comment.created_at)}
                </span>
              </div>
              <p className="mt-1">{comment.content}</p>
              <div className="flex items-center gap-4 mt-2">
                <button 
                  onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span className="text-xs">Reply</span>
                </button>
                <button className="flex items-center gap-1 text-muted-foreground hover:text-red-500 transition-colors">
                  <Heart className={`h-4 w-4 ${likedComments.has(comment.id) ? 'fill-current text-red-500' : ''}`} />
                  <span className="text-xs">{comment.likes_count}</span>
                </button>
              </div>
            </div>
          </div>

          {replyingTo === comment.id && (
            <div className="ml-12 pr-4 pb-4">
              <CommentForm 
                postId={postId} 
                parentCommentId={comment.id}
                onSuccess={() => setReplyingTo(null)}
              />
            </div>
          )}

          {comment.replies && comment.replies.length > 0 && (
            <div className="ml-12 border-l-2 pl-4">
              {comment.replies.map(reply => (
                <div key={reply.id} className="flex gap-3 py-3">
                  <Link href={`/profile/${reply.author?.username}`}>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={reply.author?.avatar_url || undefined} alt={reply.author?.username} />
                      <AvatarFallback>{reply.author?.display_name?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/profile/${reply.author?.username}`} className="font-bold text-sm hover:underline">
                        {reply.author?.display_name}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        @{reply.author?.username}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(reply.created_at)}
                      </span>
                    </div>
                    <p className="text-sm mt-0.5">{reply.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
