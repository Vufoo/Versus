import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useMembership } from '../hooks/useMembership';

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

export default function SettingsScreen() {
  const { colors, mode, setMode, setSignedIn } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { hasMembership, isAdmin } = useMembership();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ username: string | null } | null>(null);
  const [locationVisibility, setLocationVisibility] = useState<'public' | 'private'>('private');
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'private'>('public');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email ?? null);
      const { data: p } = await supabase.from('profiles').select('username, location_visibility, profile_visibility').eq('user_id', user.id).maybeSingle();
      setProfile(p ? { username: p.username } : null);
      setLocationVisibility((p as any)?.location_visibility === 'public' ? 'public' : 'private');
      setProfileVisibility((p as any)?.profile_visibility === 'private' ? 'private' : 'public');
    })();
  }, []);

  const updateLocationVisibility = async (value: 'public' | 'private') => {
    setLocationVisibility(value);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const update: { location_visibility: string; last_lat?: null; last_lng?: null } = { location_visibility: value };
    if (value === 'private') {
      update.last_lat = null;
      update.last_lng = null;
    }
    await supabase.from('profiles').update(update).eq('user_id', user.id);
  };

  const updateProfileVisibility = async (value: 'public' | 'private') => {
    setProfileVisibility(value);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('profiles').update({ profile_visibility: value }).eq('user_id', user.id);
  };

  const handleSignOut = async () => {
    try {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
    } catch {
      // native module not available or user didn't sign in with Google — skip
    }
    await supabase.auth.signOut();
    setSignedIn(false);
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingTop: spacing.lg }}>
        <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>Membership</Text>
          <View style={styles.membershipCard}>
            {(hasMembership || isAdmin) && (
              <View style={styles.membershipBadge}>
                <Text style={styles.membershipBadgeText}>{isAdmin ? 'Admin' : 'Member'}</Text>
              </View>
            )}
            <Text style={styles.membershipTitle}>
              {hasMembership ? 'You have Versus membership' : 'Get Versus membership'}
            </Text>
            <Text style={styles.membershipSub}>
              {hasMembership
                ? 'Unlock Find ranked match and Find casual match. Enjoy full access to all features.'
                : 'Upgrade to unlock Find ranked match and Find casual match. Get matched with opponents and practice partners.'}
            </Text>
            {!hasMembership && (
              <TouchableOpacity
                style={styles.membershipBtn}
                onPress={() => Alert.alert('Coming soon', 'Membership subscriptions will be available soon. Stay tuned!')}
                activeOpacity={0.8}
              >
                <Ionicons name="diamond-outline" size={20} color={colors.textOnPrimary} />
                <Text style={styles.membershipBtnText}>Get membership</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>Account</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
              <View>
                <Text style={styles.settingLabel}>Email</Text>
                <Text style={styles.settingValue}>{userEmail ?? '—'}</Text>
              </View>
            </View>
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
              <View>
                <Text style={styles.settingLabel}>Username</Text>
                <Text style={styles.settingValue}>@{profile?.username ?? '—'}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.settingRow} onPress={async () => {
            if (!userEmail) { Alert.alert('Error', 'No email found for this account.'); return; }
            const { error: resetErr } = await supabase.auth.resetPasswordForEmail(userEmail);
            if (resetErr) { Alert.alert('Error', resetErr.message); }
            else { Alert.alert('Check your email', `A password reset link has been sent to ${userEmail}.`); }
          }} activeOpacity={0.7}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="key-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>Change password</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert('Delete account', 'Are you sure? This will permanently delete your account and all data. This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => {
              try {
                const { error } = await supabase.rpc('delete_own_account');
                if (error) throw error;
                await supabase.auth.signOut();
                setSignedIn(false);
                navigation.goBack();
              } catch (e: any) {
                Alert.alert('Error', e?.message ?? 'Failed to delete account. Please try again.');
              }
            }}])} activeOpacity={0.7}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
              <Text style={[styles.settingLabel, { color: colors.error }]}>Delete account</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>Appearance</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="color-palette-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>Theme</Text>
            </View>
            <View style={styles.themeChips}>
              <TouchableOpacity style={[styles.themeChip, mode === 'light' && styles.themeChipSelected]} activeOpacity={0.8} onPress={() => setMode('light')}>
                <Ionicons name="sunny-outline" size={14} color={mode === 'light' ? colors.textOnPrimary : colors.textSecondary} />
                <Text style={[styles.themeChipText, mode === 'light' && styles.themeChipTextSelected]}>Light</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.themeChip, mode === 'dark' && styles.themeChipSelected]} activeOpacity={0.8} onPress={() => setMode('dark')}>
                <Ionicons name="moon-outline" size={14} color={mode === 'dark' ? colors.textOnPrimary : colors.textSecondary} />
                <Text style={[styles.themeChipText, mode === 'dark' && styles.themeChipTextSelected]}>Dark</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>Notifications</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="mail-unread-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>Email notifications</Text>
            </View>
            <Switch value={emailNotifs} onValueChange={setEmailNotifs} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#FFF" />
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>Push notifications</Text>
            </View>
            <Switch value={pushNotifs} onValueChange={setPushNotifs} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#FFF" />
          </View>
        </View>

        <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>Privacy & Security</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="location-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>Location</Text>
            </View>
            <View style={styles.themeChips}>
              <TouchableOpacity
                style={[styles.themeChip, locationVisibility === 'private' && styles.themeChipSelected]}
                activeOpacity={0.8}
                onPress={() => updateLocationVisibility('private')}
              >
                <Ionicons name="lock-closed-outline" size={14} color={locationVisibility === 'private' ? colors.textOnPrimary : colors.textSecondary} />
                <Text style={[styles.themeChipText, locationVisibility === 'private' && styles.themeChipTextSelected]}>Private</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.themeChip, locationVisibility === 'public' && styles.themeChipSelected]}
                activeOpacity={0.8}
                onPress={() => updateLocationVisibility('public')}
              >
                <Ionicons name="globe-outline" size={14} color={locationVisibility === 'public' ? colors.textOnPrimary : colors.textSecondary} />
                <Text style={[styles.themeChipText, locationVisibility === 'public' && styles.themeChipTextSelected]}>Public</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert('Coming soon', 'Blocked users will be available in a future update.')} activeOpacity={0.7}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="ban-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>Blocked users</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="eye-outline" size={20} color={colors.textSecondary} />
              <View style={styles.settingRowTextBlock}>
                <Text style={styles.settingLabel}>Profile visibility</Text>
                <Text style={styles.settingValue}>
                  {profileVisibility === 'private' ? 'Match history hidden from others' : 'Match history visible to others'}
                </Text>
              </View>
            </View>
            <View style={styles.themeChips}>
              <TouchableOpacity
                style={[styles.themeChip, profileVisibility === 'private' && styles.themeChipSelected]}
                activeOpacity={0.8}
                onPress={() => updateProfileVisibility('private')}
              >
                <Ionicons name="lock-closed-outline" size={14} color={profileVisibility === 'private' ? colors.textOnPrimary : colors.textSecondary} />
                <Text style={[styles.themeChipText, profileVisibility === 'private' && styles.themeChipTextSelected]}>Private</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.themeChip, profileVisibility === 'public' && styles.themeChipSelected]}
                activeOpacity={0.8}
                onPress={() => updateProfileVisibility('public')}
              >
                <Ionicons name="globe-outline" size={14} color={profileVisibility === 'public' ? colors.textOnPrimary : colors.textSecondary} />
                <Text style={[styles.themeChipText, profileVisibility === 'public' && styles.themeChipTextSelected]}>Public</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>Data & Storage</Text>
          <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert('Cache cleared', 'App cache has been cleared.')} activeOpacity={0.7}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>Clear cache</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>Support</Text>
          <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert('Help', 'Visit versus.app/help for support.')} activeOpacity={0.7}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>Help center</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert('Contact', 'Email support@versus.app for assistance.')} activeOpacity={0.7}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>Contact support</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert('Report', 'Thank you for helping keep Versus safe. Reports are reviewed promptly.')} activeOpacity={0.7}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="flag-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>Report a problem</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>Legal</Text>
          <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert('Terms', 'View our Terms of Service at versus.app/terms')} activeOpacity={0.7}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert('Privacy', 'View our Privacy Policy at versus.app/privacy')} activeOpacity={0.7}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.settingSection}>
          <Text style={styles.settingSectionTitle}>About</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>Version</Text>
            </View>
            <Text style={styles.settingValue}>1.0.1</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.8} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
