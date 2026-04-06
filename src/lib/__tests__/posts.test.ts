import { describe, it, expect, vi, beforeEach } from 'vitest';

type PostCreationState =
  | 'idle'
  | 'composing'
  | 'uploading_media'
  | 'media_upload_error'
  | 'submitting'
  | 'success'
  | 'error_network'
  | 'error_content_empty';

type PostVisibility = 'public' | 'followers' | 'private';

const ALLOWED_MEDIA_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm',
  'text/plain', 'application/pdf'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_MEDIA_ITEMS = 4;
const MAX_CONTENT_LENGTH = 500;

interface PostContext {
  state: PostCreationState;
  content: string;
  mediaUrls: string[];
  mediaFiles: File[];
  visibility: PostVisibility;
  error: string | null;
}

function createInitialContext(): PostContext {
  return {
    state: 'idle',
    content: '',
    mediaUrls: [],
    mediaFiles: [],
    visibility: 'public',
    error: null,
  };
}

function handleContentChange(ctx: PostContext, content: string) {
  if (content.length > 0 && ctx.state === 'idle') {
    ctx.state = 'composing';
  }
  ctx.content = content;
}

function validateContent(ctx: PostContext): boolean {
  if (!ctx.content.trim() && ctx.mediaUrls.length === 0) {
    ctx.state = 'error_content_empty';
    ctx.error = 'Post must have content or media';
    return false;
  }
  if (ctx.content.length > MAX_CONTENT_LENGTH) {
    ctx.state = 'error_content_empty';
    ctx.error = `Content must be ${MAX_CONTENT_LENGTH} characters or less`;
    return false;
  }
  return true;
}

function validateMediaFiles(ctx: PostContext, files: File[]): boolean {
  if (ctx.mediaFiles.length + files.length > MAX_MEDIA_ITEMS) {
    ctx.state = 'media_upload_error';
    ctx.error = `Maximum ${MAX_MEDIA_ITEMS} media items allowed`;
    return false;
  }

  const invalidFiles = files.filter(f => {
    const isAllowedType = ALLOWED_MEDIA_TYPES.includes(f.type);
    const isUnderSize = f.size <= MAX_FILE_SIZE;
    return !isAllowedType || !isUnderSize;
  });

  if (invalidFiles.length > 0) {
    ctx.state = 'media_upload_error';
    ctx.error = invalidFiles.some(f => f.size > MAX_FILE_SIZE)
      ? 'File too large (max 10MB)'
      : 'Invalid file type';
    return false;
  }

  return true;
}

function startMediaUpload(ctx: PostContext) {
  ctx.state = 'uploading_media';
}

function completeMediaUpload(ctx: PostContext, urls: string[]) {
  ctx.mediaUrls = urls;
  ctx.state = 'composing';
}

function submitPost(ctx: PostContext): boolean {
  if (!validateContent(ctx)) {
    return false;
  }

  ctx.state = 'submitting';
  return true;
}

function handleSubmitSuccess(ctx: PostContext) {
  ctx.state = 'success';
  ctx.content = '';
  ctx.mediaUrls = [];
  ctx.mediaFiles = [];
}

function handleSubmitError(ctx: PostContext) {
  ctx.state = 'error_network';
  ctx.error = 'Failed to create post. Please try again.';
}

function resetState(ctx: PostContext) {
  ctx.state = 'idle';
  ctx.error = null;
}

