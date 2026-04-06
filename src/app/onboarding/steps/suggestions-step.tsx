'use client';

import { useState, useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, UserPlus, Check } from 'lucide-react';
import type { Profile } from '@/types';

interface SuggestionsStepProps {
  userId: string;
  selectedInterests: string[];
  onComplete: () => void;
}

export function SuggestionsStep({ userId, selectedInterests, onComplete }: SuggestionsStepProps) {
  const supabase = createBrowserSupabaseClient();
  const queryClient = useQueryClient();
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['suggestions', selectedInterests],
    queryFn: async (): Promise<Profile[]> => {
      if (!selectedInterests || selectedInterests.length === 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, is_verified, followers_count')
          .neq('id', userId)
          .order('followers_count', { ascending: false })
          .limit(10);
        return (data || []) as Profile[];
      }

      const { data: userInterests } = await supabase
        .from('user_interests')
        .select('tag_id')
        .eq('user_id', userId);

      const currentUserTagIds = (userInterests || []).map(ui => ui.tag_id);
      const tagsToExclude = new Set([...selectedInterests, ...currentUserTagIds]);

      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_verified, followers_count')
        .neq('id', userId)
        .order('followers_count', { ascending: false })
        .limit(50);

      const { data: otherInterests } = await supabase
        .from('user_interests')
        .select('user_id, tag_id')
        .in('tag_id', selectedInterests);

      const interestMap: Record<string, string[]> = {};
      (otherInterests || []).forEach(item => {
        if (!interestMap[item.user_id]) {
          interestMap[item.user_id] = [];
        }
        interestMap[item.user_id].push(item.tag_id);
      });

      const scoredProfiles = (allProfiles || [])
        .map(profile => ({
          profile,
          score: (interestMap[profile.id] || []).length,
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return (b.profile.followers_count || 0) - (a.profile.followers_count || 0);
        });

      return scoredProfiles.slice(0, 10).map(item => item.profile) as unknown as Profile[];
    },
    enabled: !!selectedInterests,
  });

  const followMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: targetUserId }),
      });
    },
    onSuccess: (_, targetUserId) => {
      setFollowedUsers(prev => new Set([...prev, targetUserId]));
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
    },
  });

  const handleFollow = (targetUserId: string) => {
    followMutation.mutate(targetUserId);
  };

  const handleSkip = () => {
    onComplete();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Who to follow</h2>
        <p className="text-muted-foreground mt-1">
          Popular accounts you might like
        </p>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {suggestions?.map(user => {
          const isFollowed = followedUsers.has(user.id);
          return (
            <div key={user.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent">
              <Avatar className="h-12 w-12">
                <AvatarImage src={user.avatar_url || undefined} alt={user.username} />
                <AvatarFallback>{user.display_name[0]}</AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{user.display_name}</p>
                <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
              </div>

              <Button
                size="sm"
                variant={isFollowed ? 'outline' : 'default'}
                onClick={() => handleFollow(user.id)}
                disabled={isFollowed}
              >
                {isFollowed ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Following
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-1" />
                    Follow
                  </>
                )}
              </Button>
            </div>
          );
        })}

        {suggestions?.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No suggestions available right now
          </p>
        )}
      </div>

      <Button className="w-full" onClick={onComplete}>
        Get Started
      </Button>
    </div>
  );
}
