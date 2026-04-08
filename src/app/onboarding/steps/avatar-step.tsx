'use client';

import { useState, useRef } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Upload, X, Loader2 } from 'lucide-react';
import type { AvatarUploadState } from '@/types';

interface AvatarStepProps {
  userId: string;
  onNext: () => void;
  onUpdate: (avatar_url: string) => void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function AvatarStep({ userId, onNext, onUpdate }: AvatarStepProps) {
  const supabase = createBrowserSupabaseClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [state, setState] = useState<AvatarUploadState>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  const getErrorMessage = (state: AvatarUploadState): string => {
    switch (state) {
      case 'error_file_type':
        return 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.';
      case 'error_file_size':
        return 'File is too large. Maximum size is 10MB.';
      case 'error_upload':
        return 'Upload failed. Please try again.';
      default:
        return error;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setState('selecting');

    // Client-side validation - type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setState('error_file_type');
      setError('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
      return;
    }

    // Client-side validation - size
    if (file.size > MAX_SIZE) {
      setState('error_file_size');
      setError('File is too large. Maximum size is 10MB.');
      return;
    }

    setState('validating');

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setState('uploading');

    try {
      // Create FormData and send to API
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        setState('error_upload');
        setError(errorData.message || 'Failed to upload image');
        return;
      }

      setState('processing');

      const data = await response.json();
      
      onUpdate(data.avatar_url);
      setState('success');
    } catch (err) {
      setState('error_upload');
      setError('Failed to upload image. Please try again.');
    }
  };

  const handleRetry = () => {
    setError('');
    setState('idle');
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSkip = () => {
    onNext();
  };

  const handleContinue = () => {
    onNext();
  };

  const isLoading = state === 'uploading' || state === 'processing' || state === 'validating';
  const hasError = state === 'error_file_type' || state === 'error_file_size' || state === 'error_upload';

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Add a profile photo</h2>
        <p className="text-muted-foreground mt-1">
          Help people recognize you with a photo
        </p>
      </div>

      <div className="flex justify-center">
        <div className="relative">
          <Avatar className="h-32 w-32">
            {preview ? (
              <AvatarImage src={preview} alt="Preview" />
            ) : (
              <AvatarFallback className="text-4xl">?</AvatarFallback>
            )}
          </Avatar>
          {(preview || state === 'success') && (
            <button
              onClick={handleRetry}
              className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-destructive-foreground hover:bg-destructive/90"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {hasError && (
        <div className="flex items-center gap-2 p-3 text-sm rounded-md bg-destructive/10 text-destructive">
          <X className="h-4 w-4" />
          <p>{getErrorMessage(state)}</p>
        </div>
      )}

      {state === 'uploading' && (
        <div className="flex items-center justify-center gap-2 p-3 text-sm rounded-md bg-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p>Uploading...</p>
        </div>
      )}

      {state === 'processing' && (
        <div className="flex items-center justify-center gap-2 p-3 text-sm rounded-md bg-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p>Processing...</p>
        </div>
      )}

      {state === 'success' && (
        <div className="flex items-center justify-center gap-2 p-3 text-sm rounded-md bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          <p>Avatar uploaded successfully!</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isLoading}
      />

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleSkip}
          disabled={isLoading}
        >
          Skip for now
        </Button>
        <Button
          className="flex-1"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || state === 'success'}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {state === 'validating' ? 'Validating...' : 'Uploading...'}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload Photo
            </>
          )}
        </Button>
      </div>

      {hasError && (
        <Button variant="outline" className="w-full" onClick={handleRetry}>
          Try Again
        </Button>
      )}

      {state === 'success' && (
        <Button className="w-full" onClick={handleContinue}>
          Continue
        </Button>
      )}
    </div>
  );
}