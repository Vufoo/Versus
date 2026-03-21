import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useMembership } from '../hooks/useMembership';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGUAGE_CONFIG } from '../i18n/translations';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: { ...typography.heading, color: colors.text },
    settingSection: { marginBottom: spacing.lg, paddingHorizontal: spacing.lg },
    settingSectionTitle: {
      ...typography.label,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: spacing.md,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    settingRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1, minWidth: 0 },
    settingRowTextBlock: { flex: 1, minWidth: 0 },
    settingLabel: { ...typography.body, color: colors.text },
    settingValue: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    themeChips: { flexDirection: 'row', gap: spacing.sm },
    themeChipsWrap: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    settingRowLocation: {
      flexDirection: 'column',
      alignItems: 'stretch',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    themeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    themeChipSelected: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
    themeChipText: { ...typography.caption, color: colors.textSecondary },
    themeChipTextSelected: { color: colors.textOnPrimary },
    themeChipSm: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 3,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    themeChipSmText: { fontSize: 11, fontWeight: '600' as const, color: colors.textSecondary },
    signOutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: spacing.md,
      borderWidth: 1,
      borderColor: colors.error,
      marginTop: spacing.md,
      marginHorizontal: spacing.lg,
    },
    signOutText: { ...typography.body, fontWeight: '600' as const, color: colors.error },
    membershipCard: {
      marginHorizontal: spacing.lg,
      padding: spacing.lg,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.cardBg,
    },
    membershipTitle: { ...typography.heading, color: colors.text, marginBottom: spacing.xs },
    membershipSub: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
    membershipBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
    },
    membershipBtnText: { ...typography.label, color: colors.textOnPrimary },
    membershipBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.primary,
      marginBottom: spacing.sm,
    },
    membershipBadgeText: { ...typography.caption, color: colors.textOnPrimary, fontWeight: '600' },
  });
}

// Module-level cache — survives tab switches so email/username show instantly
let _settingsCache: { email: string | null; username: string | null } | null = null;

