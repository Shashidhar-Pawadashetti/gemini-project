import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

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
