import { NativeModules } from 'react-native';
import { supabase } from './supabase';
import Constants from 'expo-constants';

/**
 * Registers the device push token with the user's profile.
 * Requires a native build (EAS Build / expo run:ios).
 * No-ops silently in Expo Go where the native module is unavailable.
 */
export async function registerPushToken(): Promise<void> {
  // NativeModules.ExpoPushTokenManager is undefined in Expo Go — skip entirely
  // so no import of expo-notifications even runs
  if (!NativeModules.ExpoPushTokenManager) return;

  try {
    const Notifications = await import('expo-notifications');
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResult.data;
    if (!token) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('profiles').update({ push_token: token }).eq('user_id', user.id);
  } catch {
    // Push registration failure is non-critical
  }
}

/**
 * Send a push notification via Expo's HTTP API.
 * Works in any environment — no native modules required.
 */
export async function sendMatchInvitePush(
  toUserId: string,
  title: string,
  body: string,
  matchId: string,
): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('push_token, push_notifications_enabled')
      .eq('user_id', toUserId)
      .maybeSingle();

    if ((profile as any)?.push_notifications_enabled === false) return;
    const token = (profile as any)?.push_token as string | null | undefined;
    if (!token || !token.startsWith('ExponentPushToken[')) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        title,
        body,
        sound: 'default',
        data: { matchId, type: 'match_invite' },
      }),
    });
  } catch {
    // Push delivery failure is non-critical
  }
}
