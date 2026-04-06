'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, Check, Clock, Loader2, Ban, AlertTriangle } from 'lucide-react';
import { useFollowState, type FollowButtonState, type BlockState } from '@/lib/hooks/useFollowState';

interface FollowButtonProps {
  targetUserId: string;
  targetUsername: string;
  initialIsFollowing: boolean;
  initialIsPending: boolean;
  initialIsBlocked: boolean;
  initialIsBlockedBy: boolean;
  onStateChange?: () => void;
}

export function FollowButton({
  targetUserId,
  targetUsername,
  initialIsFollowing,
  initialIsPending,
  initialIsBlocked,
  initialIsBlockedBy,
  onStateChange,
}: FollowButtonProps) {
  const { followState, blockState, follow, unfollow, block, unblock } = useFollowState({
    initialIsFollowing,
    initialIsPending,
    initialIsBlocked,
    initialIsBlockedBy,
  });

  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  if (blockState === 'blocked_by') {
    return (
      <div className="text-center p-4 bg-muted/50 rounded-lg">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          You cannot view this profile
        </p>
      </div>
    );
  }

  if (showBlockConfirm) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Block @{targetUsername}?</p>
        <p className="text-xs text-muted-foreground">
          They will not be able to see your posts or follow you.
        </p>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              block();
              setShowBlockConfirm(false);
              onStateChange?.();
            }}
          >
            <Ban className="h-4 w-4 mr-1" />
            Block
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBlockConfirm(false)}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  const handleFollowClick = async () => {
    if (followState === 'following' || followState === 'request_pending') {
      await unfollow();
    } else if (followState === 'not_following') {
      await follow();
    }
    onStateChange?.();
  };

  const getButtonContent = () => {
    switch (followState) {
      case 'following':
        return (
          <>
            <Check className="h-4 w-4 mr-1" />
            Following
          </>
        );
      case 'request_pending':
        return (
          <>
            <Clock className="h-4 w-4 mr-1" />
            Requested
          </>
        );
      case 'not_following':
        return (
          <>
            <UserPlus className="h-4 w-4 mr-1" />
            Follow
          </>
        );
      case 'loading':
      case 'request_sent':
        return (
          <>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            {followState === 'request_sent' ? 'Sending...' : 'Loading...'}
          </>
        );
      case 'error':
        return (
          <>
            <UserPlus className="h-4 w-4 mr-1" />
            Follow
          </>
        );
    }
  };

  const isDisabled = followState === 'loading' || followState === 'request_sent';

  return (
    <div className="flex gap-2">
      <Button
        variant={followState === 'following' ? 'outline' : 'default'}
        onClick={handleFollowClick}
        disabled={isDisabled}
        className={followState === 'error' ? 'border-destructive' : ''}
      >
        {getButtonContent()}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowBlockConfirm(true)}
        className="text-muted-foreground hover:text-destructive"
        title="Block user"
      >
        <Ban className="h-4 w-4" />
      </Button>
    </div>
  );
}
