import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const type = searchParams.get('type') || 'all';
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Query must be at least 2 characters', status: 400 },
        { status: 400 }
      );
    }

    const results: {
      users: unknown[];
      posts: unknown[];
      tags: unknown[];
    } = {
      users: [],
      posts: [],
      tags: [],
    };

    if (type === 'all' || type === 'users') {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_verified, followers_count')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .order('followers_count', { ascending: false })
        .limit(limit);

      if (user) {
        const { data: blockedUsers } = await supabase
          .from('followers')
          .select('followed_id')
          .eq('follower_id', user.id)
          .eq('relationship_state', 'blocked');

        const blockedIds = blockedUsers?.map(b => b.followed_id) || [];
        results.users = users?.filter(u => !blockedIds.includes(u.id)) || [];
      } else {
        results.users = users || [];
      }
    }

    if (type === 'all' || type === 'posts') {
      const { data: posts } = await supabase
        .from('posts')
        .select(`
          id, content, likes_count, created_at,
          author:profiles!author_id(id, username, display_name, avatar_url, is_verified)
        `)
        .textSearch('search_vector', query, { type: 'websearch' })
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(limit);

      results.posts = posts || [];
    }

    if (type === 'all' || type === 'tags') {
      const { data: tags } = await supabase
        .from('interest_tags')
        .select('tag')
        .ilike('tag', `%${query}%`)
        .limit(limit);

      results.tags = tags?.map(t => ({ tag: t.tag, post_count: 0 })) || [];
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('[API /search GET]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}
