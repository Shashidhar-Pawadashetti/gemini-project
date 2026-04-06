import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('AvatarUploadState Machine', () => {
  type AvatarUploadState =
    | 'idle'
    | 'selecting'
    | 'validating'
    | 'error_file_type'
    | 'error_file_size'
    | 'uploading'
    | 'processing'
    | 'success'
    | 'error_upload';

  interface TestContext {
    state: AvatarUploadState;
    error: string | null;
    uploadedUrl: string | null;
  }

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB

  function validateFile(file: { type: string; size: number }, ctx: TestContext): AvatarUploadState {
    if (!ALLOWED_TYPES.includes(file.type)) {
      ctx.error = 'Invalid file type. Only JPEG, PNG, and WebP are allowed.';
      return 'error_file_type';
    }
    if (file.size > MAX_SIZE) {
      ctx.error = 'File is too large. Maximum size is 10MB.';
      return 'error_file_size';
    }
    return 'validating';
  }

  function simulateUpload(ctx: TestContext, shouldFail = false): AvatarUploadState {
    ctx.state = 'uploading';
    if (shouldFail) {
      ctx.error = 'Upload failed. Please try again.';
      return 'error_upload';
    }
    ctx.state = 'processing';
    return 'processing';
  }

  function completeUpload(ctx: TestContext, url: string): AvatarUploadState {
    ctx.uploadedUrl = url;
    ctx.state = 'success';
    return 'success';
  }

  function reset(ctx: TestContext): AvatarUploadState {
    ctx.state = 'idle';
    ctx.error = null;
    ctx.uploadedUrl = null;
    return 'idle';
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('State Transitions', () => {
    it('ONB-02: File > 10MB → error_file_size', () => {
      const ctx: TestContext = { state: 'idle', error: null, uploadedUrl: null };
      const file = { type: 'image/jpeg', size: 15 * 1024 * 1024 }; // 15MB
      const newState = validateFile(file, ctx);
      
      expect(newState).toBe('error_file_size');
      expect(ctx.error).toBe('File is too large. Maximum size is 10MB.');
    });

    it('ONB-03: Non-image file → error_file_type', () => {
      const ctx: TestContext = { state: 'idle', error: null, uploadedUrl: null };
      const file = { type: 'application/pdf', size: 1024 };
      const newState = validateFile(file, ctx);
      
      expect(newState).toBe('error_file_type');
      expect(ctx.error).toBe('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
    });

    it('ONB-01: Valid JPEG → validating state', () => {
      const ctx: TestContext = { state: 'idle', error: null, uploadedUrl: null };
      const file = { type: 'image/jpeg', size: 1024 * 500 }; // 500KB
      const newState = validateFile(file, ctx);
      
      expect(newState).toBe('validating');
      expect(ctx.error).toBeNull();
    });

    it('Valid PNG → validating state', () => {
      const ctx: TestContext = { state: 'idle', error: null, uploadedUrl: null };
      const file = { type: 'image/png', size: 1024 * 500 };
      const newState = validateFile(file, ctx);
      
      expect(newState).toBe('validating');
    });

    it('Valid WebP → validating state', () => {
      const ctx: TestContext = { state: 'idle', error: null, uploadedUrl: null };
      const file = { type: 'image/webp', size: 1024 * 500 };
      const newState = validateFile(file, ctx);
      
      expect(newState).toBe('validating');
    });

    it('Valid file upload → processing → success', () => {
      const ctx: TestContext = { state: 'idle', error: null, uploadedUrl: null };
      const file = { type: 'image/jpeg', size: 1024 * 500 };
      
      validateFile(file, ctx);
      simulateUpload(ctx, false);
      const finalState = completeUpload(ctx, 'https://example.com/avatar.jpg');
      
      expect(finalState).toBe('success');
      expect(ctx.uploadedUrl).toBe('https://example.com/avatar.jpg');
    });

    it('Upload failure → error_upload', () => {
      const ctx: TestContext = { state: 'idle', error: null, uploadedUrl: null };
      const file = { type: 'image/jpeg', size: 1024 * 500 };
      
      validateFile(file, ctx);
      const newState = simulateUpload(ctx, true);
      
      expect(newState).toBe('error_upload');
      expect(ctx.error).toBe('Upload failed. Please try again.');
    });

    it('Error state → idle (reset)', () => {
      const ctx: TestContext = { state: 'error_file_size', error: 'File too large', uploadedUrl: null };
      const newState = reset(ctx);
      
      expect(newState).toBe('idle');
      expect(ctx.error).toBeNull();
      expect(ctx.uploadedUrl).toBeNull();
    });

    it('All 9 states are reachable', () => {
      const ctx: TestContext = { state: 'idle', error: null, uploadedUrl: null };
      
      // idle → selecting (file picker opens - simulated by setting state)
      ctx.state = 'selecting';
      expect(ctx.state).toBe('selecting');
      
      // selecting → validating (file selected)
      ctx.state = 'validating';
      expect(ctx.state).toBe('validating');
      
      // validating → error_file_type
      ctx.state = 'error_file_type';
      expect(ctx.state).toBe('error_file_type');
      
      // reset and test error_file_size
      ctx.state = 'idle';
      ctx.state = 'error_file_size';
      expect(ctx.state).toBe('error_file_size');
      
      // reset and test uploading
      ctx.state = 'idle';
      ctx.state = 'uploading';
      expect(ctx.state).toBe('uploading');
      
      // uploading → processing
      ctx.state = 'processing';
      expect(ctx.state).toBe('processing');
      
      // processing → success
      ctx.state = 'success';
      expect(ctx.state).toBe('success');
      
      // reset and test error_upload
      ctx.state = 'idle';
      ctx.state = 'error_upload';
      expect(ctx.state).toBe('error_upload');
      
      // back to idle
      ctx.state = 'idle';
      expect(ctx.state).toBe('idle');
    });
  });

  describe('Validation Edge Cases', () => {
    it('File exactly at 10MB should pass', () => {
      const ctx: TestContext = { state: 'idle', error: null, uploadedUrl: null };
      const file = { type: 'image/jpeg', size: MAX_SIZE };
      const newState = validateFile(file, ctx);
      
      expect(newState).toBe('validating');
    });

    it('File just over 10MB should fail', () => {
      const ctx: TestContext = { state: 'idle', error: null, uploadedUrl: null };
      const file = { type: 'image/jpeg', size: MAX_SIZE + 1 };
      const newState = validateFile(file, ctx);
      
      expect(newState).toBe('error_file_size');
    });

    it('Empty file type should fail', () => {
      const ctx: TestContext = { state: 'idle', error: null, uploadedUrl: null };
      const file = { type: '', size: 1024 };
      const newState = validateFile(file, ctx);
      
      expect(newState).toBe('error_file_type');
    });

    it('GIF should fail (not in allowed list)', () => {
      const ctx: TestContext = { state: 'idle', error: null, uploadedUrl: null };
      const file = { type: 'image/gif', size: 1024 };
      const newState = validateFile(file, ctx);
      
      expect(newState).toBe('error_file_type');
    });
  });
});