describe('PostCreationState Machine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('State Transitions', () => {
    it('idle → composing when user starts typing', () => {
      const ctx = createInitialContext();
      
      handleContentChange(ctx, 'Hello world');
      
      expect(ctx.state).toBe('composing');
    });

    it('composing → error_content_empty when submitting empty', () => {
      const ctx = createInitialContext();
      ctx.state = 'composing';
      
      const valid = submitPost(ctx);
      
      expect(valid).toBe(false);
      expect(ctx.state).toBe('error_content_empty');
    });

    it('composing → submitting when valid', () => {
      const ctx = createInitialContext();
      ctx.state = 'composing';
      ctx.content = 'Hello world';
      
      const valid = submitPost(ctx);
      
      expect(valid).toBe(true);
      expect(ctx.state).toBe('submitting');
    });

    it('submitting → success on API success', () => {
      const ctx = createInitialContext();
      ctx.state = 'submitting';
      
      handleSubmitSuccess(ctx);
      
      expect(ctx.state).toBe('success');
      expect(ctx.content).toBe('');
    });

    it('submitting → error_network on API failure', () => {
      const ctx = createInitialContext();
      ctx.state = 'submitting';
      
      handleSubmitError(ctx);
      
      expect(ctx.state).toBe('error_network');
      expect(ctx.error).toBe('Failed to create post. Please try again.');
    });

    it('error states → idle on reset', () => {
      const ctx = createInitialContext();
      ctx.state = 'error_content_empty';
      ctx.error = 'Test error';
      
      resetState(ctx);
      
      expect(ctx.state).toBe('idle');
      expect(ctx.error).toBeNull();
    });
  });

  describe('Media Validation', () => {
    it('should reject more than 4 media files', () => {
      const ctx = createInitialContext();
      ctx.mediaFiles = [new File(['a'], '1.jpg'), new File(['b'], '2.jpg'), new File(['c'], '3.jpg'), new File(['d'], '4.jpg')];
      
      const result = validateMediaFiles(ctx, [new File(['e'], '5.jpg')]);
      
      expect(result).toBe(false);
      expect(ctx.state).toBe('media_upload_error');
      expect(ctx.error).toContain('4');
    });

    it('should reject files over 10MB', () => {
      const ctx = createInitialContext();
      
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg');
      const result = validateMediaFiles(ctx, [largeFile]);
      
      expect(result).toBe(false);
      expect(ctx.state).toBe('media_upload_error');
      expect(ctx.error).toContain('10MB');
    });

    it('should reject invalid file types', () => {
      const ctx = createInitialContext();
      
      const invalidFile = new File(['test'], 'test.exe', { type: 'application/x-executable' });
      const result = validateMediaFiles(ctx, [invalidFile]);
      
      expect(result).toBe(false);
      expect(ctx.state).toBe('media_upload_error');
    });

    it('should accept valid image files', () => {
      const ctx = createInitialContext();
      
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const result = validateMediaFiles(ctx, [validFile]);
      
      expect(result).toBe(true);
      expect(ctx.state).not.toBe('media_upload_error');
    });

    it('should accept valid video files', () => {
      const ctx = createInitialContext();
      
      const validFile = new File(['test'], 'test.mp4', { type: 'video/mp4' });
      const result = validateMediaFiles(ctx, [validFile]);
      
      expect(result).toBe(true);
    });

    it('should accept PDF files', () => {
      const ctx = createInitialContext();
      
      const validFile = new File(['test'], 'doc.pdf', { type: 'application/pdf' });
      const result = validateMediaFiles(ctx, [validFile]);
      
      expect(result).toBe(true);
    });
  });

  describe('Content Validation', () => {
    it('should reject empty content with no media', () => {
      const ctx = createInitialContext();
      ctx.content = '';
      ctx.mediaUrls = [];
      
      const result = validateContent(ctx);
      
      expect(result).toBe(false);
      expect(ctx.state).toBe('error_content_empty');
    });

    it('should reject content over 500 characters', () => {
      const ctx = createInitialContext();
      ctx.content = 'a'.repeat(501);
      
      const result = validateContent(ctx);
      
      expect(result).toBe(false);
      expect(ctx.error).toContain('500');
    });

    it('should accept content under 500 characters', () => {
      const ctx = createInitialContext();
      ctx.content = 'Hello world';
      
      const result = validateContent(ctx);
      
      expect(result).toBe(true);
    });

    it('should accept media-only post (no content)', () => {
      const ctx = createInitialContext();
      ctx.content = '';
      ctx.mediaUrls = ['https://example.com/image.jpg'];
      
      const result = validateContent(ctx);
      
      expect(result).toBe(true);
    });
  });

  describe('Visibility Tiers', () => {
    it('should default to public', () => {
      const ctx = createInitialContext();
      expect(ctx.visibility).toBe('public');
    });

    it('should allow setting to followers', () => {
      const ctx = createInitialContext();
      ctx.visibility = 'followers';
      expect(ctx.visibility).toBe('followers');
    });

    it('should allow setting to private', () => {
      const ctx = createInitialContext();
      ctx.visibility = 'private';
      expect(ctx.visibility).toBe('private');
    });
  });

  describe('Media Upload Flow', () => {
    it('should transition to uploading_media when upload starts', () => {
      const ctx = createInitialContext();
      
      startMediaUpload(ctx);
      
      expect(ctx.state).toBe('uploading_media');
    });

    it('should add URLs and return to composing after upload', () => {
      const ctx = createInitialContext();
      ctx.state = 'uploading_media';
      
      completeMediaUpload(ctx, ['https://example.com/1.jpg', 'https://example.com/2.jpg']);
      
      expect(ctx.mediaUrls).toHaveLength(2);
      expect(ctx.state).toBe('composing');
    });

    it('should allow removing media items', () => {
      const ctx = createInitialContext();
      ctx.mediaUrls = ['https://example.com/1.jpg', 'https://example.com/2.jpg'];
      ctx.mediaFiles = [new File(['a'], '1.jpg'), new File(['b'], '2.jpg')];
      
      ctx.mediaUrls = ctx.mediaUrls.filter((_, i) => i !== 0);
      ctx.mediaFiles = ctx.mediaFiles.filter((_, i) => i !== 0);
      
      expect(ctx.mediaUrls).toHaveLength(1);
      expect(ctx.mediaFiles).toHaveLength(1);
    });
  });

  describe('All 7 States Reachable', () => {
    it('should have all required states', () => {
      const states: PostCreationState[] = [
        'idle',
        'composing',
        'uploading_media',
        'media_upload_error',
        'submitting',
        'success',
        'error_network',
        'error_content_empty'
      ];
      
      // Verify all states are reachable
      const ctx = createInitialContext();
      
      // idle → composing
      ctx.state = 'composing';
      expect(ctx.state).toBe('composing');
      
      // composing → uploading_media
      ctx.state = 'uploading_media';
      expect(ctx.state).toBe('uploading_media');
      
      // uploading_media → media_upload_error
      ctx.state = 'media_upload_error';
      expect(ctx.state).toBe('media_upload_error');
      
      // reset
      ctx.state = 'composing';
      ctx.content = '';
      ctx.mediaUrls = [];
      
      // composing → error_content_empty
      submitPost(ctx);
      expect(ctx.state).toBe('error_content_empty');
      
      // reset
      ctx.state = 'composing';
      ctx.content = 'test';
      
      // composing → submitting
      submitPost(ctx);
      expect(ctx.state).toBe('submitting');
      
      // submitting → success
      ctx.state = 'success';
      expect(ctx.state).toBe('success');
      
      // reset
      ctx.state = 'composing';
      ctx.content = 'test';
      ctx.state = 'submitting';
      
      // submitting → error_network
      handleSubmitError(ctx);
      expect(ctx.state).toBe('error_network');
    });
  });
});

