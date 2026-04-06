import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required', status: 401 },
        { status: 401 }
      );
    }

    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        *,
        members:conversation_members(
          user:profiles!user_id(id, username, display_name, avatar_url)
        ),
        last_message:messages(id, content, created_at, sender_id)
      `)
      .order('last_message_at', { ascending: false });

    if (error) throw error;

    const conversationsWithOtherUser = conversations?.map(conv => {
      const otherMember = conv.members?.find(
        (m: { user: { id: string } }) => m.user.id !== user.id
      );
      return {
        ...conv,
        other_user: otherMember?.user,
      };
    }) || [];

    return NextResponse.json({ conversations: conversationsWithOtherUser });
  } catch (error) {
    console.error('[API /messages GET]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}

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
    const { target_user_id } = body;

    if (!target_user_id) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Target user ID is required', status: 400 },
        { status: 400 }
      );
    }

    const { data: targetUserConversations } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', target_user_id);

    const conversationIds = targetUserConversations?.map(c => c.conversation_id) || [];
    
    const { data: existingConversation } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', user.id)
      .in('conversation_id', conversationIds)
      .limit(1);

    if (existingConversation && existingConversation.length > 0) {
      return NextResponse.json({ 
        conversation_id: existingConversation[0].conversation_id,
        existing: true 
      });
    }

    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({})
      .select()
      .single();

    if (convError) throw convError;

    await supabase.from('conversation_members').insert([
      { conversation_id: conversation.id, user_id: user.id },
      { conversation_id: conversation.id, user_id: target_user_id },
    ]);

    return NextResponse.json({ conversation_id: conversation.id, existing: false });
  } catch (error) {
    console.error('[API /messages POST]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}
