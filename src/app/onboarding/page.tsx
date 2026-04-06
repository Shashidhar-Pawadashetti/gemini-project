import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { OnboardingWizard } from './onboarding-wizard';

export default async function OnboardingPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, bio')
    .eq('id', user.id)
    .single();

  if (profile?.bio) {
    redirect('/home');
  }

  return <OnboardingWizard userId={user.id} />;
}
