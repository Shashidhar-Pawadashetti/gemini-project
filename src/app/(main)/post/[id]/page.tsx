import { createServerSupabaseClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { PostDetail } from './post-detail';
import { CommentForm } from './comment-form';
import { CommentList } from './comment-list';

interface PostPageProps {
  params: { id: string };
}

export default async function PostPage({ params }: PostPageProps) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: post, error } = await supabase
    .from('posts')
    .select(`
      *,
      author:profiles!author_id(id, username, display_name, avatar_url, is_verified, bio, followers_count, following_count, posts_count),
      post_likes(user_id)
    `)
    .eq('id', params.id)
    .single();

  if (error || !post) {
    notFound();
  }

  const { data: comments } = await supabase
    .from('comments')
    .select(`
      *,
      author:profiles!author_id(id, username, display_name, avatar_url, is_verified)
    `)
    .eq('post_id', params.id)
    .is('parent_comment_id', null)
    .order('created_at', { ascending: true })
    .limit(50);

  const { data: allReplies } = await supabase
    .from('comments')
    .select(`
      *,
      author:profiles!author_id(id, username, display_name, avatar_url, is_verified)
    `)
    .eq('post_id', params.id)
    .not('parent_comment_id', 'is', null)
    .order('created_at', { ascending: true });

  const commentsWithReplies = comments?.map(comment => ({
    ...comment,
    replies: allReplies?.filter(reply => reply.parent_comment_id === comment.id) || [],
  })) || [];

  const postWithLikeStatus = {
    ...post,
    is_liked_by_me: user ? post.post_likes?.some((like: { user_id: string }) => like.user_id === user.id) : false,
    post_likes: undefined,
  };

  return (
    <div>
      <PostDetail post={postWithLikeStatus} />
      <CommentForm postId={params.id} />
      <CommentList comments={commentsWithReplies} />
    </div>
  );
}
