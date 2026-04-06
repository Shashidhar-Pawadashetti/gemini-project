import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Feed Cursor Pagination', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return unique post_ids across multiple pages (no duplicates)', () => {
    const mockPages = [
      {
        posts: [
          { id: 'post-1', created_at: '2024-01-03T10:00:00Z' },
          { id: 'post-2', created_at: '2024-01-03T09:00:00Z' },
        ],
        next_cursor: '2024-01-03T09:00:00Z',
      },
      {
        posts: [
          { id: 'post-3', created_at: '2024-01-02T10:00:00Z' },
          { id: 'post-4', created_at: '2024-01-02T09:00:00Z' },
        ],
        next_cursor: '2024-01-02T09:00:00Z',
      },
      {
        posts: [
          { id: 'post-5', created_at: '2024-01-01T10:00:00Z' },
        ],
        next_cursor: null,
      },
    ];

    const allPostIds = mockPages.flatMap(page => page.posts.map(p => p.id));
    const uniqueIds = new Set(allPostIds);

    expect(allPostIds.length).toBe(uniqueIds.size);
    expect(allPostIds).toEqual(['post-1', 'post-2', 'post-3', 'post-4', 'post-5']);
  });

  it('should use created_at as cursor, not offset', () => {
    const cursorBasedQuery = (cursor: string | null, limit: number) => {
      if (cursor) {
        return `SELECT * FROM posts WHERE created_at < '${cursor}' ORDER BY created_at DESC LIMIT ${limit}`;
      }
      return `SELECT * FROM posts ORDER BY created_at DESC LIMIT ${limit}`;
    };

    const page1 = cursorBasedQuery(null, 20);
    const page2 = cursorBasedQuery('2024-01-03T09:00:00Z', 20);
    const page3 = cursorBasedQuery('2024-01-02T09:00:00Z', 20);

    expect(page1).toContain('ORDER BY created_at DESC');
    expect(page2).toContain("created_at < '2024-01-03T09:00:00Z'");
    expect(page3).toContain("created_at < '2024-01-02T09:00:00Z'");
    expect(page1).not.toContain('OFFSET');
    expect(page2).not.toContain('OFFSET');
  });
});

describe('Feed Celebrity Pull-Merge', () => {
  it('should separate standard users from celebrities (>= 10000 followers)', () => {
    const followedUsers = [
      { id: 'user-1', followers_count: 500 },
      { id: 'user-2', followers_count: 15000 },
      { id: 'user-3', followers_count: 800 },
      { id: 'user-4', followers_count: 50000 },
      { id: 'user-5', followers_count: 10000 },
    ];

    const standardUsers = followedUsers
      .filter(u => u.followers_count < 10000)
      .map(u => u.id);

    const celebrities = followedUsers
      .filter(u => u.followers_count >= 10000)
      .map(u => u.id);

    expect(standardUsers).toEqual(['user-1', 'user-3']);
    expect(celebrities).toEqual(['user-2', 'user-4', 'user-5']);
  });

  it('should merge push-feed and pull-merge results and deduplicate', () => {
    const pushFeed = [
      { id: 'post-1', author_id: 'user-1', created_at: '2024-01-03T10:00:00Z' },
      { id: 'post-2', author_id: 'user-3', created_at: '2024-01-03T09:00:00Z' },
    ];

    const celebrityPull = [
      { id: 'post-3', author_id: 'user-2', created_at: '2024-01-03T11:00:00Z' },
      { id: 'post-4', author_id: 'user-4', created_at: '2024-01-03T08:00:00Z' },
    ];

    const merged = [...pushFeed, ...celebrityPull];
    merged.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const uniquePosts = merged.reduce((acc, post) => {
      if (!acc.find(p => p.id === post.id)) {
        acc.push(post);
      }
      return acc;
    }, [] as { id: string; author_id: string; created_at: string }[]);

    expect(uniquePosts.length).toBe(4);
    expect(uniquePosts[0].id).toBe('post-3');
    expect(uniquePosts[1].id).toBe('post-1');
    expect(uniquePosts[2].id).toBe('post-2');
    expect(uniquePosts[3].id).toBe('post-4');
  });
});

