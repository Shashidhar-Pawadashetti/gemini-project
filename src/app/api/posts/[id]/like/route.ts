import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

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

    if (post.author_id === user.id) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Cannot like your own post', status: 403 },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from('post_likes')
      .insert({
        user_id: user.id,
        post_id: postId,
      });

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'CONFLICT', message: 'Already liked', status: 409 },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('[API /posts/[id]/like POST]:', error);
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

    const { error } = await supabase
      .from('post_likes')
      .delete()
      .eq('user_id', user.id)
      .eq('post_id', postId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /posts/[id]/like DELETE]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}