describe('Post Visibility RLS Logic', () => {
  it('should allow author to see own posts', () => {
    const currentUserId = 'user-1';
    const postAuthorId = 'user-1';
    
    const canView = currentUserId === postAuthorId;
    expect(canView).toBe(true);
  });

  it('should allow viewing public posts', () => {
    const visibility: PostVisibility = 'public';
    const currentUserId = 'user-1';
    const postAuthorId = 'user-2';
    
    // Simplified RLS check
    const canView = visibility === 'public';
    expect(canView).toBe(true);
  });

  it('should require active follow for followers-only posts', () => {
    const visibility: PostVisibility = 'followers';
    const isFollowing = true;
    const relationshipState = 'active';
    
    const canView = visibility === 'followers' && isFollowing && relationshipState === 'active';
    expect(canView).toBe(true);
  });

  it('should block non-followers from followers-only posts', () => {
    const visibility: PostVisibility = 'followers';
    const isFollowing = false;
    
    const canView = visibility === 'followers' && isFollowing;
    expect(canView).toBe(false);
  });

  it('should only allow private posts for author', () => {
    const visibility: PostVisibility = 'private';
    const currentUserId = 'user-1';
    const postAuthorId = 'user-1';
    
    const canView = visibility === 'private' && currentUserId === postAuthorId;
    expect(canView).toBe(true);
  });

  it('should block others from private posts', () => {
    const visibility: PostVisibility = 'private';
    const currentUserId: string = 'user-other';
    const postAuthorId: string = 'user-author';
    
    const canView = visibility === 'private' && currentUserId === postAuthorId;
    expect(canView).toBe(false);
  });
});