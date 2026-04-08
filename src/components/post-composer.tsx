'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, Image as ImageIcon, Globe, Users, Lock, Loader2 } from 'lucide-react';
import type { PostVisibility } from '@/types';

interface PostComposerProps {
  user?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  onSuccess?: () => void;
  placeholder?: string;
  compact?: boolean;
}

type ComposerState =
  | 'idle'
  | 'composing'
  | 'uploading_media'
  | 'media_upload_error'
  | 'submitting'
  | 'success'
  | 'error_network'
  | 'error_content_empty';

const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm',
  'text/plain', 'application/pdf'
];

export function PostComposer({ user, onSuccess, placeholder = "What's happening?", compact = false }: PostComposerProps) {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<ComposerState>('idle');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  useEffect(() => {
    if (compact && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content, compact]);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Invalid file type: ${file.type}. Allowed: jpeg, png, webp, gif, mp4, webm, text, pdf`;
    }
    if (file.size > 10 * 1024 * 1024) {
      return `File ${file.name} is too large. Maximum size is 10MB`;
    }
    return null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    if (mediaFiles.length + files.length > 4) {
      setState('media_upload_error');
      setUploadErrors(['Maximum 4 media items allowed']);
      return;
    }

    // Client-side validation
    const validFiles: File[] = [];
    const errors: string[] = [];
    
    for (const file of files) {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
      } else {
        validFiles.push(file);
      }
    }

    if (errors.length > 0) {
      setState('media_upload_error');
      setUploadErrors(errors);
    }

    if (validFiles.length === 0) return;

    setMediaFiles(prev => [...prev, ...validFiles]);
    setUploadErrors([]);
    setState('uploading_media');

    try {
      // Use signed URL upload via API
      const formData = new FormData();
      validFiles.forEach(file => formData.append('files', file));

      const response = await fetch('/api/upload/media', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setState('media_upload_error');
        setUploadErrors([data.message || 'Upload failed']);
        return;
      }

      if (data.urls && data.urls.length > 0) {
        setMediaUrls(prev => [...prev, ...data.urls]);
      }

      if (data.errors) {
        setUploadErrors(data.errors);
        if (data.urls.length === 0) {
          setState('media_upload_error');
        }
      } else {
        setState('idle');
      }
    } catch (error) {
      setState('media_upload_error');
      setUploadErrors(['Failed to upload media. Please try again.']);
    }
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    setMediaUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!content.trim() && mediaUrls.length === 0) {
      setState('error_content_empty');
      return;
    }

    setState('submitting');

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim() || null,
          media_urls: mediaUrls,
          visibility,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create post');
      }

      setContent('');
      setMediaFiles([]);
      setMediaUrls([]);
      setVisibility('public');
      setState('success');
      
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      onSuccess?.();
      
      setTimeout(() => setState('idle'), 100);
    } catch {
      setState('error_network');
    }
  };

  const visibilityOptions: { value: PostVisibility; label: string; icon: React.ReactNode }[] = [
    { value: 'public', label: 'Public', icon: <Globe className="h-4 w-4" /> },
    { value: 'followers', label: 'Followers', icon: <Users className="h-4 w-4" /> },
    { value: 'private', label: 'Private', icon: <Lock className="h-4 w-4" /> },
  ];

  if (!user) return null;

  const isUploading = state === 'uploading_media';

  return (
    <div className={`border-b p-4 ${compact ? '' : 'pb-0'}`}>
      <div className="flex gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={user.avatar_url || undefined} alt={user.username} />
          <AvatarFallback>{user.display_name[0]}</AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as PostVisibility)}
              className="text-sm border rounded px-2 py-1 bg-background"
            >
              {visibilityOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (state === 'error_content_empty') setState('idle');
            }}
            placeholder={placeholder}
            className={`w-full resize-none bg-transparent outline-none ${
              compact ? 'text-base min-h-[40px]' : 'text-xl min-h-[80px]'
            }`}
            rows={compact ? 1 : undefined}
          />

          {mediaUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              {mediaUrls.map((url, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                  <Image src={url} alt="" fill className="object-cover" />
                  <button
                    onClick={() => removeMedia(index)}
                    className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {state === 'media_upload_error' && uploadErrors.length > 0 && (
            <p className="text-sm text-destructive mt-2">
              {uploadErrors[0]}
            </p>
          )}

          {state === 'error_content_empty' && (
            <p className="text-sm text-destructive mt-2">
              Please add some content or media
            </p>
          )}

          {state === 'error_network' && (
            <p className="text-sm text-destructive mt-2">
              Failed to post. Please try again.
            </p>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,text/plain,application/pdf"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading || state === 'submitting'}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={mediaFiles.length >= 4 || isUploading || state === 'submitting'}
              >
                {isUploading ? (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                ) : (
                  <ImageIcon className="h-5 w-5 text-primary" />
                )}
              </Button>
            </div>

            <div className="flex items-center gap-3">
              {content.length > 500 && (
                <span className={`text-sm ${content.length > 500 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {content.length}/500
                </span>
              )}
              <Button
                onClick={handleSubmit}
                disabled={
                  state === 'submitting' ||
                  isUploading ||
                  (!content.trim() && mediaUrls.length === 0) ||
                  content.length > 500
                }
              >
                {state === 'submitting' ? 'Posting...' : 'Post'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}