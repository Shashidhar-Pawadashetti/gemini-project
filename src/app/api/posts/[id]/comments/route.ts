import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const CreateCommentSchema = z.object({
  content: z.string().min(1).max(500),
  parent_comment_id: z.string().uuid().optional(),
});

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

    const { data: post } = await supabase
      .from('posts')
      .select('author_id')
      .eq('id', postId)
      .single();

    if (!post) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Post not found', status: 404 },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = CreateCommentSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: parsed.error.message, status: 422 },
        { status: 422 }
      );
    }

    const { content, parent_comment_id } = parsed.data;

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        author_id: user.id,
        content,
        parent_comment_id: parent_comment_id || null,
      })
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified)
      `)
      .single();

    if (error) throw error;

    if (user.id !== post.author_id) {
      await supabase
        .from('notifications')
        .insert({
          recipient_id: post.author_id,
          actor_id: user.id,
          action_type: parent_comment_id ? 'reply' : 'comment',
          entity_type: 'post',
          entity_id: postId,
          payload: {},
        });
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('[API /posts/[id]/comments POST]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}
