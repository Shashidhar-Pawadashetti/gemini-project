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
      let postsQuery = supabase
        .from('posts')
        .select(`
          id, content, likes_count, created_at, visibility,
          author:profiles!author_id(id, username, display_name, avatar_url, is_verified)
        `)
        .textSearch('search_vector', query, { type: 'websearch' })
        .order('created_at', { ascending: false })
        .limit(limit);

      const { data: posts } = await postsQuery;

      let filteredPosts = posts || [];

      if (user) {
        const { data: followedIds } = await supabase
          .from('followers')
          .select('followed_id')
          .eq('follower_id', user.id)
          .eq('relationship_state', 'active');

        const followedSet = new Set(followedIds?.map((f: { followed_id: string }) => f.followed_id) || []);
        const currentUserId = user.id;

        filteredPosts = (posts || []).filter((post: Record<string, unknown>) => {
          const author = post.author as Record<string, unknown> | undefined;
          const postVisibility = post.visibility as string;
          const authorId = author?.id as string | undefined;
          
          if (postVisibility === 'public') return true;
          if (authorId === currentUserId) return true;
          if (authorId && followedSet.has(authorId)) return true;
          return false;
        });
      } else {
        filteredPosts = (posts || []).filter((post: Record<string, unknown>) => 
          post.visibility === 'public'
        );
      }

      results.posts = filteredPosts;
    }

    if (type === 'all' || type === 'tags') {
      const { data: postsWithTags } = await supabase
        .from('posts')
        .select('content')
        .textSearch('search_vector', query, { type: 'websearch' })
        .eq('visibility', 'public')
        .limit(100);

      const tagCounts: Record<string, number> = {};
      
      (postsWithTags || []).forEach((post: Record<string, unknown>) => {
        const content = post.content as string | null;
        if (content) {
          const tags = content.match(/#[a-zA-Z0-9_]+/g) || [];
          tags.forEach((tag: string) => {
            const normalizedTag = tag.toLowerCase();
            if (normalizedTag.includes(query.toLowerCase())) {
              tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1;
            }
          });
        }
      });

      const tags = Object.entries(tagCounts)
        .map(([tag, postCount]) => ({ tag, post_count: postCount }))
        .sort((a, b) => b.post_count - a.post_count)
        .slice(0, limit);

      results.tags = tags;
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
