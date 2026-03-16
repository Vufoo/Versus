import { supabase } from './supabase';
import Constants from 'expo-constants';

/**
 * Configures the foreground notification handler so alerts/sounds show
 * while the app is open. Must be called once early in the app lifecycle.
 * No-ops in Expo Go.
 */
export async function configureNotificationHandler(): Promise<void> {
  // 'storeClient' = Expo Go, which can't display push notifications
  if (Constants.executionEnvironment === 'storeClient') return;
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // Non-critical
  }
}

/**
 * Registers the device push token with the user's profile.
 * Requires a native EAS build — no-ops silently in Expo Go.
 */
export async function registerPushToken(): Promise<void> {
  // 'storeClient' = Expo Go — native push token APIs are unavailable
  if (Constants.executionEnvironment === 'storeClient') return;

  try {
    const Notifications = await import('expo-notifications');

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return;

    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
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
