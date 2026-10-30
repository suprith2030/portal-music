import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function getSupabase(): SupabaseClient | null {
  const rawUrl =
    typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      : process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';

  const rawKey =
    typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

  const supabaseUrl = rawUrl.replace(/^["']|["']$/g, '').trim();
  const supabaseAnonKey = rawKey.replace(/^["']|["']$/g, '').trim();

  if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  return null;
}

export const isSupabaseConfigured = Boolean(getSupabase());
export const supabase = getSupabase();
