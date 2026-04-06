import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NotificationsList } from './notifications-list';

export default async function NotificationsPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold">Notifications</h1>
        <p className="text-muted-foreground mt-2">Please sign in to view notifications</p>
      </div>
    );
  }

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_id', user.id)
    .eq('is_read', false);

  const { data: notifications } = await supabase
    .from('notifications')
    .select(`
      id,
      recipient_id,
      actor_id,
      action_type,
      entity_type,
      entity_id,
      payload,
      is_read,
      created_at
    `)
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div>
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
        <h1 className="text-xl font-bold p-4">Notifications</h1>
      </div>
      <NotificationsList 
        initialNotifications={notifications || []} 
        userId={user.id}
      />
    </div>
  );
}
