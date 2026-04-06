import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ConversationsList } from './conversations-list';

export default async function MessagesPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold">Messages</h1>
        <p className="text-muted-foreground mt-2">Please sign in to view messages</p>
      </div>
    );
  }

  const { data: conversations } = await supabase
    .from('conversations')
    .select(`
      *,
      members:conversation_members(
        user:profiles!user_id(id, username, display_name, avatar_url)
      )
    `)
    .order('last_message_at', { ascending: false });

  const conversationsWithOtherUser = conversations?.map(conv => {
    const otherMember = conv.members?.find(
      (m: { user: { id: string } }) => m.user.id !== user.id
    );
    return {
      ...conv,
      other_user: otherMember?.user,
    };
  }) || [];

  return (
    <div>
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl font-bold">Messages</h1>
        </div>
      </div>
      <ConversationsList initialConversations={conversationsWithOtherUser} currentUserId={user.id} />
    </div>
  );
}
