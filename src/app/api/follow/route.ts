import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const FollowSchema = z.object({
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
    const parsed = FollowSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Invalid target user ID', status: 422 },
        { status: 422 }
      );
    }

    const { target_user_id } = parsed.data;

    if (target_user_id === user.id) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Cannot follow yourself', status: 403 },
        { status: 403 }
      );
    }

    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('is_private')
      .eq('id', target_user_id)
      .single();

    if (!targetProfile) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'User not found', status: 404 },
        { status: 404 }
      );
    }

    const relationshipState = targetProfile.is_private ? 'pending' : 'active';

    const { error } = await supabase
      .from('followers')
      .insert({
        follower_id: user.id,
        followed_id: target_user_id,
        relationship_state: relationshipState,
      });

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'CONFLICT', message: 'Already following', status: 409 },
          { status: 409 }
        );
      }
      throw error;
    }

    if (relationshipState === 'active') {
      await supabase
        .from('notifications')
        .insert({
          recipient_id: target_user_id,
          actor_id: user.id,
          action_type: 'follow',
          entity_type: 'user',
          entity_id: user.id,
          payload: {},
        });
    }

    return NextResponse.json({ state: relationshipState }, { status: 200 });
  } catch (error) {
    console.error('[API /follow POST]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const parsed = FollowSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Invalid target user ID', status: 422 },
        { status: 422 }
      );
    }

    const { target_user_id } = parsed.data;

    const { error } = await supabase
      .from('followers')
      .delete()
      .eq('follower_id', user.id)
      .eq('followed_id', target_user_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /follow DELETE]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}
