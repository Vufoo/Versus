import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  Switch,
  Share,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../constants/theme';
import { supabase, resolveAvatarUrl } from '../lib/supabase';
import { SPORTS, sportLabel, SPORT_EMOJI } from '../constants/sports';

type ProfileTab = 'overview' | 'rankings';

const SCREEN_W = Dimensions.get('window').width;
const MAX_PREFERRED = 3;

type SportRating = {
  sport: string;
  rank_tier: string | null;
  rank_div: string | null;
  vp: number;
  wins: number;
  losses: number;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: spacing.xxl },

    /* ---- Page header ---- */
    pageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    pageTitle: { ...typography.heading, color: colors.text },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    headerActionBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* ---- Profile header card ---- */
    headerCard: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      padding: spacing.lg,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    avatarWrapper: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    avatarImage: { width: 80, height: 80, borderRadius: 40 },
    avatarInitials: { ...typography.heading, fontSize: 30, color: colors.textOnPrimary },
    cameraBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.surface,
    },
    userName: { ...typography.heading, color: colors.text },
    userHandle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
    socialRow: { flexDirection: 'row', gap: spacing.xl },
    socialItem: { alignItems: 'center' },
    socialValue: { ...typography.heading, fontSize: 18, color: colors.text },
    socialLabel: { ...typography.caption, color: colors.textSecondary },

    /* ---- Tab bar ---- */
    tabRow: {
      flexDirection: 'row',
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xs,
      marginBottom: spacing.lg,
    },
    tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center' },
    tabActive: { backgroundColor: colors.primary },
    tabText: { ...typography.label, color: colors.textSecondary },
    tabTextActive: { color: colors.textOnPrimary },

    /* ---- VP swiper ---- */
    vpSwiper: { marginBottom: spacing.lg },
    vpPage: { width: SCREEN_W - spacing.lg * 2, paddingHorizontal: spacing.lg },
    vpPageInner: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      alignItems: 'center',
    },
    vpEmoji: { fontSize: 32, marginBottom: spacing.xs },
    vpSportName: { ...typography.label, color: colors.textOnPrimary, opacity: 0.9, marginBottom: spacing.xs },
    vpValue: { fontSize: 36, fontWeight: '700', color: colors.textOnPrimary },
    vpLabel: { ...typography.caption, color: colors.textOnPrimary, opacity: 0.8, marginTop: spacing.xs },
    dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    dotActive: { backgroundColor: colors.primary },

    /* ---- Cards ---- */
    card: {
      marginHorizontal: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTitle: { ...typography.heading, color: colors.text, marginBottom: spacing.sm },
    cardSubtitle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
    placeholder: { ...typography.caption, color: colors.textSecondary },
    sportsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    sportChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm - 2,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    sportChipSelected: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
    sportChipLabel: { ...typography.label, color: colors.textSecondary },
    sportChipLabelSelected: { color: colors.textOnPrimary },
    savingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
    savingText: { ...typography.caption, color: colors.textSecondary },

    /* ---- Rankings ---- */
    rankPage: { width: SCREEN_W - spacing.lg * 2, paddingHorizontal: spacing.lg },
    rankPageInner: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    rankEmoji: { fontSize: 48, marginBottom: spacing.sm },
    rankSport: { ...typography.heading, color: colors.text, marginBottom: spacing.xs },
    rankTier: { ...typography.body, color: colors.primary, marginBottom: spacing.md },
    rankStatRow: { flexDirection: 'row', gap: spacing.xl, marginBottom: spacing.md },
    rankStat: { alignItems: 'center' },
    rankStatValue: { ...typography.heading, fontSize: 20, color: colors.text },
    rankStatLabel: { ...typography.caption, color: colors.textSecondary },
    rankHint: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
    rankDotsRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.md, marginBottom: spacing.md },

    /* ---- Settings modal ---- */
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl,
      maxHeight: '85%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    modalTitle: { ...typography.heading, color: colors.text },
    settingSection: { marginBottom: spacing.lg },
    settingSectionTitle: {
      ...typography.label,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    settingRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
    settingLabel: { ...typography.body, color: colors.text },
    settingValue: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    themeChips: { flexDirection: 'row', gap: spacing.sm },
    themeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
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
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.error,
      marginTop: spacing.md,
    },
    signOutText: { ...typography.body, fontWeight: '600', color: colors.error },
  });
}

