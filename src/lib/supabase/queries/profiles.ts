import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '@/types';

export async function getProfileByUsername(
  supabase: SupabaseClient,
  username: string
) {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      display_name,
      bio,
      avatar_url,
      cover_url,
      location,
      website,
      is_private,
      is_verified,
      followers_count,
      following_count,
      posts_count,
      created_at
    `)
    .eq('username', username.toLowerCase())
    .single();

  return { data: data as Profile | null, error };
}

export async function getProfileById(
  supabase: SupabaseClient,
  id: string
) {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      display_name,
      bio,
      avatar_url,
      cover_url,
      location,
      website,
      is_private,
      is_verified,
      followers_count,
      following_count,
      posts_count,
      created_at
    `)
    .eq('id', id)
    .single();

  return { data: data as Profile | null, error };
}

export async function updateProfile(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Pick<Profile, 'display_name' | 'bio' | 'avatar_url' | 'cover_url' | 'location' | 'website' | 'is_private'>>
) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      id,
      username,
      display_name,
      bio,
      avatar_url,
      cover_url,
      location,
      website,
      is_private,
      is_verified,
      followers_count,
      following_count,
      posts_count,
      created_at
    `)
    .single();

  return { data: data as Profile | null, error };
}

export async function getProfileFollowSuggestions(
  supabase: SupabaseClient,
  userId: string,
  limit = 5
) {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      display_name,
      avatar_url,
      is_verified,
      followers_count
    `)
    .neq('id', userId)
    .order('followers_count', { ascending: false })
    .limit(limit);

  return { data: data as Profile[] | null, error };
}
