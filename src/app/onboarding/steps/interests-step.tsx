'use client';

import { useState, useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check } from 'lucide-react';
import type { InterestTag } from '@/types';

interface InterestsStepProps {
  userId: string;
  selectedInterests: string[];
  onNext: () => void;
  onUpdate: (interests: string[]) => void;
}

export function InterestsStep({ userId, selectedInterests, onNext, onUpdate }: InterestsStepProps) {
  const supabase = createBrowserSupabaseClient();
  const [tags, setTags] = useState<InterestTag[]>([]);
  const [selected, setSelected] = useState<string[]>(selectedInterests);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchTags = async () => {
      const { data } = await supabase
        .from('interest_tags')
        .select('id, tag, category')
        .order('category');
      if (data) setTags(data);
    };
    fetchTags();
  }, [supabase]);

  const toggleInterest = (tagId: string) => {
    const newSelected = selected.includes(tagId)
      ? selected.filter(id => id !== tagId)
      : [...selected, tagId];
    setSelected(newSelected);
    onUpdate(newSelected);
  };

  const handleSubmit = async () => {
    if (selected.length < 3) return;

    setIsSubmitting(true);

    try {
      const inserts = selected.map(tag_id => ({ user_id: userId, tag_id }));
      await supabase.from('user_interests').insert(inserts);
      onNext();
    } catch (error) {
      console.error('Failed to save interests:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [...new Set(tags.map(t => t.category))];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">What are you into?</h2>
        <p className="text-muted-foreground mt-1">
          Select at least 3 interests to personalize your feed
        </p>
      </div>

      <div className="space-y-4 max-h-80 overflow-y-auto">
        {categories.map(category => (
          <div key={category}>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">{category}</h3>
            <div className="flex flex-wrap gap-2">
              {tags
                .filter(t => t.category === category)
                .map(tag => {
                  const isSelected = selected.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleInterest(tag.id)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                      {tag.tag}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm text-center text-muted-foreground">
        {selected.length < 3
          ? `Select ${3 - selected.length} more to continue`
          : `${selected.length} selected`}
      </p>

      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={selected.length < 3 || isSubmitting}
      >
        {isSubmitting ? 'Saving...' : 'Continue'}
      </Button>
    </div>
  );
}