export default function ProfileScreen() {
  const { colors, mode, setMode, setSignedIn } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [vpIdx, setVpIdx] = useState(0);
  const [rankIdx, setRankIdx] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);

  const [profile, setProfile] = useState<{
    username: string | null;
    full_name: string | null;
    vp_total: number;
    preferred_sports: string[];
    avatar_url: string | null;
  } | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [followingCount, setFollowingCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [sportRatings, setSportRatings] = useState<SportRating[]>([]);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to change your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    const uri = result.assets[0].uri;
    setAvatarUri(uri);
    setUploadingAvatar(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const filePath = `${user.id}/avatar.${ext}`;

      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, { contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`, upsert: true });

      if (uploadErr) { console.error('Avatar upload error:', uploadErr); Alert.alert('Upload failed', uploadErr.message); return; }

      const { error: updateErr } = await supabase.from('profiles').update({ avatar_url: filePath }).eq('user_id', user.id);
      if (updateErr) { console.error('Avatar URL save error:', updateErr); Alert.alert('Save failed', updateErr.message); return; }

      const signedUrl = await resolveAvatarUrl(filePath);
      if (signedUrl) setAvatarUri(signedUrl);
      if (profile) setProfile({ ...profile, avatar_url: filePath });
    } catch (e: any) {
      console.error('Avatar upload error:', e);
      Alert.alert('Upload failed', e?.message ?? 'Something went wrong.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        if (!cancelled) setUserEmail(user.email ?? null);

        const { data: p } = await supabase
          .from('profiles')
          .select('username, full_name, vp_total, preferred_sports, avatar_url')
          .eq('user_id', user.id)
          .maybeSingle();

        const { count: fing } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id);
        const { count: fers } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', user.id);

        const { data: ratings } = await supabase
          .from('user_sport_ratings')
          .select('vp, rank_tier, rank_div, wins, losses, sports!inner(name)')
          .eq('user_id', user.id);

        if (!cancelled) {
          setProfile({
            username: p?.username ?? null,
            full_name: p?.full_name ?? null,
            vp_total: p?.vp_total ?? 0,
            preferred_sports: p?.preferred_sports ?? [],
            avatar_url: p?.avatar_url ?? null,
          });
          if (p?.avatar_url) {
            const resolved = await resolveAvatarUrl(p.avatar_url);
            if (resolved && !cancelled) setAvatarUri(resolved);
          }
          setFollowingCount(fing ?? 0);
          setFollowerCount(fers ?? 0);
          if (ratings) {
            setSportRatings((ratings as any[]).map((r) => ({
              sport: r.sports?.name ?? '?',
              rank_tier: r.rank_tier, rank_div: r.rank_div,
              vp: r.vp, wins: r.wins, losses: r.losses,
            })));
          }
        }
      } catch { /* swallow */ } finally { if (!cancelled) setLoadingProfile(false); }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const initials = (profile?.full_name ?? profile?.username ?? 'U')
    .split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const perSportVp = useMemo(() => {
    const map = new Map(sportRatings.map((r) => [r.sport, r]));
    return SPORTS.map((s) => ({ sport: s, vp: map.get(s)?.vp ?? 0 }));
  }, [sportRatings]);

  const rankingsData = useMemo(() => {
    const map = new Map(sportRatings.map((r) => [r.sport, r]));
    return SPORTS.map((s) => {
      const r = map.get(s);
      return { sport: s, rank_tier: r?.rank_tier ?? null, rank_div: r?.rank_div ?? null, vp: r?.vp ?? 0, wins: r?.wins ?? 0, losses: r?.losses ?? 0 };
    });
  }, [sportRatings]);

  const shareProfile = async () => {
    const name = profile?.full_name || profile?.username || 'a Versus player';
    const handle = profile?.username ? `@${profile.username}` : '';
    const vp = profile?.vp_total ?? 0;
    const sports = (profile?.preferred_sports ?? []).join(', ');
    const message = [
      `Check out ${name}${handle ? ` (${handle})` : ''} on Versus!`,
      vp > 0 ? `${vp} Total VP` : null,
      sports ? `Plays: ${sports}` : null,
      'https://versus.app/profile' + (profile?.username ? `/${profile.username}` : ''),
    ].filter(Boolean).join('\n');

    try {
      await Share.share({ message, title: `${name} on Versus` });
    } catch { /* user cancelled */ }
  };

  const togglePreferred = async (sport: string) => {
    if (!profile) return;
    const current = [...(profile.preferred_sports ?? [])];
    const idx = current.indexOf(sport);
    if (idx >= 0) current.splice(idx, 1);
    else { if (current.length >= MAX_PREFERRED) return; current.push(sport); }

    setProfile({ ...profile, preferred_sports: current });
    setSavingPrefs(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error: updateErr } = await supabase.from('profiles').update({ preferred_sports: current }).eq('user_id', user.id);
      if (updateErr) { console.error('Preferred sports save error:', updateErr); Alert.alert('Save failed', updateErr.message ?? 'Could not update.'); }
    } catch (e) { console.error('Preferred sports save error:', e); }
    finally { setSavingPrefs(false); }
  };

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Profile</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionBtn} activeOpacity={0.8} onPress={shareProfile}>
            <Ionicons name="share-outline" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionBtn} activeOpacity={0.8} onPress={() => setSettingsOpen(true)}>
            <Ionicons name="settings-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Profile header */}
        <View style={styles.headerCard}>
          {loadingProfile ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <TouchableOpacity style={styles.avatarWrapper} onPress={pickAvatar} activeOpacity={0.8} disabled={uploadingAvatar}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                )}
                {uploadingAvatar ? (
                  <View style={styles.cameraBadge}>
                    <ActivityIndicator size="small" color={colors.textOnPrimary} />
                  </View>
                ) : (
                  <View style={styles.cameraBadge}>
                    <Ionicons name="camera" size={14} color={colors.textOnPrimary} />
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.userName}>{profile?.full_name || profile?.username || 'Your name'}</Text>
              <Text style={styles.userHandle}>@{profile?.username || 'username'}</Text>
              <View style={styles.socialRow}>
                <View style={styles.socialItem}>
                  <Text style={styles.socialValue}>{profile?.vp_total ?? 0}</Text>
                  <Text style={styles.socialLabel}>Total VP</Text>
                </View>
                <View style={styles.socialItem}>
                  <Text style={styles.socialValue}>{followingCount}</Text>
                  <Text style={styles.socialLabel}>Following</Text>
                </View>
                <View style={styles.socialItem}>
                  <Text style={styles.socialValue}>{followerCount}</Text>
                  <Text style={styles.socialLabel}>Followers</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Tab switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, tab === 'overview' && styles.tabActive]} onPress={() => setTab('overview')} activeOpacity={0.8}>
            <Text style={[styles.tabText, tab === 'overview' && styles.tabTextActive]}>Overview</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'rankings' && styles.tabActive]} onPress={() => setTab('rankings')} activeOpacity={0.8}>
            <Text style={[styles.tabText, tab === 'rankings' && styles.tabTextActive]}>Rankings</Text>
          </TouchableOpacity>
        </View>

        {/* Overview */}
        {tab === 'overview' && (
          <>
            <View style={styles.vpSwiper}>
              <FlatList
                data={perSportVp}
                keyExtractor={(item) => item.sport}
                horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                onScroll={(e) => setVpIdx(Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - spacing.lg * 2)))}
                scrollEventThrottle={16}
                snapToInterval={SCREEN_W - spacing.lg * 2}
                decelerationRate="fast"
                renderItem={({ item }) => (
                  <View style={styles.vpPage}>
                    <View style={styles.vpPageInner}>
                      <Text style={styles.vpEmoji}>{SPORT_EMOJI[item.sport] ?? '🏆'}</Text>
                      <Text style={styles.vpSportName}>{item.sport}</Text>
                      <Text style={styles.vpValue}>{item.vp}</Text>
                      <Text style={styles.vpLabel}>Victory Points</Text>
                    </View>
                  </View>
                )}
              />
              <View style={styles.dotsRow}>
                {perSportVp.map((item, i) => (
                  <View key={item.sport} style={[styles.dot, i === vpIdx && styles.dotActive]} />
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Preferred sports</Text>
              <Text style={styles.cardSubtitle}>Select up to {MAX_PREFERRED} sports you play the most.</Text>
              <View style={styles.sportsGrid}>
                {SPORTS.map((sp) => {
                  const sel = (profile?.preferred_sports ?? []).includes(sp);
                  const atMax = !sel && (profile?.preferred_sports ?? []).length >= MAX_PREFERRED;
                  return (
                    <TouchableOpacity key={sp} style={[styles.sportChip, sel && styles.sportChipSelected, atMax && { opacity: 0.4 }]} onPress={() => togglePreferred(sp)} disabled={atMax} activeOpacity={0.8}>
                      <Text style={[styles.sportChipLabel, sel && styles.sportChipLabelSelected]}>{sportLabel(sp)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {savingPrefs && (
                <View style={styles.savingRow}>
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                  <Text style={styles.savingText}>Saving…</Text>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Match history</Text>
              <Text style={styles.placeholder}>Recent wins, losses, and casual games will appear here.</Text>
            </View>
          </>
        )}

        {/* Rankings */}
        {tab === 'rankings' && (
          <>
            <FlatList
              data={rankingsData}
              keyExtractor={(item) => item.sport}
              horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              onScroll={(e) => setRankIdx(Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - spacing.lg * 2)))}
              scrollEventThrottle={16}
              snapToInterval={SCREEN_W - spacing.lg * 2}
              decelerationRate="fast"
              renderItem={({ item }) => (
                <View style={styles.rankPage}>
                  <View style={styles.rankPageInner}>
                    <Text style={styles.rankEmoji}>{SPORT_EMOJI[item.sport] ?? '🏆'}</Text>
                    <Text style={styles.rankSport}>{item.sport}</Text>
                    <Text style={styles.rankTier}>{item.rank_tier ? `${item.rank_tier} ${item.rank_div ?? ''}`.trim() : 'Unranked'}</Text>
                    <View style={styles.rankStatRow}>
                      <View style={styles.rankStat}><Text style={styles.rankStatValue}>{item.vp}</Text><Text style={styles.rankStatLabel}>VP</Text></View>
                      <View style={styles.rankStat}><Text style={styles.rankStatValue}>{item.wins}</Text><Text style={styles.rankStatLabel}>Wins</Text></View>
                      <View style={styles.rankStat}><Text style={styles.rankStatValue}>{item.losses}</Text><Text style={styles.rankStatLabel}>Losses</Text></View>
                    </View>
                    <Text style={styles.rankHint}>Play ranked matches in {item.sport} to earn VP and climb the ranks.</Text>
                  </View>
                </View>
              )}
            />
            <View style={styles.rankDotsRow}>
              {rankingsData.map((item, i) => (
                <View key={item.sport} style={[styles.dot, i === rankIdx && styles.dotActive]} />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* ---- Settings modal ---- */}
      <Modal visible={settingsOpen} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setSettingsOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <TouchableOpacity onPress={() => setSettingsOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Account */}
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
              </View>

              {/* Appearance */}
              <View style={styles.settingSection}>
                <Text style={styles.settingSectionTitle}>Appearance</Text>
                <View style={styles.settingRow}>
                  <View style={styles.settingRowLeft}>
                    <Ionicons name="color-palette-outline" size={20} color={colors.textSecondary} />
                    <Text style={styles.settingLabel}>Theme</Text>
                  </View>
                  <View style={styles.themeChips}>
                    <TouchableOpacity
                      style={[styles.themeChip, mode === 'light' && styles.themeChipSelected]}
                      activeOpacity={0.8}
                      onPress={() => setMode('light')}
                    >
                      <Ionicons name="sunny-outline" size={14} color={mode === 'light' ? colors.textOnPrimary : colors.textSecondary} />
                      <Text style={[styles.themeChipText, mode === 'light' && styles.themeChipTextSelected]}>Light</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.themeChip, mode === 'dark' && styles.themeChipSelected]}
                      activeOpacity={0.8}
                      onPress={() => setMode('dark')}
                    >
                      <Ionicons name="moon-outline" size={14} color={mode === 'dark' ? colors.textOnPrimary : colors.textSecondary} />
                      <Text style={[styles.themeChipText, mode === 'dark' && styles.themeChipTextSelected]}>Dark</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Notifications */}
              <View style={styles.settingSection}>
                <Text style={styles.settingSectionTitle}>Notifications</Text>
                <View style={styles.settingRow}>
                  <View style={styles.settingRowLeft}>
                    <Ionicons name="mail-unread-outline" size={20} color={colors.textSecondary} />
                    <Text style={styles.settingLabel}>Email notifications</Text>
                  </View>
                  <Switch
                    value={emailNotifs}
                    onValueChange={setEmailNotifs}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#FFF"
                  />
                </View>
                <View style={styles.settingRow}>
                  <View style={styles.settingRowLeft}>
                    <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
                    <Text style={styles.settingLabel}>Push notifications</Text>
                  </View>
                  <Switch
                    value={pushNotifs}
                    onValueChange={setPushNotifs}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#FFF"
                  />
                </View>
              </View>

              {/* About */}
              <View style={styles.settingSection}>
                <Text style={styles.settingSectionTitle}>About</Text>
                <View style={styles.settingRow}>
                  <View style={styles.settingRowLeft}>
                    <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
                    <Text style={styles.settingLabel}>Version</Text>
                  </View>
                  <Text style={styles.settingValue}>1.0.0</Text>
                </View>
              </View>

              {/* Sign out */}
              <TouchableOpacity
                style={styles.signOutBtn}
                activeOpacity={0.8}
                onPress={async () => {
                  setSettingsOpen(false);
                  await supabase.auth.signOut();
                  setSignedIn(false);
                }}
              >
                <Ionicons name="log-out-outline" size={20} color={colors.error} />
                <Text style={styles.signOutText}>Sign out</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