export default function SettingsScreen() {
  const { colors, mode, setMode, setSignedIn } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { hasMembership, isAdmin } = useMembership();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [pushLoading, setPushLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(_settingsCache?.email ?? null);
  const [profile, setProfile] = useState<{ username: string | null } | null>(
    _settingsCache ? { username: _settingsCache.username } : null
  );
  const [locationVisibility, setLocationVisibility] = useState<'public' | 'private'>('private');
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'private'>('public');

  useEffect(() => {
    (async () => {
      // getSession() reads from local storage — no network call, instant
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      const email = session?.user?.email ?? null;
      if (!userId) return;
      setUserEmail(email);

      const { data: p } = await supabase.from('profiles').select('username, location_visibility, profile_visibility, push_notifications_enabled').eq('user_id', userId).maybeSingle();
      const username = p?.username ?? null;

      _settingsCache = { email, username };

      setProfile({ username });
      setLocationVisibility((p as any)?.location_visibility === 'public' ? 'public' : 'private');
      setProfileVisibility((p as any)?.profile_visibility === 'private' ? 'private' : 'public');
      setPushNotifs((p as any)?.push_notifications_enabled !== false);
    })();
  }, []);

  const updateLocationVisibility = async (value: 'public' | 'private') => {
    const previous = locationVisibility;
    setLocationVisibility(value);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLocationVisibility(previous); return; }
      const update: { location_visibility: string; last_lat?: null; last_lng?: null } = { location_visibility: value };
      if (value === 'private') { update.last_lat = null; update.last_lng = null; }
      const { error } = await supabase.from('profiles').update(update).eq('user_id', user.id);
      if (error) throw error;
    } catch { setLocationVisibility(previous); }
  };

  const updatePushNotifs = async (enabled: boolean) => {
    setPushNotifs(enabled);
    setPushLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('profiles').update({ push_notifications_enabled: enabled }).eq('user_id', user.id);
    } catch { /* non-critical */ }
    finally { setPushLoading(false); }
  };

  const updateProfileVisibility = async (value: 'public' | 'private') => {
    const previous = profileVisibility;
    setProfileVisibility(value);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setProfileVisibility(previous); return; }
      const { error } = await supabase.from('profiles').update({ profile_visibility: value }).eq('user_id', user.id);
      if (error) throw error;
    } catch { setProfileVisibility(previous); }
  };

  const handleSignOut = () => {
    const doSignOut = async () => {
      try {
        const { GoogleSignin } = require('@react-native-google-signin/google-signin');
        await GoogleSignin.revokeAccess();
        await GoogleSignin.signOut();
      } catch {
        // native module not available or user didn't sign in with Google — skip
      }
      // Clear push token before signing out so this device stops receiving
      // notifications for this account after another user logs in.
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').update({ push_token: null }).eq('user_id', user.id);
        }
      } catch { /* non-critical */ }
      _settingsCache = null;
      await supabase.auth.signOut();
      setSignedIn(false);
      navigation.goBack();
    };
    if (Platform.OS === 'web') {
      if (window.confirm(t.settings.signOutConfirm)) doSignOut();
    } else {
      Alert.alert(t.common.signOut, t.settings.signOutConfirm, [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.common.signOut, style: 'destructive', onPress: doSignOut },
      ]);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t.settings.title}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingTop: spacing.lg }}>
        <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>{t.settings.membership}</Text>
          <View style={styles.membershipCard}>
            {(hasMembership || isAdmin) && (
              <View style={styles.membershipBadge}>
                <Text style={styles.membershipBadgeText}>{isAdmin ? 'Admin' : 'Member'}</Text>
              </View>
            )}
            <Text style={styles.membershipTitle}>
              {hasMembership ? t.settings.hasMembership : t.settings.getMembership}
            </Text>
            <Text style={styles.membershipSub}>
              {hasMembership ? t.settings.membershipSubHas : t.settings.membershipSubGet}
            </Text>
            {!hasMembership && (
              <TouchableOpacity
                style={styles.membershipBtn}
                onPress={() => Alert.alert(t.common.comingSoon, 'Membership subscriptions will be available soon. Stay tuned!')}
                activeOpacity={0.8}
              >
                <Ionicons name="diamond-outline" size={20} color={colors.textOnPrimary} />
                <Text style={styles.membershipBtnText}>{t.settings.getMembershipBtn}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>{t.settings.account}</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
              <View>
                <Text style={styles.settingLabel}>{t.settings.email}</Text>
                <Text style={styles.settingValue}>{userEmail ?? '—'}</Text>
              </View>
            </View>
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
              <View>
                <Text style={styles.settingLabel}>{t.settings.username}</Text>
                <Text style={styles.settingValue}>@{profile?.username ?? '—'}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.settingRow} onPress={async () => {
            if (!userEmail) { Alert.alert(t.common.error, 'No email found for this account.'); return; }
            const { error: resetErr } = await supabase.auth.resetPasswordForEmail(userEmail);
            if (resetErr) { Alert.alert(t.common.error, resetErr.message); }
            else { Alert.alert('Check your email', `A password reset link has been sent to ${userEmail}.`); }
          }} activeOpacity={0.7}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="key-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>{t.settings.changePassword}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow} onPress={() => {
            const doDelete = async () => {
              try {
                const { error } = await supabase.rpc('delete_own_account');
                if (error) throw error;
                await supabase.auth.signOut();
                setSignedIn(false);
                navigation.goBack();
              } catch (e: any) {
                Alert.alert(t.common.error, e?.message ?? 'Failed to delete account. Please try again.');
              }
            };
            if (Platform.OS === 'web') {
              if (window.confirm(t.settings.deleteAccountConfirm)) doDelete();
            } else {
              Alert.alert(t.settings.deleteAccount, t.settings.deleteAccountConfirm, [
                { text: t.common.cancel, style: 'cancel' },
                { text: t.common.delete, style: 'destructive', onPress: doDelete },
              ]);
            }
          }} activeOpacity={0.7}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
              <Text style={[styles.settingLabel, { color: colors.error }]}>{t.settings.deleteAccount}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>{t.settings.appearance}</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="color-palette-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>{t.settings.theme}</Text>
            </View>
            <View style={styles.themeChips}>
              <TouchableOpacity style={[styles.themeChip, mode === 'light' && styles.themeChipSelected]} activeOpacity={0.8} onPress={() => setMode('light')}>
                <Ionicons name="sunny-outline" size={14} color={mode === 'light' ? colors.textOnPrimary : colors.textSecondary} />
                <Text style={[styles.themeChipText, mode === 'light' && styles.themeChipTextSelected]}>{t.settings.light}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.themeChip, mode === 'dark' && styles.themeChipSelected]} activeOpacity={0.8} onPress={() => setMode('dark')}>
                <Ionicons name="moon-outline" size={14} color={mode === 'dark' ? colors.textOnPrimary : colors.textSecondary} />
                <Text style={[styles.themeChipText, mode === 'dark' && styles.themeChipTextSelected]}>{t.settings.dark}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="language-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>{t.settings.language}</Text>
            </View>
            <View style={styles.themeChips}>
              {LANGUAGE_CONFIG.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.themeChip, language === lang.code && styles.themeChipSelected]}
                  activeOpacity={0.8}
                  onPress={() => setLanguage(lang.code)}
                >
                  <Text style={[styles.themeChipText, language === lang.code && styles.themeChipTextSelected]}>
                    {lang.code.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>{t.settings.notifications}</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="mail-unread-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>{t.settings.emailNotifs}</Text>
            </View>
            <Switch value={emailNotifs} onValueChange={setEmailNotifs} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#FFF" />
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>{t.settings.pushNotifs}</Text>
            </View>
            <Switch value={pushNotifs} onValueChange={updatePushNotifs} disabled={pushLoading} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#FFF" />
          </View>
        </View>

        <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>{t.settings.privacy}</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="location-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>{t.settings.location}</Text>
            </View>
            <View style={styles.themeChips}>
              <TouchableOpacity
                style={[styles.themeChipSm, locationVisibility === 'private' && styles.themeChipSelected]}
                activeOpacity={0.8}
                onPress={() => updateLocationVisibility('private')}
              >
                <Ionicons name="lock-closed-outline" size={11} color={locationVisibility === 'private' ? colors.textOnPrimary : colors.textSecondary} />
                <Text style={[styles.themeChipSmText, locationVisibility === 'private' && styles.themeChipTextSelected]}>{t.common.private}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.themeChipSm, locationVisibility === 'public' && styles.themeChipSelected]}
                activeOpacity={0.8}
                onPress={() => updateLocationVisibility('public')}
              >
                <Ionicons name="globe-outline" size={11} color={locationVisibility === 'public' ? colors.textOnPrimary : colors.textSecondary} />
                <Text style={[styles.themeChipSmText, locationVisibility === 'public' && styles.themeChipTextSelected]}>{t.common.public}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {/* <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert('Coming soon', 'Blocked users will be available in a future update.')} activeOpacity={0.7}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="ban-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>Blocked users</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity> */}
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="eye-outline" size={20} color={colors.textSecondary} />
              <View style={styles.settingRowTextBlock}>
                <Text style={styles.settingLabel}>{t.settings.profileVisibility}</Text>
                <Text style={styles.settingValue}>
                  {profileVisibility === 'private' ? t.settings.matchHistoryHidden : t.settings.matchHistoryVisible}
                </Text>
              </View>
            </View>
            <View style={styles.themeChips}>
              <TouchableOpacity
                style={[styles.themeChipSm, profileVisibility === 'private' && styles.themeChipSelected]}
                activeOpacity={0.8}
                onPress={() => updateProfileVisibility('private')}
              >
                <Ionicons name="lock-closed-outline" size={11} color={profileVisibility === 'private' ? colors.textOnPrimary : colors.textSecondary} />
                <Text style={[styles.themeChipSmText, profileVisibility === 'private' && styles.themeChipTextSelected]}>{t.common.private}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.themeChipSm, profileVisibility === 'public' && styles.themeChipSelected]}
                activeOpacity={0.8}
                onPress={() => updateProfileVisibility('public')}
              >
                <Ionicons name="globe-outline" size={11} color={profileVisibility === 'public' ? colors.textOnPrimary : colors.textSecondary} />
                <Text style={[styles.themeChipSmText, profileVisibility === 'public' && styles.themeChipTextSelected]}>{t.common.public}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>Data & Storage</Text>
          <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert('Cache cleared', 'App cache has been cleared.')} activeOpacity={0.7}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>Clear cache</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View> */}

        <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>{t.settings.support}</Text>
          <TouchableOpacity style={styles.settingRow} onPress={() => navigation.navigate('FAQ')} activeOpacity={0.7}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="book-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>{t.settings.faq}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert(t.settings.helpCenter, 'Visit versus.app/help for support.')} activeOpacity={0.7}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>{t.settings.helpCenter}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert(t.settings.contactSupport, 'Email support@versus.app for assistance.')} activeOpacity={0.7}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>{t.settings.contactSupport}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert(t.settings.reportProblem, 'Thank you for helping keep Versus safe. Reports are reviewed promptly.')} activeOpacity={0.7}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="flag-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>{t.settings.reportProblem}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>{t.settings.legal}</Text>
          <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert(t.settings.termsOfService, 'View our Terms of Service at versus.app/terms')} activeOpacity={0.7}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>{t.settings.termsOfService}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert(t.settings.privacyPolicy, 'View our Privacy Policy at versus.app/privacy')} activeOpacity={0.7}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>{t.settings.privacyPolicy}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>{t.settings.about}</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>{t.settings.version}</Text>
            </View>
            <Text style={styles.settingValue}>1.0.1</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.8} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.signOutText}>{t.common.signOut}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
