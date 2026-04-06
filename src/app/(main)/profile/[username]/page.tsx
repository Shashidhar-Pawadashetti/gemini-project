import { createServerSupabaseClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ProfileHeader } from './profile-header';
import { ProfilePosts } from './profile-posts';
import { Lock } from 'lucide-react';
import type { Profile, Post } from '@/types';

interface ProfilePageProps {
  params: { username: string };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profileData, error } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      display_name,
      bio,
      avatar_url,
      cover_url,
      location,
      website,
      is_private,
      is_verified,
      followers_count,
      following_count,
      posts_count,
      created_at
    `)
    .eq('username', params.username.toLowerCase())
    .single();

  if (error || !profileData) {
    notFound();
  }

  const profile = profileData as Profile;
  const isOwnProfile = user?.id === profile.id;

  let isFollowing = false;
  let followRequestPending = false;
  let isBlocked = false;
  let isBlockedBy = false;

  if (user && user.id !== profile.id) {
    const { data: relationship } = await supabase
      .from('followers')
      .select('relationship_state')
      .eq('follower_id', user.id)
      .eq('followed_id', profile.id)
      .maybeSingle();

    isFollowing = relationship?.relationship_state === 'active';
    followRequestPending = relationship?.relationship_state === 'pending';

    const { data: blockRelationship } = await supabase
      .from('followers')
      .select('relationship_state')
      .eq('follower_id', user.id)
      .eq('followed_id', profile.id)
      .eq('relationship_state', 'blocked')
      .maybeSingle();

    isBlocked = !!blockRelationship;

    const { data: blockedByRelationship } = await supabase
      .from('followers')
      .select('relationship_state')
      .eq('follower_id', profile.id)
      .eq('followed_id', user.id)
      .eq('relationship_state', 'blocked')
      .maybeSingle();

    isBlockedBy = !!blockedByRelationship;
  }

  const showPrivateLock = profile.is_private && !isOwnProfile && !isFollowing;
  const showContent = !showPrivateLock && !isBlockedBy;

  let posts: Post[] = [];
  if (showContent) {
    const { data: postsData } = await supabase
      .from('posts')
      .select(`
        id,
        author_id,
        content,
        media_urls,
        visibility,
        parent_post_id,
        repost_of_id,
        likes_count,
        comments_count,
        reposts_count,
        views_count,
        created_at,
        author:profiles!author_id(
          id,
          username,
          display_name,
          avatar_url,
          is_verified
        )
      `)
      .eq('author_id', profile.id)
      .is('parent_post_id', null)
      .order('created_at', { ascending: false })
      .limit(20);

    posts = (postsData ?? []).map((post: Record<string, unknown>) => ({
      ...post,
      media_urls: (post.media_urls as string[]) ?? [],
    })) as Post[];
  }

  return (
    <div>
      <ProfileHeader
        profile={profile}
        isOwnProfile={isOwnProfile}
        isFollowing={isFollowing}
        followRequestPending={followRequestPending}
        isBlocked={isBlocked}
        isBlockedBy={isBlockedBy}
        showPrivateLock={showPrivateLock}
      />

      {showPrivateLock && (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <Lock className="h-12 w-12 mb-4 text-muted-foreground" />
          <h2 className="text-xl font-bold mb-2">This account is private</h2>
          <p className="text-muted-foreground max-w-sm">
            Follow @{profile.username} to see their posts and more info.
          </p>
        </div>
      )}

      {isBlockedBy && (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <h2 className="text-xl font-bold mb-2">Cannot view this profile</h2>
          <p className="text-muted-foreground max-w-sm">
            You have been blocked by this user or this profile is not available.
          </p>
        </div>
      )}

      {showContent && (
        <ProfilePosts posts={posts} isOwnProfile={isOwnProfile} />
      )}
    </div>
  );
}
