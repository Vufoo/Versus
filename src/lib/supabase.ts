import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl ?? '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey ?? '';

const REMEMBER_ME_KEY = 'versus.rememberMe';

// In-memory storage for session when "remember me" is false
const memoryStorage = new Map<string, string>();

async function getRememberMe(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  try {
    const val = await AsyncStorage.getItem(REMEMBER_ME_KEY);
    return val !== 'false'; // default true
  } catch {
    return true;
  }
}

const customStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }
    const rememberMe = await getRememberMe();
    if (rememberMe) {
      return AsyncStorage.getItem(key);
    }
    return memoryStorage.get(key) ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
      return;
    }
    const rememberMe = await getRememberMe();
    if (rememberMe) {
      await AsyncStorage.setItem(key, value);
    } else {
      memoryStorage.set(key, value);
      await AsyncStorage.removeItem(key); // clear any previously persisted session
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
      return;
    }
    memoryStorage.delete(key);
    await AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: customStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Call before sign-in to set whether the session should persist across app restarts. */
export async function setRememberMe(value: boolean): Promise<void> {
  await AsyncStorage.setItem(REMEMBER_ME_KEY, String(value));
}

/** Get the current remember me preference. */
export async function getRememberMePreference(): Promise<boolean> {
  return getRememberMe();
}

const SIGNED_TTL = 60 * 60 * 24 * 7; // 7 days
const CACHE_MAX = 200; // max entries before evicting the oldest

type CacheEntry = { url: string; expires: number };

function cacheSet(map: Map<string, CacheEntry>, key: string, value: CacheEntry) {
  if (map.size >= CACHE_MAX) {
    // Evict the oldest (first inserted) key
    map.delete(map.keys().next().value!);
  }
  map.set(key, value);
}

const avatarCache = new Map<string, CacheEntry>();
const imageCache = new Map<string, CacheEntry>();

export async function resolveAvatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const cached = avatarCache.get(path);
  if (cached && cached.expires > Date.now()) return cached.url;
  try {
    const { data, error } = await supabase.storage.from('avatars').createSignedUrl(path, SIGNED_TTL);
    if (error || !data?.signedUrl) return null;
    cacheSet(avatarCache, path, { url: data.signedUrl, expires: Date.now() + (SIGNED_TTL - 60) * 1000 });
    return data.signedUrl;
  } catch { return null; }
}

export async function resolveMatchImageUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const cached = imageCache.get(path);
  if (cached && cached.expires > Date.now()) return cached.url;
  try {
    const { data, error } = await supabase.storage.from('match-images').createSignedUrl(path, SIGNED_TTL);
    if (error || !data?.signedUrl) return null;
    cacheSet(imageCache, path, { url: data.signedUrl, expires: Date.now() + (SIGNED_TTL - 60) * 1000 });
    return data.signedUrl;
  } catch { return null; }
}
