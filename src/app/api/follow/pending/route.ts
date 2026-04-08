import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required', status: 401 },
        { status: 401 }
      );
    }

    // Get pending follow requests for the current user
    const { data: pendingRequests, error: queryError } = await supabase
      .from('followers')
      .select(`
        follower_id,
        created_at,
        profiles!followers_fk_follower_id(
          id,
          username,
          display_name,
          avatar_url,
          bio
        )
      `)
      .eq('followed_id', user.id)
      .eq('relationship_state', 'pending')
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('[API /follow/pending] Query error:', queryError);
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'Failed to fetch pending requests', status: 500 },
        { status: 500 }
      );
    }

    interface PendingRequest {
      follower_id: string;
      created_at: string;
      profiles: {
        id: string;
        username: string;
        display_name: string;
        avatar_url: string | null;
        bio: string | null;
      }[];
    }

    const formattedRequests = (pendingRequests || []).map((req: PendingRequest) => ({
      follower_id: req.follower_id,
      created_at: req.created_at,
      profile: req.profiles?.[0] ? {
        id: req.profiles[0].id,
        username: req.profiles[0].username,
        display_name: req.profiles[0].display_name,
        avatar_url: req.profiles[0].avatar_url,
        bio: req.profiles[0].bio,
      } : null,
    }));

    return NextResponse.json({ requests: formattedRequests }, { status: 200 });
  } catch (error) {
    console.error('[API /follow/pending]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}