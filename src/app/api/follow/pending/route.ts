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

    const formattedRequests = (pendingRequests || []).map((req: any) => ({
      follower_id: req.follower_id,
      created_at: req.created_at,
      profile: {
        id: req.profiles?.id,
        username: req.profiles?.username,
        display_name: req.profiles?.display_name,
        avatar_url: req.profiles?.avatar_url,
        bio: req.profiles?.bio,
      },
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