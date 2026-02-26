import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl ?? '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const avatarCache = new Map<string, { url: string; expires: number }>();
const SIGNED_TTL = 60 * 60 * 24 * 7; // 7 days

export async function resolveAvatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const cached = avatarCache.get(path);
  if (cached && cached.expires > Date.now()) return cached.url;
  try {
    const { data, error } = await supabase.storage.from('avatars').createSignedUrl(path, SIGNED_TTL);
    if (error || !data?.signedUrl) return null;
    avatarCache.set(path, { url: data.signedUrl, expires: Date.now() + (SIGNED_TTL - 60) * 1000 });
    return data.signedUrl;
  } catch { return null; }
}
