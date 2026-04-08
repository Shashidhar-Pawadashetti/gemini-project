import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const SUPABASE_STORAGE_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').replace('.supabase.co', '') || '';

const PROFANITY_WORDS = ['spam', 'scam']; // Add more words as needed

function containsProfanity(text: string | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return PROFANITY_WORDS.some(word => lower.includes(word));
}

const CreatePostSchema = z.object({
  content: z.string().max(500).optional(),
  media_urls: z.array(z.string()).max(4).default([]),
  visibility: z.enum(['public', 'followers', 'private']).default('public'),
  parent_post_id: z.string().uuid().optional(),
  repost_of_id: z.string().uuid().optional(),
});

const UpdatePostSchema = z.object({
  content: z.string().max(500).optional(),
  media_urls: z.array(z.string()).max(4).default([]),
  visibility: z.enum(['public', 'followers', 'private']).optional(),
});

function isValidMediaUrl(url: string): boolean {
  if (!SUPABASE_STORAGE_HOST) return false;
  return url.includes(SUPABASE_STORAGE_HOST) && 
         (url.includes('/storage/v1/object/public/') || url.includes('/storage/v1/object/sign/'));
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required', status: 401 },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = CreatePostSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: parsed.error.message, status: 422 },
        { status: 422 }
      );
    }

    const { content, media_urls, visibility, parent_post_id, repost_of_id } = parsed.data;

    if (!content && (!media_urls || media_urls.length === 0)) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Post must have content or media', status: 422 },
        { status: 422 }
      );
    }

    if (media_urls && media_urls.length > 0) {
      for (const url of media_urls) {
        if (!isValidMediaUrl(url)) {
          return NextResponse.json(
            { error: 'VALIDATION_ERROR', message: 'Invalid media URL. Must be from Supabase storage.', status: 422 },
            { status: 422 }
          );
        }
      }
    }

    if (content && containsProfanity(content)) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Post contains inappropriate content', status: 422 },
        { status: 422 }
      );
    }

    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        author_id: user.id,
        content: content || null,
        media_urls: media_urls || [],
        visibility,
        parent_post_id: parent_post_id || null,
        repost_of_id: repost_of_id || null,
      })
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified)
      `)
      .single();

    if (error) {
      console.error('[API /posts POST]:', error);
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'Failed to create post', status: 500 },
        { status: 500 }
      );
    }

    await supabase.rpc('increment_post_count', { user_id: user.id });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error('[API /posts POST]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limit = parseInt(searchParams.get('limit') || '20');

    let query = supabase
      .from('posts')
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified),
        post_likes(user_id)
      `)
      .eq('parent_post_id', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: posts, error } = await query;

    if (error) {
      console.error('[API /posts GET]:', error);
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'Failed to fetch posts', status: 500 },
        { status: 500 }
      );
    }

    const postsWithLikeStatus = posts?.map(post => ({
      ...post,
      is_liked_by_me: post.post_likes?.some((like: { user_id: string }) => user && like.user_id === user.id) || false,
      post_likes: undefined,
    })) || [];

    const nextCursor = posts && posts.length === limit 
      ? posts[posts.length - 1].created_at 
      : null;

    return NextResponse.json({
      posts: postsWithLikeStatus,
      next_cursor: nextCursor,
    });
  } catch (error) {
    console.error('[API /posts GET]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}
