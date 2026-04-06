import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required', status: 401 },
        { status: 401 }
      );
    }

    const conversationId = params.id;

    const { data: membership } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Not a participant of this conversation', status: 403 },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { state } = body;

    if (!state || !['sent', 'delivered', 'read'].includes(state)) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Invalid state', status: 422 },
        { status: 422 }
      );
    }

    await supabase
      .from('messages')
      .update({ state })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('state', 'sent');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /messages/[id]/read PATCH]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}