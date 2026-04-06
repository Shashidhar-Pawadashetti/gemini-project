import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { RequestsList } from './requests-list';

export default async function RequestsPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get current user's profile to check if they have private account
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, is_private')
    .eq('id', user.id)
    .single();

  // Only show this page for private accounts
  // Public accounts don't have pending requests to approve
  if (!profile?.is_private) {
    redirect('/home');
  }

  return <RequestsList userId={user.id} />;
}