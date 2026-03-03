import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
  Image,
  Share,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../constants/theme';
import { supabase, resolveAvatarUrl } from '../lib/supabase';
import { SPORTS, sportLabel, SPORT_EMOJI } from '../constants/sports';

type ProfileTab = 'overview' | 'rankings';

type MatchHistoryItem = {
  id: string;
  sport_name: string;
  match_type: string;
  status: string;
  created_at: string;
  scheduled_at: string | null;
  started_at: string | null;
  location_name: string | null;
  match_format?: string;
  is_public?: boolean;
  participants: { user_id: string; role: string; result: string; vp_delta?: number; username: string | null; full_name: string | null }[];
  games: { game_number: number; score_challenger: number; score_opponent: number }[];
};

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
      backgroundColor: colors.cardBg,
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
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xs,
      marginBottom: spacing.lg,
    },
    tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center' },
    tabActive: { backgroundColor: colors.primary },
    tabText: { ...typography.label, color: colors.textSecondary },
    tabTextActive: { color: colors.textOnPrimary },

    /* ---- Ranks overview grid ---- */
    ranksSection: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    ranksSectionTitle: { ...typography.heading, color: colors.text, marginBottom: spacing.xs },
    ranksGrid: {
      flexDirection: 'row',
      gap: spacing.md,
      justifyContent: 'center',
    },
    rankCard: {
      flex: 1,
      minWidth: 0,
      backgroundColor: colors.cardBg,
      borderRadius: borderRadius.lg,
      padding: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    rankCardEmoji: { fontSize: 20, marginBottom: 2 },
    rankCardSport: { ...typography.label, fontSize: 12, color: colors.text, textAlign: 'center' },
    rankCardTier: { ...typography.caption, color: colors.primary, fontWeight: '600', fontSize: 10, textAlign: 'center', marginBottom: spacing.xs },
    rankCardBottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      alignSelf: 'stretch',
    },
    rankCardVp: { ...typography.heading, fontSize: 16, color: colors.text },
    rankCardVpLabel: { ...typography.caption, color: colors.textSecondary, fontSize: 9 },
    rankCardStat: { alignItems: 'center' },
    rankCardStatValue: { ...typography.label, fontSize: 12, color: colors.text },
    rankCardStatLabel: { ...typography.caption, fontSize: 9, color: colors.textSecondary },
    dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    dotActive: { backgroundColor: colors.primary },

    /* ---- Cards ---- */
    card: {
      marginHorizontal: spacing.lg,
      backgroundColor: colors.cardBg,
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
    sportsGridRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
    sportChip: {
      paddingHorizontal: spacing.sm,
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
    rankPage: { width: SCREEN_W, alignItems: 'center', justifyContent: 'center' },
    rankPageInner: {
      width: SCREEN_W - spacing.lg * 2,
      backgroundColor: colors.cardBg,
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
    sectionHeader: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.xs,
    },
    sectionSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    matchHistoryList: {
      marginHorizontal: spacing.lg,
      backgroundColor: colors.cardBg,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      marginBottom: spacing.md,
    },
    matchHistoryItem: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    matchHistoryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    matchHistoryEmoji: { fontSize: 20 },
    matchHistoryLeft: { flex: 1, minWidth: 0 },
    matchHistorySport: { ...typography.label, fontSize: 13, color: colors.text },
    matchHistoryMeta: { ...typography.caption, fontSize: 11, color: colors.textSecondary, marginTop: 1 },
    matchHistoryRight: { alignItems: 'flex-end' },
    matchHistoryResult: { ...typography.label, fontSize: 13, fontWeight: '700' },
    matchHistoryVp: { ...typography.caption, fontSize: 10, color: colors.textSecondary, marginTop: 1 },
  });
}