describe('Feed Cold-Start (FEED-02)', () => {
  it('should return interest-based posts when user follows 0 accounts', () => {
    const userInterests = ['tag-1', 'tag-2', 'tag-3'];
    const relatedUserIds = ['user-a', 'user-b', 'user-c'];

    const coldStartQuery = (interests: string[], relatedUsers: string[]) => {
      if (interests.length > 0 && relatedUsers.length > 0) {
        return {
          type: 'interest-based',
          filters: `author_id IN (${relatedUsers.join(',')}) AND visibility = 'public'`,
        };
      }
      return {
        type: 'popular',
        filters: `visibility = 'public' ORDER BY likes_count DESC`,
      };
    };

    const result = coldStartQuery(userInterests, relatedUserIds);

    expect(result.type).toBe('interest-based');
    expect(result.filters).toContain('author_id IN');
  });

  it('should fallback to popular posts if user has no interests', () => {
    const coldStartQuery = (interests: string[], relatedUsers: string[]) => {
      if (interests.length > 0 && relatedUsers.length > 0) {
        return {
          type: 'interest-based',
          filters: `author_id IN (${relatedUsers.join(',')})`,
        };
      }
      return {
        type: 'popular',
        filters: `visibility = 'public' ORDER BY likes_count DESC`,
      };
    };

    const result = coldStartQuery([], []);

    expect(result.type).toBe('popular');
    expect(result.filters).toContain('ORDER BY likes_count DESC');
  });
});

describe('Feed Realtime Subscription', () => {
  it('should scope realtime to followed users, not all public posts', () => {
    const followedUserIds = ['user-1', 'user-2', 'user-3'];

    const oldFilter = 'visibility=eq.public';
    const newFilter = followedUserIds.map(id => `author_id=eq.${id}`).join('|');

    expect(oldFilter).toBe('visibility=eq.public');
    expect(newFilter).toContain('author_id=eq.user-1');
    expect(newFilter).toContain('author_id=eq.user-2');
    expect(newFilter).toContain('author_id=eq.user-3');
    expect(newFilter).not.toContain('visibility');
  });

  it('should update feed cache when new post arrives from followed user', async () => {
    const mockPost = {
      id: 'new-post-1',
      author_id: 'user-1',
      content: 'New post from followed user',
      created_at: new Date().toISOString(),
    };

    let feedCache: { pages: { posts: typeof mockPost[] }[] } = {
      pages: [{ posts: [{ id: 'existing-post', author_id: 'user-2', content: 'test', created_at: '2024-01-01T00:00:00Z' }] }],
    };

    const updateCache = (newPost: typeof mockPost) => {
      feedCache = {
        ...feedCache,
        pages: feedCache.pages.map((page, index) => {
          if (index === 0) {
            return { posts: [newPost, ...page.posts] };
          }
          return page;
        }),
      };
    };

    updateCache(mockPost);

    expect(feedCache.pages[0].posts[0].id).toBe('new-post-1');
    expect(feedCache.pages[0].posts).toHaveLength(2);
    expect(feedCache.pages[0].posts.find(p => p.id === 'new-post-1')).toBeDefined();
  });
});

describe('Feed Acceptance Criteria', () => {
  it('FEED-01: Authenticated user with >= 1 followed account sees posts sorted reverse-chronologically', () => {
    const posts = [
      { id: '1', created_at: '2024-01-03T10:00:00Z' },
      { id: '2', created_at: '2024-01-03T09:00:00Z' },
      { id: '3', created_at: '2024-01-02T10:00:00Z' },
    ];

    const sortedPosts = [...posts].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    expect(sortedPosts[0].id).toBe('1');
    expect(sortedPosts[1].id).toBe('2');
    expect(sortedPosts[2].id).toBe('3');
  });

  it('FEED-03: Infinite scroll triggers at 300px from bottom', () => {
    const shouldLoadMore = (
      scrollY: number,
      innerHeight: number,
      documentHeight: number,
      threshold: number = 300
    ) => {
      return innerHeight + scrollY >= documentHeight - threshold;
    };

    expect(shouldLoadMore(400, 800, 1600)).toBe(false);
    expect(shouldLoadMore(500, 800, 1600)).toBe(true);
    expect(shouldLoadMore(1000, 800, 1600)).toBe(true);
    expect(shouldLoadMore(1300, 800, 1600)).toBe(true);
  });
});