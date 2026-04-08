import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const MarkReadSchema = z.object({
  notification_id: z.string().uuid().optional(),
});

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

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select(`
        *,
        actor:profiles!actor_id(id, username, display_name, avatar_url, is_verified)
      `)
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('[API /notifications GET]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required', status: 401 },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = MarkReadSchema.safeParse(body);

    if (parsed.success && parsed.data.notification_id) {
      const { data: notification, error: fetchError } = await supabase
        .from('notifications')
        .select('recipient_id')
        .eq('id', parsed.data.notification_id)
        .single();

      if (fetchError || !notification) {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: 'Notification not found', status: 404 },
          { status: 404 }
        );
      }

      if (notification.recipient_id !== user.id) {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: 'Cannot update this notification', status: 403 },
          { status: 403 }
        );
      }

      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', parsed.data.notification_id)
        .eq('recipient_id', user.id);
    } else {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /notifications PATCH]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 500 },
      { status: 500 }
    );
  }
}