export default function ProfileScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [vpIdx, setVpIdx] = useState(0);
  const [rankIdx, setRankIdx] = useState(0);

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
  const [matchHistory, setMatchHistory] = useState<MatchHistoryItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    setAvatarUri(uri);
    setUploadingAvatar(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const mimeType = asset.mimeType ?? 'image/jpeg';
      const ext = mimeType.split('/')[1] ?? 'jpeg';
      const filePath = `${user.id}/avatar.${ext}`;

      if (!asset.base64) throw new Error('Image data unavailable');
      const binaryString = atob(asset.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, bytes, { contentType: mimeType, upsert: true });

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

  const loadProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email ?? null);
      setCurrentUserId(user.id);

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

      setProfile({
        username: p?.username ?? null,
        full_name: p?.full_name ?? null,
        vp_total: p?.vp_total ?? 0,
        preferred_sports: p?.preferred_sports ?? [],
        avatar_url: p?.avatar_url ?? null,
      });
      if (p?.avatar_url) {
        const resolved = await resolveAvatarUrl(p.avatar_url);
        if (resolved) setAvatarUri(resolved);
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

      const { data: feedRows } = await supabase
        .from('match_feed')
        .select('id, sport_name, match_type, status, created_at, scheduled_at, started_at, location_name, match_format, is_public, participants, games')
        .order('created_at', { ascending: false })
        .limit(80);
      const rows = (feedRows ?? []) as MatchHistoryItem[];
      const myMatches = rows.filter((m) =>
        (m.participants ?? []).some((p: { user_id?: string }) => String(p?.user_id) === String(user.id))
      );
      setMatchHistory(myMatches.slice(0, 30));
    } catch { /* swallow */ } finally { setLoadingProfile(false); }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const onRefreshProfile = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, [loadProfile]);

  useEffect(() => {
    if (!currentUserId) return;
    const refreshCounts = async () => {
      const { count: fing } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', currentUserId);
      const { count: fers } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', currentUserId);
      setFollowingCount(fing ?? 0);
      setFollowerCount(fers ?? 0);
    };
    const channel = supabase
      .channel(`profile-follows-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `follower_id=eq.${currentUserId}` },
        refreshCounts,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `followed_id=eq.${currentUserId}` },
        refreshCounts,
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

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

  const top3Rankings = useMemo(() => {
    const withStats = [...rankingsData.filter((r) => r.vp > 0 || r.rank_tier || r.wins > 0 || r.losses > 0)].sort((a, b) => b.vp - a.vp);
    const result = withStats.slice(0, 3);
    if (result.length < 3) {
      const usedSports = new Set(result.map((r) => r.sport));
      const preferred = profile?.preferred_sports ?? [];
      const fillers = [...preferred, ...SPORTS].filter((s) => !usedSports.has(s));
      for (const s of fillers) {
        if (result.length >= 3) break;
        const r = rankingsData.find((rd) => rd.sport === s);
        result.push(r ?? { sport: s, rank_tier: null, rank_div: null, vp: 0, wins: 0, losses: 0 });
      }
    }
    return result;
  }, [rankingsData, profile?.preferred_sports]);

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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Profile</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionBtn} activeOpacity={0.8} onPress={shareProfile}>
            <Ionicons name="share-outline" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionBtn} activeOpacity={0.8} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshProfile} />}>
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
                <TouchableOpacity
                  style={styles.socialItem}
                  onPress={() => currentUserId && navigation.navigate('FollowList', { userId: currentUserId, initialTab: 'following' })}
                  activeOpacity={0.8}
                >
                  <Text style={styles.socialValue}>{followingCount}</Text>
                  <Text style={styles.socialLabel}>Following</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.socialItem}
                  onPress={() => currentUserId && navigation.navigate('FollowList', { userId: currentUserId, initialTab: 'followers' })}
                  activeOpacity={0.8}
                >
                  <Text style={styles.socialValue}>{followerCount}</Text>
                  <Text style={styles.socialLabel}>Followers</Text>
                </TouchableOpacity>
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
            <View style={styles.ranksSection}>
              <Text style={styles.ranksSectionTitle}>Top 3 Ranks</Text>
              <View style={styles.ranksGrid}>
                {top3Rankings.map((item) => (
                  <View key={item.sport} style={styles.rankCard}>
                    <Text style={styles.rankCardEmoji}>{SPORT_EMOJI[item.sport] ?? '🏆'}</Text>
                    <Text style={styles.rankCardSport} numberOfLines={1}>{item.sport}</Text>
                    <Text style={styles.rankCardTier}>
                      {item.rank_tier ? `${item.rank_tier} ${item.rank_div ?? ''}`.trim() : 'Unranked'}
                    </Text>
                    <View style={styles.rankCardBottomRow}>
                      <View style={styles.rankCardStat}>
                        <Text style={styles.rankCardVp}>{item.vp}</Text>
                        <Text style={styles.rankCardVpLabel}>VP</Text>
                      </View>
                      <View style={styles.rankCardStat}>
                        <Text style={styles.rankCardStatValue}>{item.wins}</Text>
                        <Text style={styles.rankCardStatLabel}>W</Text>
                      </View>
                      <View style={styles.rankCardStat}>
                        <Text style={styles.rankCardStatValue}>{item.losses}</Text>
                        <Text style={styles.rankCardStatLabel}>L</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.ranksSectionTitle}>Preferred Sports</Text>
              <Text style={styles.sectionSubtitle}>Select up to {MAX_PREFERRED} sports you play the most.</Text>
            </View>
            <View style={styles.card}>
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

            <View style={styles.sectionHeader}>
              <Text style={styles.ranksSectionTitle}>Match History</Text>
            </View>
            {matchHistory.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.placeholder}>Recent wins, losses, and casual games will appear here.</Text>
              </View>
            ) : (
              <View style={styles.matchHistoryList}>
                {matchHistory.map((m, idx) => {
                  const myPart = (m.participants ?? []).find((p: { user_id?: string }) => String(p?.user_id) === String(currentUserId));
                  const others = (m.participants ?? []).filter((p: { user_id?: string }) => String(p?.user_id) !== String(currentUserId));
                  const opponentNames = others.map((p: { full_name?: string | null; username?: string | null }) => p?.full_name || p?.username || 'Opponent').join(', ');
                  const result = myPart?.result === 'win' ? 'Win' : myPart?.result === 'loss' ? 'Loss' : myPart?.result === 'draw' ? 'Draw' : m.status === 'completed' ? '—' : m.status;
                  const games = (m.games ?? []).filter((g: { score_challenger: number; score_opponent: number }) => g.score_challenger > 0 || g.score_opponent > 0);
                  const scoreStr = games.length > 0
                    ? games.map((g: { score_challenger: number; score_opponent: number }) => `${g.score_challenger}-${g.score_opponent}`).join(', ')
                    : null;
                  const dateStr = new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const vpDelta = myPart?.vp_delta ?? 0;
                  const vpStr = vpDelta !== 0 ? (vpDelta > 0 ? `+${vpDelta}` : `${vpDelta}`) + ' VP' : null;
                  const matchTypeLabel = String(m.match_type).charAt(0).toUpperCase() + String(m.match_type).slice(1);
                  const resultColor = result === 'Win' ? colors.primary : result === 'Loss' ? '#E53935' : colors.textSecondary;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={styles.matchHistoryItem}
                      onPress={() => navigation.navigate('Home', { scrollToMatchId: m.id })}
                      activeOpacity={0.8}
                    >
                      <View style={styles.matchHistoryRow}>
                        <Text style={styles.matchHistoryEmoji}>{SPORT_EMOJI[m.sport_name] ?? '🏆'}</Text>
                        <View style={styles.matchHistoryLeft}>
                          <Text style={styles.matchHistorySport} numberOfLines={1}>vs {opponentNames || '—'}</Text>
                          <Text style={styles.matchHistoryMeta} numberOfLines={1}>
                            {m.sport_name} • {matchTypeLabel} • {dateStr}{scoreStr ? ` • ${scoreStr}` : ''}
                          </Text>
                        </View>
                        <View style={styles.matchHistoryRight}>
                          <Text style={[styles.matchHistoryResult, { color: resultColor }]}>{result}</Text>
                          {vpStr ? <Text style={styles.matchHistoryVp}>{vpStr}</Text> : null}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* Rankings */}
        {tab === 'rankings' && (
          <>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => setRankIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
              scrollEventThrottle={16}
              snapToInterval={SCREEN_W}
              snapToAlignment="center"
              decelerationRate="fast"
              nestedScrollEnabled
            >
              {rankingsData.map((item) => (
                <View key={item.sport} style={styles.rankPage}>
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
              ))}
            </ScrollView>
            <View style={styles.rankDotsRow}>
              {rankingsData.map((item, i) => (
                <View key={item.sport} style={[styles.dot, i === rankIdx && styles.dotActive]} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
