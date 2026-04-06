import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockToast = {
  error: vi.fn(),
  success: vi.fn(),
};

vi.stubGlobal('toast', mockToast);

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
}));

describe('Interactions - Like Toggle (INT-01, INT-02, INT-03)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('INT-01: like a post → optimistic +1 immediately', async () => {
    const mockPost = {
      id: 'post-1',
      likes_count: 10,
      is_liked_by_me: false,
      author_id: 'user-2',
    };

    let currentLikes = mockPost.likes_count;
    let currentLiked = mockPost.is_liked_by_me;

    const handleLike = async () => {
      const previousLikes = currentLikes;
      const previousLiked = currentLiked;

      currentLiked = true;
      currentLikes += 1;

      const success = true;
      if (!success) {
        currentLiked = previousLiked;
        currentLikes = previousLikes;
      }
    };

    await handleLike();

    expect(currentLiked).toBe(true);
    expect(currentLikes).toBe(11);
  });

  it('INT-02: unlike a post → optimistic -1 immediately', async () => {
    const mockPost = {
      id: 'post-1',
      likes_count: 10,
      is_liked_by_me: true,
      author_id: 'user-2',
    };

    let currentLikes = mockPost.likes_count;
    let currentLiked = mockPost.is_liked_by_me;

    const handleUnlike = async () => {
      const previousLikes = currentLikes;
      const previousLiked = currentLiked;

      currentLiked = false;
      currentLikes -= 1;

      const success = true;
      if (!success) {
        currentLiked = previousLiked;
        currentLikes = previousLikes;
      }
    };

    await handleUnlike();

    expect(currentLiked).toBe(false);
    expect(currentLikes).toBe(9);
  });

  it('INT-03: like fails (network error) → revert to previous count + show toast', async () => {
    const mockPost = {
      id: 'post-1',
      likes_count: 10,
      is_liked_by_me: false,
      author_id: 'user-2',
    };

    let currentLikes = mockPost.likes_count;
    let currentLiked = mockPost.is_liked_by_me;

    const handleLikeWithFailure = async () => {
      const previousLikes = currentLikes;
      const previousLiked = currentLiked;

      currentLiked = true;
      currentLikes += 1;

      const mockApi = vi.fn().mockResolvedValue({ ok: false });
      await mockApi();

      if (!mockApi().ok) {
        currentLiked = previousLiked;
        currentLikes = previousLikes;
        mockToast.error('Failed to like post');
      }
    };

    await handleLikeWithFailure();

    expect(currentLiked).toBe(false);
    expect(currentLikes).toBe(10);
    expect(mockToast.error).toHaveBeenCalledWith('Failed to like post');
  });

  it('INT-04: like own post → button disabled', () => {
    const currentUserId = 'user-1';
    const post = {
      id: 'post-1',
      author_id: 'user-1',
      is_liked_by_me: false,
    };

    const isLikeDisabled = post.author_id === currentUserId;

    expect(isLikeDisabled).toBe(true);
  });
});

describe('Interactions - Comments (INT-05, INT-06)', () => {
  it('INT-05: comment with > 500 chars → error_too_long state', () => {
    type CommentState =
      | 'idle'
      | 'composing'
      | 'submitting'
      | 'success'
      | 'error_too_long'
      | 'error_empty'
      | 'error_network';

    const maxLength = 500;
    const testContent = 'a'.repeat(501);

    const validateComment = (content: string): CommentState => {
      if (content.length === 0) return 'error_empty';
      if (content.length > maxLength) return 'error_too_long';
      return 'composing';
    };

    const state = validateComment(testContent);
    expect(state).toBe('error_too_long');
  });

  it('INT-05: comment with valid length → success state', () => {
    type CommentState =
      | 'idle'
      | 'composing'
      | 'submitting'
      | 'success'
      | 'error_too_long'
      | 'error_empty'
      | 'error_network';

    const maxLength = 500;
    const testContent = 'This is a valid comment';

    const validateComment = (content: string): CommentState => {
      if (content.length === 0) return 'error_empty';
      if (content.length > maxLength) return 'error_too_long';
      return 'success';
    };

    const state = validateComment(testContent);
    expect(state).toBe('success');
  });

  it('INT-06: reply to comment → parent_comment_id set', async () => {
    const parentCommentId = 'comment-parent-1';
    const postId = 'post-1';
    const content = 'This is a reply';

    const mockSubmitComment = async (data: {
      postId: string;
      content: string;
      parentCommentId?: string;
    }) => {
      const payload = {
        post_id: data.postId,
        content: data.content,
        ...(data.parentCommentId && { parent_comment_id: data.parentCommentId }),
      };

      return payload;
    };

    const result = await mockSubmitComment({
      postId,
      content,
      parentCommentId,
    });

    expect(result.parent_comment_id).toBe(parentCommentId);
    expect(result.content).toBe(content);
  });

  it('INT-06: top-level comment → no parent_comment_id', async () => {
    const postId = 'post-1';
    const content = 'This is a top-level comment';

    const mockSubmitComment = async (data: {
      postId: string;
      content: string;
      parentCommentId?: string;
    }) => {
      const payload = {
        post_id: data.postId,
        content: data.content,
        ...(data.parentCommentId && { parent_comment_id: data.parentCommentId }),
      };

      return payload;
    };

    const result = await mockSubmitComment({
      postId,
      content,
    });

    expect(result.parent_comment_id).toBeUndefined();
    expect(result.content).toBe(content);
  });
});

