import type { SupabaseClient } from '@supabase/supabase-js';
import type { Post, Profile, PostVisibility, FeedResponse } from '@/types';

interface PostWithAuthor extends Post {
  author: Profile;
}

export async function getFeedPosts(
  supabase: SupabaseClient,
  userId: string,
  cursor?: string,
  limit = 20
) {
  let query = supabase
    .from('feeds')
    .select(`
      created_at,
      post:posts!inner(
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
      )
    `)
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data: feedItems, error } = await query;

  if (error) {
    return { data: null, error };
  }

  const posts = (feedItems ?? []).map((item: Record<string, unknown>) => {
    const post = item.post as Record<string, unknown>;
    const author = post.author as Record<string, unknown>;
    
    return {
      id: post.id as string,
      author_id: post.author_id as string,
      content: post.content as string | null,
      media_urls: (post.media_urls as string[]) ?? [],
      visibility: post.visibility as PostVisibility,
      parent_post_id: post.parent_post_id as string | null,
      repost_of_id: post.repost_of_id as string | null,
      likes_count: post.likes_count as number,
      comments_count: post.comments_count as number,
      reposts_count: post.reposts_count as number,
      views_count: post.views_count as number,
      created_at: post.created_at as string,
      author: {
        id: author.id as string,
        username: author.username as string,
        display_name: author.display_name as string,
        avatar_url: author.avatar_url as string | null,
        is_verified: author.is_verified as boolean,
      } as Profile,
      is_liked_by_me: false,
      is_reposted_by_me: false,
    } as Post;
  });

  const nextCursor = feedItems && feedItems.length === limit
    ? (feedItems[feedItems.length - 1] as Record<string, unknown>).created_at as string
    : null;

  return {
    data: {
      posts,
      next_cursor: nextCursor,
    } as FeedResponse,
    error: null,
  };
}

export async function getPostsByAuthor(
  supabase: SupabaseClient,
  authorId: string,
  cursor?: string,
  limit = 20
) {
  let query = supabase
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
    .eq('author_id', authorId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, error };
  }

  const posts = (data ?? []).map((post: Record<string, unknown>) => {
    const author = post.author as Record<string, unknown>;
    
    return {
      ...post,
      author: {
        id: author.id as string,
        username: author.username as string,
        display_name: author.display_name as string,
        avatar_url: author.avatar_url as string | null,
        is_verified: author.is_verified as boolean,
      },
    } as Post;
  });

  const nextCursor = data && data.length === limit
    ? (data[data.length - 1] as Record<string, unknown>).created_at as string
    : null;

  return {
    data: {
      posts,
      next_cursor: nextCursor,
    } as FeedResponse,
    error: null,
  };
}

export async function getPostById(
  supabase: SupabaseClient,
  id: string
) {
  const { data, error } = await supabase
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
    .eq('id', id)
    .single();

  if (error) {
    return { data: null, error };
  }

  const post = data as Record<string, unknown>;
  const author = post.author as Record<string, unknown>;

  return {
    data: {
      ...post,
      author: {
        id: author.id as string,
        username: author.username as string,
        display_name: author.display_name as string,
        avatar_url: author.avatar_url as string | null,
        is_verified: author.is_verified as boolean,
      },
    } as Post,
    error: null,
  };
}

export async function createPost(
  supabase: SupabaseClient,
  authorId: string,
  content: string,
  mediaUrls: string[] = [],
  visibility: PostVisibility = 'public',
  parentPostId?: string,
  repostOfId?: string
) {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: authorId,
      content: content || null,
      media_urls: mediaUrls,
      visibility,
      parent_post_id: parentPostId ?? null,
      repost_of_id: repostOfId ?? null,
    })
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
    .single();

  if (error) {
    return { data: null, error };
  }

  const post = data as Record<string, unknown>;
  const author = post.author as Record<string, unknown>;

  return {
    data: {
      ...post,
      author: {
        id: author.id as string,
        username: author.username as string,
        display_name: author.display_name as string,
        avatar_url: author.avatar_url as string | null,
        is_verified: author.is_verified as boolean,
      },
    } as Post,
    error: null,
  };
}

export async function likePost(
  supabase: SupabaseClient,
  postId: string,
  userId: string
) {
  const { error } = await supabase
    .from('post_likes')
    .insert({
      post_id: postId,
      user_id: userId,
    });

  return { error };
}

export async function unlikePost(
  supabase: SupabaseClient,
  postId: string,
  userId: string
) {
  const { error } = await supabase
    .from('post_likes')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);

  return { error };
}
