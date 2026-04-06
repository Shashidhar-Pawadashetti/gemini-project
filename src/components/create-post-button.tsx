'use client';

import { PenSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CreatePostButtonProps {
  onClick?: () => void;
}

export function CreatePostButton({ onClick }: CreatePostButtonProps) {
  return (
    <Button
      size="lg"
      className="w-full rounded-full font-semibold text-lg h-12"
      onClick={onClick}
    >
      <PenSquare className="h-5 w-5 mr-2" />
      Post
    </Button>
  );
}
