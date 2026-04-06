import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limit = parseInt(searchParams.get('limit') || '20');

    let query = supabase
      .from('feeds')
      .select(`
        created_at,
        post:posts!inner(
          *,
          author:profiles!author_id(id, username, display_name, avatar_url, is_verified),
          post_likes(user_id)
        )
      `)
      .eq('owner_id', user?.id ?? '')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: feedItems, error } = await query;

    if (error) {
      console.error('[API /feed GET]:', error);
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'Failed to fetch feed', status: 500 },
        { status: 500 }
      );
    }

    const posts = (feedItems ?? []).map((item: Record<string, unknown>) => {
      const post = item.post as Record<string, unknown>;
      const postLikes = post.post_likes as { user_id: string }[] | undefined;
      return {
        ...post,
        is_liked_by_me: postLikes?.some((like) => user && like.user_id === user.id) ?? false,
        post_likes: undefined,
      };
    });

    const nextCursor = feedItems && feedItems.length === limit 
      ? (feedItems[feedItems.length - 1] as Record<string, unknown>).created_at as string
      : null;

    return NextResponse.json({
      posts,
      next_cursor: nextCursor,
    });
  } catch (error) {
    console.error('[API /feed GET]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}