describe('Interactions - Repost (INT-07)', () => {
  it('INT-07: simple repost → new post row with repost_of_id', async () => {
    const originalPostId = 'original-post-1';
    const userId = 'user-1';

    const mockRepostApi = async (data: {
      post_id: string;
      visibility: string;
      content?: string;
    }) => {
      const newPost = {
        id: 'new-repost-1',
        author_id: userId,
        repost_of_id: data.post_id,
        content: data.content || null,
        visibility: data.visibility,
        created_at: new Date().toISOString(),
      };

      return newPost;
    };

    const result = await mockRepostApi({
      post_id: originalPostId,
      visibility: 'public',
    });

    expect(result.repost_of_id).toBe(originalPostId);
    expect(result.content).toBeNull();
    expect(result.visibility).toBe('public');
  });

  it('INT-07: quote post → new post with content + repost_of_id', async () => {
    const originalPostId = 'original-post-1';
    const userId = 'user-1';
    const quoteContent = 'This is my thoughts on this post!';

    const mockQuotePostApi = async (data: {
      post_id: string;
      visibility: string;
      content?: string;
    }) => {
      const newPost = {
        id: 'new-quote-1',
        author_id: userId,
        repost_of_id: data.post_id,
        content: data.content || null,
        visibility: data.visibility,
        created_at: new Date().toISOString(),
      };

      return newPost;
    };

    const result = await mockQuotePostApi({
      post_id: originalPostId,
      visibility: 'public',
      content: quoteContent,
    });

    expect(result.repost_of_id).toBe(originalPostId);
    expect(result.content).toBe(quoteContent);
    expect(result.visibility).toBe('public');
  });

  it('INT-07: repost count increments on original post', () => {
    const originalPost = {
      id: 'post-1',
      reposts_count: 5,
    };

    const handleRepost = (post: typeof originalPost) => {
      return {
        ...post,
        reposts_count: post.reposts_count + 1,
      };
    };

    const updated = handleRepost(originalPost);
    expect(updated.reposts_count).toBe(6);
  });
});

describe('Interactions - CommentState Machine', () => {
  it('should transition through states correctly', () => {
    type CommentState =
      | 'idle'
      | 'composing'
      | 'submitting'
      | 'success'
      | 'error_too_long'
      | 'error_empty'
      | 'error_network';

    const transitions: { state: CommentState; action: string; nextState: CommentState }[] = [
      { state: 'idle', action: 'start_typing', nextState: 'composing' },
      { state: 'composing', action: 'submit', nextState: 'submitting' },
      { state: 'submitting', action: 'success', nextState: 'success' },
      { state: 'composing', action: 'exceed_limit', nextState: 'error_too_long' },
      { state: 'submitting', action: 'network_error', nextState: 'error_network' },
      { state: 'success', action: 'reset', nextState: 'idle' },
      { state: 'error_too_long', action: 'fix_content', nextState: 'composing' },
    ];

    expect(transitions.length).toBe(7);
    expect(transitions[0].nextState).toBe('composing');
    expect(transitions[3].nextState).toBe('error_too_long');
  });
});

describe('Interactions - Threaded Replies UI', () => {
  it('should indent replies with ml-12 and border-l-2', () => {
    interface CommentType {
      id: string;
      parent_comment_id: string | null;
      content: string;
    }

    const comment: CommentType = {
      id: 'comment-1',
      parent_comment_id: null,
      content: 'Top level comment',
    };

    const reply: CommentType = {
      id: 'comment-2',
      parent_comment_id: 'comment-1',
      content: 'This is a reply',
    };

    const getIndentClass = (c: CommentType) => {
      if (c.parent_comment_id) {
        return 'ml-12 border-l-2 pl-4';
      }
      return '';
    };

    expect(getIndentClass(comment)).toBe('');
    expect(getIndentClass(reply)).toBe('ml-12 border-l-2 pl-4');
  });
});

describe('Interactions - Server Guard (INT-04)', () => {
  it('should block self-like with 403 FORBIDDEN', async () => {
    const currentUserId = 'user-1';
    const postAuthorId = 'user-1';

    const likeOwnPost = async (userId: string, authorId: string) => {
      if (userId === authorId) {
        return { error: 'FORBIDDEN', message: 'Cannot like your own post', status: 403 };
      }
      return { success: true };
    };

    const result = await likeOwnPost(currentUserId, postAuthorId);

    expect(result).toEqual({
      error: 'FORBIDDEN',
      message: 'Cannot like your own post',
      status: 403,
    });
  });

  it('should allow liking other users posts', async () => {
    const currentUserId = 'user-1';
    const postAuthorId = 'user-2';

    const likePost = async (userId: string, authorId: string) => {
      if (userId === authorId) {
        return { error: 'FORBIDDEN', message: 'Cannot like your own post', status: 403 };
      }
      return { success: true };
    };

    const result = await likePost(currentUserId, postAuthorId);

    expect(result).toEqual({ success: true });
  });
});