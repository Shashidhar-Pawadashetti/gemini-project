import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const RejectSchema = z.object({
  target_user_id: z.string().uuid(),
});

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
    const parsed = RejectSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Invalid target user ID', status: 422 },
        { status: 422 }
      );
    }

    const { target_user_id } = parsed.data;

    if (target_user_id === user.id) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Cannot reject yourself', status: 403 },
        { status: 403 }
      );
    }

    // Delete the pending follow request
    const { error: deleteError } = await supabase
      .from('followers')
      .delete()
      .eq('follower_id', target_user_id)
      .eq('followed_id', user.id)
      .eq('relationship_state', 'pending');

    if (deleteError) {
      console.error('[API /follow/reject] Delete error:', deleteError);
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'Failed to reject follow request', status: 500 },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[API /follow/reject]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}