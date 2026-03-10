import { supabase } from './supabase';

/**
 * Registers the device push token with the user's profile.
 * This requires a native build (expo run:ios or EAS Build) — not Expo Go.
 * To enable: install expo-notifications, add the native module calls here,
 * and rebuild. The push_token column in profiles is already set up for this.
 */
export async function registerPushToken(): Promise<void> {
  // No-op in Expo Go. Implement with expo-notifications in a native build.
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
