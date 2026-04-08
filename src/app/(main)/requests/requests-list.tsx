'use client';

import { useState, useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X } from 'lucide-react';
import Link from 'next/link';

interface PendingRequest {
  follower_id: string;
  created_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    bio: string | null;
  };
}

export function RequestsList({ userId }: { userId: string }) {
  const supabase = createBrowserSupabaseClient();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/follow/pending');
      const data = await response.json();
      if (response.ok) {
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (followerId: string) => {
    setProcessingId(followerId);
    try {
      const response = await fetch('/api/follow/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: followerId }),
      });

      if (response.ok) {
        setRequests(prev => prev.filter(r => r.follower_id !== followerId));
      }
    } catch (error) {
      console.error('Failed to approve:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (followerId: string) => {
    setProcessingId(followerId);
    try {
      const response = await fetch('/api/follow/reject', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: followerId }),
      });

      if (response.ok) {
        setRequests(prev => prev.filter(r => r.follower_id !== followerId));
      }
    } catch (error) {
      console.error('Failed to reject:', error);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">No pending requests</h2>
        <p className="text-muted-foreground">
          When someone wants to follow you, their request will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold">Follow Requests</h1>
        <p className="text-muted-foreground">
          {requests.length} {requests.length === 1 ? 'request' : 'requests'} waiting for approval
        </p>
      </div>

      <div className="divide-y">
        {requests.map((request) => (
          <div key={request.follower_id} className="py-4 flex items-center justify-between gap-4">
            <Link 
              href={`/profile/${request.profile.username}`}
              className="flex items-center gap-3 flex-1 min-w-0"
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={request.profile.avatar_url || undefined} />
                <AvatarFallback>{request.profile.display_name?.[0] || '?'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{request.profile.display_name}</p>
                <p className="text-sm text-muted-foreground truncate">@{request.profile.username}</p>
                {request.profile.bio && (
                  <p className="text-sm text-muted-foreground truncate mt-1">
                    {request.profile.bio}
                  </p>
                )}
              </div>
            </Link>

            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReject(request.follower_id)}
                disabled={processingId === request.follower_id}
              >
                {processingId === request.follower_id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                <span className="ml-1">Reject</span>
              </Button>
              <Button
                size="sm"
                onClick={() => handleApprove(request.follower_id)}
                disabled={processingId === request.follower_id}
              >
                {processingId === request.follower_id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span className="ml-1">Approve</span>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}