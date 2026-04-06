'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X } from 'lucide-react';

interface AvatarStepProps {
  userId: string;
  onNext: () => void;
  onUpdate: (avatar_url: string) => void;
}

type UploadState = 'idle' | 'validating' | 'uploading' | 'success' | 'error';

export function AvatarStep({ userId, onNext, onUpdate }: AvatarStepProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [state, setState] = useState<UploadState>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    
    if (!file.type.startsWith('image/')) {
      setState('error');
      setError('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setState('error');
      setError('File must be less than 10MB');
      return;
    }

    setState('validating');
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setState('uploading');

    const { data, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(`${userId}/avatar`, file, { upsert: true });

    if (uploadError) {
      setState('error');
      setError('Failed to upload image');
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(data.path);

    onUpdate(publicUrl);
    setState('success');
  };

  const handleSkip = () => {
    onNext();
  };

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
          {preview && (
            <button
              onClick={() => {
                setPreview(null);
                setState('idle');
              }}
              className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-destructive-foreground hover:bg-destructive/90"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleSkip}
        >
          Skip for now
        </Button>
        <Button
          className="flex-1"
          onClick={() => fileInputRef.current?.click()}
          disabled={state === 'uploading'}
        >
          <Upload className="h-4 w-4 mr-2" />
          {state === 'uploading' ? 'Uploading...' : 'Upload Photo'}
        </Button>
      </div>

      {state === 'success' && (
        <Button className="w-full" onClick={onNext}>
          Continue
        </Button>
      )}
    </div>
  );
}
