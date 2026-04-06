import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const ApproveSchema = z.object({
  target_user_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required', status: 401 },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = ApproveSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Invalid target user ID', status: 422 },
        { status: 422 }
      );
    }

    const { target_user_id } = parsed.data;

    if (target_user_id === user.id) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Cannot approve yourself', status: 403 },
        { status: 403 }
      );
    }

    // Check if the current user has a private profile
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('is_private')
      .eq('id', user.id)
      .single();

    // Only the target user's pending requests can be approved by them
    // Check if there's a pending request from this user to follow us
    const { data: existingRequest, error: queryError } = await supabase
      .from('followers')
      .select('follower_id, relationship_state')
      .eq('follower_id', target_user_id)
      .eq('followed_id', user.id)
      .eq('relationship_state', 'pending')
      .single();

    if (queryError || !existingRequest) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'No pending follow request from this user', status: 404 },
        { status: 404 }
      );
    }

    // Approve the request - update relationship_state to 'active'
    const { error: updateError } = await supabase
      .from('followers')
      .update({ relationship_state: 'active' })
      .eq('follower_id', target_user_id)
      .eq('followed_id', user.id)
      .eq('relationship_state', 'pending');

    if (updateError) {
      console.error('[API /follow/approve] Update error:', updateError);
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'Failed to approve follow request', status: 500 },
        { status: 500 }
      );
    }

    // Create notification for the follower that they were approved
    await supabase
      .from('notifications')
      .insert({
        recipient_id: target_user_id,
        actor_id: user.id,
        action_type: 'follow_approved',
        entity_type: 'user',
        entity_id: user.id,
        payload: {},
      });

    return NextResponse.json({ state: 'active' }, { status: 200 });
  } catch (error) {
    console.error('[API /follow/approve]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}