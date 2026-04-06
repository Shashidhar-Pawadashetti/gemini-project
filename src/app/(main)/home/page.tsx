import { HomeFeed } from './feed-client';
import { PostComposer } from '@/components/post-composer';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';

export default async function HomePage() {
  return (
    <div className="divide-y divide-border">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
        <h1 className="text-xl font-bold p-4">Home</h1>
      </div>
      
      <PostComposer 
        placeholder="What's happening?" 
      />
      
      <HomeFeed />
    </div>
  );
}
