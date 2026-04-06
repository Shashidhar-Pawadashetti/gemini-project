import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const BlockSchema = z.object({
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
    const parsed = BlockSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Invalid target user ID', status: 422 },
        { status: 422 }
      );
    }

    const { target_user_id } = parsed.data;

    if (target_user_id === user.id) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Cannot block yourself', status: 403 },
        { status: 403 }
      );
    }

    await supabase.rpc('block_user', {
      blocker_id: user.id,
      blocked_id: target_user_id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /block POST]:', error);
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
    const parsed = BlockSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Invalid target user ID', status: 422 },
        { status: 422 }
      );
    }

    const { target_user_id } = parsed.data;

    await supabase.rpc('unblock_user', {
      blocker_id: user.id,
      blocked_id: target_user_id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /block DELETE]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}
