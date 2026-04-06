import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Username is required', status: 400 },
        { status: 400 }
      );
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, bio, avatar_url, cover_url, location, website, is_private, is_verified, followers_count, following_count, posts_count, created_at')
      .eq('username', username.toLowerCase())
      .single();

    if (error || !profile) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Profile not found', status: 404 },
        { status: 404 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    
    let isFollowing = false;
    let isFollower = false;
    let followRequestPending = false;

    if (user && user.id !== profile.id) {
      const { data: relationship } = await supabase
        .from('followers')
        .select('relationship_state')
        .eq('follower_id', user.id)
        .eq('followed_id', profile.id)
        .maybeSingle();

      isFollowing = relationship?.relationship_state === 'active';
      followRequestPending = relationship?.relationship_state === 'pending';

      const { data: followerRelationship } = await supabase
        .from('followers')
        .select('relationship_state')
        .eq('follower_id', profile.id)
        .eq('followed_id', user.id)
        .maybeSingle();

      isFollower = followerRelationship?.relationship_state === 'active';
    }

    const { data: posts } = await supabase
      .from('posts')
      .select('id, content, media_urls, likes_count, comments_count, reposts_count, created_at')
      .eq('author_id', profile.id)
      .eq('visibility', 'public')
      .is('parent_post_id', null)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      profile,
      posts: posts || [],
      is_following: isFollowing,
      is_follower: isFollower,
      follow_request_pending: followRequestPending,
    });
  } catch (error) {
    console.error('[API /profile GET]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}
