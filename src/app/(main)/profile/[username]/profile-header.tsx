'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { FollowButton } from './follow-button';
import { Calendar, MapPin, Link as LinkIcon } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import type { Profile } from '@/types';

interface ProfileHeaderProps {
  profile: Profile;
  isOwnProfile: boolean;
  isFollowing: boolean;
  followRequestPending: boolean;
  isBlocked: boolean;
  isBlockedBy: boolean;
  showPrivateLock: boolean;
}

export function ProfileHeader({
  profile,
  isOwnProfile,
  isFollowing,
  followRequestPending,
  isBlocked,
  isBlockedBy,
  showPrivateLock,
}: ProfileHeaderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'media' | 'likes'>('posts');

  const handleFollowStateChange = () => {
    queryClient.invalidateQueries({ queryKey: ['profile'] });
  };

  const tabs = [
    { id: 'posts' as const, label: 'Posts' },
    { id: 'replies' as const, label: 'Replies' },
    { id: 'media' as const, label: 'Media' },
    { id: 'likes' as const, label: 'Likes' },
  ];

  return (
    <div>
      {!profile.cover_url && !showPrivateLock && !isBlockedBy && (
        <div className="h-48 w-full bg-gradient-to-br from-primary/20 to-primary/5" />
      )}

      {profile.cover_url && !isBlockedBy && (
        <div className="h-48 w-full bg-muted">
          <Image src={profile.cover_url} alt="" fill className="object-cover" />
        </div>
      )}

      <div className="px-4 pb-4">
        <div className="flex justify-between items-start -mt-16 mb-4">
          <Avatar className="h-32 w-32 border-4 border-background">
            <AvatarImage src={profile.avatar_url || undefined} alt={profile.username} />
            <AvatarFallback className="text-4xl">{profile.display_name[0]}</AvatarFallback>
          </Avatar>

          <div className="mt-16">
            {isOwnProfile ? (
              <Button variant="outline" onClick={() => router.push('/settings')}>
                Edit profile
              </Button>
            ) : !isBlockedBy ? (
              <FollowButton
                targetUserId={profile.id}
                targetUsername={profile.username}
                initialIsFollowing={isFollowing}
                initialIsPending={followRequestPending}
                initialIsBlocked={isBlocked}
                initialIsBlockedBy={isBlockedBy}
                onStateChange={handleFollowStateChange}
              />
            ) : null}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1">
            <h1 className="text-2xl font-bold">{profile.display_name}</h1>
            {profile.is_verified && (
              <span className="text-primary text-xl">✓</span>
            )}
          </div>
          <p className="text-muted-foreground">@{profile.username}</p>
        </div>

        {profile.bio && (
          <p className="mt-3 whitespace-pre-wrap">{profile.bio}</p>
        )}

        <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
          {profile.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {profile.location}
            </span>
          )}
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:underline text-primary"
            >
              <LinkIcon className="h-4 w-4" />
              {profile.website.replace(/^https?:\/\//, '')}
            </a>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
        </div>

        <div className="flex gap-5 mt-4">
          <span className="font-medium">
            <span className="font-bold">{formatNumber(profile.following_count)}</span>{' '}
            <span className="text-muted-foreground">Following</span>
          </span>
          <span className="font-medium">
            <span className="font-bold">{formatNumber(profile.followers_count)}</span>{' '}
            <span className="text-muted-foreground">Followers</span>
          </span>
        </div>
      </div>

      <div className="border-b">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-4 text-center font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
