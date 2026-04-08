'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

type CommentState =
  | 'idle'
  | 'composing'
  | 'submitting'
  | 'success'
  | 'error_too_long'
  | 'error_empty'
  | 'error_network';

interface CommentFormProps {
  postId: string;
  parentCommentId?: string;
  onSuccess?: () => void;
}

export function CommentForm({ postId, parentCommentId, onSuccess }: CommentFormProps) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [state, setState] = useState<CommentState>('idle');

  const errorId = state === 'error_empty' || state === 'error_too_long' ? 'comment-error' : undefined;
  const charCountId = 'comment-char-count';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setState('error_empty');
      toast.error('Comment cannot be empty');
      return;
    }

    if (content.length > 500) {
      setState('error_too_long');
      toast.error('Comment must be 500 characters or less');
      return;
    }

    setState('submitting');
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: content.trim(),
          ...(parentCommentId && { parent_comment_id: parentCommentId })
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to post comment');
      }

      setContent('');
      setState('success');
      toast.success(parentCommentId ? 'Reply posted' : 'Comment posted');
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      onSuccess?.();
    } catch {
      setState('error_network');
      toast.error('Failed to post comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border-b p-4">
      {parentCommentId && (
        <p className="text-xs text-muted-foreground mb-2">
          Replying to comment...
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          {errorId && (
            <p id="comment-error" className="text-sm text-destructive mb-2" role="alert">
              {state === 'error_empty' ? 'Comment cannot be empty' : 'Comment must be 500 characters or less'}
            </p>
          )}
          <Textarea
            id={parentCommentId ? `reply-${parentCommentId}` : `comment-${postId}`}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (state === 'error_empty' || state === 'error_too_long') {
                setState('composing');
              }
            }}
            placeholder={parentCommentId ? "Write a reply..." : "Post your reply..."}
            className="resize-none min-h-[80px]"
            maxLength={500}
            aria-describedby={errorId || charCountId}
            aria-invalid={!!errorId}
          />
          <div className="flex justify-between items-center mt-2">
            <span 
              id={charCountId}
              className={`text-xs ${
                content.length > 450 
                  ? state === 'error_too_long' 
                    ? 'text-destructive font-bold' 
                    : 'text-orange-500'
                  : 'text-muted-foreground'
              }`}
              aria-live="polite"
            >
              {content.length}/500
            </span>
            <Button 
              type="submit" 
              disabled={isSubmitting || !content.trim() || content.length > 500}
            >
              {isSubmitting 
                ? parentCommentId ? 'Replying...' : 'Posting...'
                : parentCommentId ? 'Reply' : 'Post'
              }
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
