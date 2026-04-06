import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const RepostSchema = z.object({
  post_id: z.string().uuid(),
  content: z.string().max(500).optional(),
  visibility: z.enum(['public', 'followers', 'private']).default('public'),
});

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
    const parsed = RepostSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: parsed.error.message, status: 422 },
        { status: 422 }
      );
    }

    const { post_id, content, visibility } = parsed.data;

    // Check if original post exists
    const { data: originalPost, error: postError } = await supabase
      .from('posts')
      .select('id, author_id')
      .eq('id', post_id)
      .single();

    if (postError || !originalPost) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Original post not found', status: 404 },
        { status: 404 }
      );
    }

    // Check RLS - can user see the original post?
    // This is implicitly checked by the RLS policies on the posts table

    // Create the repost
    const { data: repost, error: insertError } = await supabase
      .from('posts')
      .insert({
        author_id: user.id,
        content: content || null,
        media_urls: [],
        visibility,
        repost_of_id: post_id,
      })
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified)
      `)
      .single();

    if (insertError) {
      console.error('[API /posts/repost POST]:', insertError);
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'Failed to create repost', status: 500 },
        { status: 500 }
      );
    }

    // Update reposts count on original post
    await supabase.rpc('increment_repost_count', { post_id });

    // Create notification for the original post author
    if (originalPost.author_id !== user.id) {
      await supabase
        .from('notifications')
        .insert({
          recipient_id: originalPost.author_id,
          actor_id: user.id,
          action_type: 'repost',
          entity_type: 'post',
          entity_id: post_id,
          payload: {},
        });
    }

    return NextResponse.json(repost, { status: 201 });
  } catch (error) {
    console.error('[API /posts/repost POST]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}