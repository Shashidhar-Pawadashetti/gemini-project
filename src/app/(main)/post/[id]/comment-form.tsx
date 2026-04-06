'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface CommentFormProps {
  postId: string;
}

export function CommentForm({ postId }: CommentFormProps) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError('Comment cannot be empty');
      return;
    }

    if (content.length > 500) {
      setError('Comment must be 500 characters or less');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to post comment');
      }

      setContent('');
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
    } catch {
      setError('Failed to post comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border-b p-4">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <Textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (error) setError('');
            }}
            placeholder="Post your reply..."
            className="resize-none min-h-[80px]"
            maxLength={500}
          />
          {error && (
            <p className="text-sm text-destructive mt-1">{error}</p>
          )}
          <div className="flex justify-between items-center mt-2">
            <span className={`text-xs ${content.length > 450 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {content.length}/500
            </span>
            <Button type="submit" disabled={isSubmitting || !content.trim()}>
              {isSubmitting ? 'Replying...' : 'Reply'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
