'use client';

import { useState } from 'react';
import Image from 'next/image';
import { PostCard } from '@/components/post-card';
import type { Post } from '@/types';

interface ProfilePostsProps {
  posts: Post[];
  isOwnProfile?: boolean;
}

export function ProfilePosts({ posts: initialPosts, isOwnProfile = false }: ProfilePostsProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);

  if (posts.length === 0 && !isOwnProfile) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-medium">No posts yet</p>
        <p className="text-muted-foreground mt-1">
          When they post, their posts will show up here.
        </p>
      </div>
    );
  }

  if (posts.length === 0 && isOwnProfile) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-medium">No posts yet</p>
        <p className="text-muted-foreground mt-1">
          When you post, your posts will show up here.
        </p>
      </div>
    );
  }

  const postsWithMedia = posts.filter(post => post.media_urls && post.media_urls.length > 0);
  const postsWithoutMedia = posts.filter(post => !post.media_urls || post.media_urls.length === 0);

  const gridPosts = postsWithMedia.slice(0, 12);
  const feedPosts = postsWithoutMedia;

  return (
    <div>
      {gridPosts.length > 0 && (
        <div className="grid grid-cols-3 gap-1">
          {gridPosts.map((post) => (
            <a
              key={post.id}
              href={`/post/${post.id}`}
              className="aspect-square bg-muted relative overflow-hidden"
            >
              {post.media_urls && post.media_urls[0] && (
                <Image
                  src={post.media_urls[0]}
                  alt=""
                  fill
                  className="object-cover hover:opacity-90 transition-opacity"
                />
              )}
              {post.media_urls && post.media_urls.length > 1 && (
                <div className="absolute top-2 right-2 bg-black/50 rounded-full p-1">
                  <span className="text-white text-xs">{post.media_urls.length}</span>
                </div>
              )}
            </a>
          ))}
        </div>
      )}

      {feedPosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
