'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Repeat2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Post } from '@/types';

interface RepostModalProps {
  post: Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RepostModal({ post, open, onOpenChange }: RepostModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSimpleRepost = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/posts/repost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          post_id: post.id, 
          visibility: 'public' 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to repost');
      }

      toast.success('Post reposted');
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      onOpenChange(false);
    } catch {
      toast.error('Failed to repost');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuotePost = async () => {
    if (!content.trim()) {
      toast.error('Please add some text for your quote');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/posts/repost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          post_id: post.id, 
          content: content.trim(),
          visibility: 'public' 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create quote post');
      }

      toast.success('Quote post created');
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      onOpenChange(false);
      setContent('');
    } catch {
      toast.error('Failed to create quote post');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Repost</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {post.author && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">@{post.author.username}</span>
              <span>·</span>
              <span>{post.content?.slice(0, 50)}...</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleSimpleRepost}
              disabled={isSubmitting}
              variant="outline"
              className="flex-1"
            >
              <Repeat2 className="h-4 w-4 mr-2" />
              Repost
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or add to your post</span>
            </div>
          </div>

          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a comment..."
            className="resize-none min-h-[100px]"
            maxLength={500}
          />
          
          <div className="flex justify-between items-center">
            <span className={`text-xs ${
              content.length > 450 ? 'text-orange-500' : 'text-muted-foreground'
            }`}>
              {content.length}/500
            </span>
            <Button
              onClick={handleQuotePost}
              disabled={isSubmitting || !content.trim()}
            >
              {isSubmitting ? 'Posting...' : 'Quote'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}