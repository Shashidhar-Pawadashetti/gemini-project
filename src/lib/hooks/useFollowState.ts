'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export type FollowButtonState =
  | 'not_following'
  | 'following'
  | 'request_pending'
  | 'request_sent'
  | 'loading'
  | 'error';

export type BlockState =
  | 'not_blocked'
  | 'blocking'
  | 'blocked'
  | 'blocked_by';

interface UseFollowStateOptions {
  initialIsFollowing?: boolean;
  initialIsPending?: boolean;
  initialIsBlocked?: boolean;
  initialIsBlockedBy?: boolean;
  targetIsPrivate?: boolean;
}

interface FollowStateResult {
  followState: FollowButtonState;
  blockState: BlockState;
  follow: () => Promise<void>;
  unfollow: () => Promise<void>;
  block: () => Promise<void>;
  unblock: () => Promise<void>;
}

export function useFollowState(options: UseFollowStateOptions = {}): FollowStateResult {
  const {
    initialIsFollowing = false,
    initialIsPending = false,
    initialIsBlocked = false,
    initialIsBlockedBy = false,
  } = options;

  const queryClient = useQueryClient();
  const supabase = createBrowserSupabaseClient();

  const [followState, setFollowState] = useState<FollowButtonState>(
    initialIsFollowing
      ? 'following'
      : initialIsPending
      ? 'request_pending'
      : 'not_following'
  );

  const [blockState, setBlockState] = useState<BlockState>(
    initialIsBlocked
      ? 'blocked'
      : initialIsBlockedBy
      ? 'blocked_by'
      : 'not_blocked'
  );

  const invalidateProfileQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['feed'] });
  }, [queryClient]);

  const follow = useCallback(async () => {
    if (followState === 'loading' || followState === 'following' || followState === 'request_pending') {
      return;
    }

    setFollowState('loading');

    try {
      const response = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (response.ok) {
        if (data.state === 'pending') {
          setFollowState('request_pending');
        } else {
          setFollowState('following');
        }
      } else {
        setFollowState('error');
        if (response.status === 409) {
          setFollowState('following');
        }
      }
    } catch {
      setFollowState('error');
    }

    invalidateProfileQueries();
  }, [followState, invalidateProfileQueries]);

  const unfollow = useCallback(async () => {
    if (followState === 'loading' || followState === 'not_following') {
      return;
    }

    const previousState = followState;
    setFollowState('loading');

    try {
      const response = await fetch('/api/follow', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        setFollowState('not_following');
      } else {
        setFollowState(previousState);
      }
    } catch {
      setFollowState(previousState);
    }

    invalidateProfileQueries();
  }, [followState, invalidateProfileQueries]);

  const block = useCallback(async () => {
    if (blockState === 'blocking' || blockState === 'blocked') {
      return;
    }

    setBlockState('blocking');

    try {
      const response = await fetch('/api/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        setBlockState('blocked');
        setFollowState('not_following');
      } else {
        setBlockState('not_blocked');
      }
    } catch {
      setBlockState('not_blocked');
    }

    invalidateProfileQueries();
  }, [blockState, invalidateProfileQueries]);

  const unblock = useCallback(async () => {
    if (blockState !== 'blocked') {
      return;
    }

    setBlockState('blocking');

    try {
      const response = await fetch('/api/block', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        setBlockState('not_blocked');
      } else {
        setBlockState('blocked');
      }
    } catch {
      setBlockState('blocked');
    }
  }, [blockState]);

  return {
    followState,
    blockState,
    follow,
    unfollow,
    block,
    unblock,
  };
}

export function useFollowMutation(targetUserId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (action: 'follow' | 'unfollow') => {
      const response = await fetch('/api/follow', {
        method: action === 'follow' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: targetUserId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to perform action');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
