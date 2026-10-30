import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Clean any surrounding quotes, whitespace, or trailing slashes
const supabaseUrl = rawUrl.replace(/^["']|["']$/g, '').replace(/\/$/, '').trim();
const supabaseAnonKey = rawKey.replace(/^["']|["']$/g, '').trim();

export const isSupabaseConfigured =
  supabaseUrl.length > 0 &&
  supabaseAnonKey.length > 0 &&
  supabaseUrl.startsWith('http');

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
