import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const SendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

export async function GET(
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

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limit = parseInt(searchParams.get('limit') || '30');

    let query = supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!sender_id(id, username, display_name, avatar_url)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: messages, error } = await query;

    if (error) throw error;

    const nextCursor = messages && messages.length === limit 
      ? messages[messages.length - 1].created_at 
      : null;

    return NextResponse.json({
      messages: messages || [],
      next_cursor: nextCursor,
    });
  } catch (error) {
    console.error('[API /messages/[id] GET]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const parsed = SendMessageSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: parsed.error.message, status: 422 },
        { status: 422 }
      );
    }

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: parsed.data.content,
        state: 'sent',
      })
      .select(`
        *,
        sender:profiles!sender_id(id, username, display_name, avatar_url)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('[API /messages/[id] POST]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}
