'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface BioStepProps {
  userId: string;
  initialData: {
    display_name: string;
    bio: string;
    location: string;
    website: string;
  };
  onNext: () => void;
  onUpdate: (data: Partial<BioStepProps['initialData']>) => void;
}

export function BioStep({ userId, initialData, onNext, onUpdate }: BioStepProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState(initialData);

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    onUpdate({ [field]: value });
  };

  const handleSubmit = async () => {
    if (!formData.display_name.trim()) {
      setError('Display name is required');
      return;
    }

    if (formData.display_name.length > 60) {
      setError('Display name must be 60 characters or less');
      return;
    }

    if (formData.bio.length > 160) {
      setError('Bio must be 160 characters or less');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: formData.display_name.trim(),
          bio: formData.bio.trim() || null,
          location: formData.location.trim() || null,
          website: formData.website.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      onNext();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">About you</h2>
        <p className="text-muted-foreground mt-1">
          Tell people a bit about yourself
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="display_name">Display Name *</Label>
          <Input
            id="display_name"
            value={formData.display_name}
            onChange={(e) => updateField('display_name', e.target.value)}
            placeholder="Your name"
            maxLength={60}
          />
          <p className="text-xs text-muted-foreground text-right">
            {formData.display_name.length}/60
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={formData.bio}
            onChange={(e) => updateField('bio', e.target.value)}
            placeholder="Tell people about yourself"
            maxLength={160}
            className="resize-none h-24"
          />
          <p className="text-xs text-muted-foreground text-right">
            {formData.bio.length}/160
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => updateField('location', e.target.value)}
            placeholder="Where are you?"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            type="url"
            value={formData.website}
            onChange={(e) => updateField('website', e.target.value)}
            placeholder="https://yoursite.com"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={isSubmitting || !formData.display_name.trim()}
      >
        {isSubmitting ? 'Saving...' : 'Continue'}
      </Button>
    </div>
  );
}
