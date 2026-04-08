import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const UpdatePostSchema = z.object({
  content: z.string().max(500).optional(),
  media_urls: z.array(z.string()).max(4).default([]),
  visibility: z.enum(['public', 'followers', 'private']).optional(),
});

const PROFANITY_WORDS = ['spam', 'scam'];

function containsProfanity(text: string | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return PROFANITY_WORDS.some(word => lower.includes(word));
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const postId = params.id;

    const { data: post, error } = await supabase
      .from('posts')
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, bio, followers_count, following_count, posts_count),
        post_likes(user_id)
      `)
      .eq('id', postId)
      .single();

    if (error || !post) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Post not found', status: 404 },
        { status: 404 }
      );
    }

    const { data: comments } = await supabase
      .from('comments')
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified)
      `)
      .eq('post_id', postId)
      .is('parent_comment_id', null)
      .order('created_at', { ascending: true })
      .limit(50);

    const { data: replies } = await supabase
      .from('comments')
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified)
      `)
      .eq('post_id', postId)
      .not('parent_comment_id', 'is', null)
      .order('created_at', { ascending: true });

    const commentsWithReplies = comments?.map(comment => ({
      ...comment,
      replies: replies?.filter(reply => reply.parent_comment_id === comment.id) || [],
    })) || [];

    const postWithLikeStatus = {
      ...post,
      is_liked_by_me: post.post_likes?.some((like: { user_id: string }) => user && like.user_id === user.id) || false,
      post_likes: undefined,
    };

    return NextResponse.json({
      post: postWithLikeStatus,
      comments: commentsWithReplies,
    });
  } catch (error) {
    console.error('[API /posts/[id] GET]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required', status: 401 },
        { status: 401 }
      );
    }

    const postId = params.id;
    const body = await request.json();
    const parsed = UpdatePostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message || 'Invalid data', status: 422 },
        { status: 422 }
      );
    }

    const { data: existingPost, error: fetchError } = await supabase
      .from('posts')
      .select('author_id')
      .eq('id', postId)
      .single();

    if (fetchError || !existingPost) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Post not found', status: 404 },
        { status: 404 }
      );
    }

    if (existingPost.author_id !== user.id) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'You can only edit your own posts', status: 403 },
        { status: 403 }
      );
    }

    const { content, media_urls, visibility } = parsed.data;

    if (content && containsProfanity(content)) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Post contains inappropriate content', status: 422 },
        { status: 422 }
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (content !== undefined) updates.content = content;
    if (media_urls !== undefined) updates.media_urls = media_urls;
    if (visibility !== undefined) updates.visibility = visibility;

    const { data: updatedPost, error: updateError } = await supabase
      .from('posts')
      .update(updates)
      .eq('id', postId)
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified)
      `)
      .single();

    if (updateError) {
      console.error('[API /posts/[id] POST]:', updateError);
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'Failed to update post', status: 500 },
        { status: 500 }
      );
    }

    return NextResponse.json({ post: updatedPost }, { status: 200 });
  } catch (error) {
    console.error('[API /posts/[id] POST]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required', status: 401 },
        { status: 401 }
      );
    }

    const postId = params.id;

    // Check if post exists and user is the author
    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('author_id')
      .eq('id', postId)
      .single();

    if (fetchError || !post) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Post not found', status: 404 },
        { status: 404 }
      );
    }

    // Verify author
    if (post.author_id !== user.id) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'You can only delete your own posts', status: 403 },
        { status: 403 }
      );
    }

    // Delete post (cascades to likes and comments due to FK constraints)
    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (deleteError) {
      console.error('[API /posts/[id] DELETE]:', deleteError);
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'Failed to delete post', status: 500 },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[API /posts/[id] DELETE]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}
