import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface FeedItem {
  created_at: string;
  post: Record<string, unknown>;
}

interface PostWithAuthor {
  id: string;
  author_id: string;
  content: string | null;
  media_urls: string[];
  visibility: string;
  parent_post_id: string | null;
  repost_of_id: string | null;
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  views_count: number;
  created_at: string;
  author: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
  post_likes?: { user_id: string }[];
}

function formatFeedItem(item: FeedItem, userId: string): Record<string, unknown> {
  const post = item.post as unknown as PostWithAuthor;
  const postLikes = post?.post_likes;
  return {
    ...post,
    is_liked_by_me: postLikes?.some((like) => like.user_id === userId) ?? false,
    post_likes: undefined,
  };
}

function formatPostWithLikes(post: unknown, userId: string): Record<string, unknown> {
  const typedPost = post as unknown as PostWithAuthor;
  const postLikes = typedPost?.post_likes;
  return {
    ...typedPost,
    is_liked_by_me: postLikes?.some((like) => like.user_id === userId) ?? false,
    post_likes: undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Not authenticated', status: 401 },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limit = parseInt(searchParams.get('limit') || '20');

    const { data: followedUsers, error: followError } = await supabase
      .from('followers')
      .select('followed_id')
      .eq('follower_id', user.id)
      .eq('relationship_state', 'active');

    if (followError) {
      console.error('[API /feed GET]: Error fetching follows:', followError);
    }

    const followedIds = (followedUsers ?? []).map(f => f.followed_id);

    if (followedIds.length === 0) {
      const coldStartPosts = await fetchColdStartPosts(supabase, user.id, cursor, limit);
      return NextResponse.json(coldStartPosts);
    }

    const { data: followedProfiles } = await supabase
      .from('profiles')
      .select('id, followers_count')
      .in('id', followedIds);

    const standardUserIds = (followedProfiles ?? [])
      .filter(p => (p.followers_count ?? 0) < 10000)
      .map(p => p.id);

    const celebrityIds = (followedProfiles ?? [])
      .filter(p => (p.followers_count ?? 0) >= 10000)
      .map(p => p.id);

    let pushFeedPosts: Record<string, unknown>[] = [];
    let celebrityPosts: Record<string, unknown>[] = [];

    if (standardUserIds.length > 0) {
      let pushQuery = supabase
        .from('feeds')
        .select(`
          created_at,
          post:posts!inner(
            *,
            author:profiles!author_id(id, username, display_name, avatar_url, is_verified),
            post_likes(user_id)
          )
        `)
        .in('owner_id', standardUserIds)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (cursor) {
        pushQuery = pushQuery.lt('created_at', cursor);
      }

      const { data: pushFeedItems } = await pushQuery;
      pushFeedPosts = (pushFeedItems ?? []).map((item: unknown) => 
        formatFeedItem(item as FeedItem, user.id)
      );
    }

    if (celebrityIds.length > 0) {
      let celebrityQuery = supabase
        .from('posts')
        .select(`
          *,
          author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url, is_verified),
          post_likes(user_id)
        `)
        .in('author_id', celebrityIds)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (cursor) {
        celebrityQuery = celebrityQuery.lt('created_at', cursor);
      }

      const { data: celebrityItems } = await celebrityQuery;
      
      if (celebrityItems) {
        celebrityPosts = (celebrityItems ?? []).map(post => 
          formatPostWithLikes(post, user.id)
        );
      }
    }

    const allPosts = [...pushFeedPosts, ...celebrityPosts];
    allPosts.sort((a, b) => 
      new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
    );

    const uniquePosts = allPosts.reduce((acc: Record<string, unknown>[], post) => {
      if (!acc.find(p => p.id === post.id)) {
        acc.push(post);
      }
      return acc;
    }, []);

    const finalPosts = uniquePosts.slice(0, limit);
    const nextCursor = finalPosts.length === limit 
      ? finalPosts[finalPosts.length - 1].created_at as string
      : null;

    return NextResponse.json({
      posts: finalPosts,
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

async function fetchColdStartPosts(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  userId: string,
  cursor: string | null,
  limit: number
) {
  const { data: userInterests } = await supabase
    .from('user_interests')
    .select('tag_id')
    .eq('user_id', userId);

  const tagIds = (userInterests ?? []).map(ui => ui.tag_id);

  if (tagIds.length === 0) {
    const { data: popularPosts } = await supabase
      .from('posts')
      .select(`
        *,
        author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url, is_verified),
        post_likes(user_id)
      `)
      .eq('visibility', 'public')
      .order('likes_count', { ascending: false })
      .limit(limit);

    const posts = (popularPosts ?? []).map((post: Record<string, unknown>) => {
      const postLikes = post.post_likes as { user_id: string }[] | undefined;
      return {
        ...post,
        is_liked_by_me: postLikes?.some((like) => like.user_id === userId) ?? false,
        post_likes: undefined,
      };
    });

    return {
      posts,
      next_cursor: null,
    };
  }

  const { data: relatedUsers } = await supabase
    .from('user_interests')
    .select('user_id')
    .in('tag_id', tagIds)
    .neq('user_id', userId);

  const relatedUserIds = [...new Set((relatedUsers ?? []).map(r => r.user_id))].slice(0, 50);

  if (relatedUserIds.length === 0) {
    const { data: popularPosts } = await supabase
      .from('posts')
      .select(`
        *,
        author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url, is_verified),
        post_likes(user_id)
      `)
      .eq('visibility', 'public')
      .order('likes_count', { ascending: false })
      .limit(limit);

    const posts = (popularPosts ?? []).map((post: Record<string, unknown>) => {
      const postLikes = post.post_likes as { user_id: string }[] | undefined;
      return {
        ...post,
        is_liked_by_me: postLikes?.some((like) => like.user_id === userId) ?? false,
        post_likes: undefined,
      };
    });

    return {
      posts,
      next_cursor: null,
    };
  }

  let query = supabase
    .from('posts')
    .select(`
      *,
      author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url, is_verified),
      post_likes(user_id)
    `)
    .in('author_id', relatedUserIds)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data: postsData } = await query;

  const posts = (postsData ?? []).map((post: Record<string, unknown>) => {
    const postLikes = post.post_likes as { user_id: string }[] | undefined;
    return {
      ...post,
      is_liked_by_me: postLikes?.some((like) => like.user_id === userId) ?? false,
      post_likes: undefined,
    };
  });

  const nextCursor = postsData && postsData.length === limit
    ? postsData[postsData.length - 1].created_at
    : null;

  return {
    posts,
    next_cursor: nextCursor,
  };
}
