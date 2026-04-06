import { createBrowserSupabaseClient } from '@/lib/supabase/client';

let supabaseClient: ReturnType<typeof createBrowserSupabaseClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createBrowserSupabaseClient();
  }
  return supabaseClient;
}
