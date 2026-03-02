import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../constants/theme';
import { supabase, resolveAvatarUrl } from '../lib/supabase';
import { SPORTS, SPORT_EMOJI } from '../constants/sports';

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

type SportRating = {
  sport: string;
  rank_tier: string | null;
  rank_div: string | null;
  vp: number;
  wins: number;
  losses: number;
};

import type { RootStackParamList } from '../navigation/RootNavigator';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: spacing.xxl },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: { padding: spacing.xs, marginRight: spacing.sm },
    headerTitle: { ...typography.heading, color: colors.text, flex: 1 },
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
    userName: { ...typography.heading, color: colors.text },
    userHandle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
    socialRow: { flexDirection: 'row', gap: spacing.xl },
    socialItem: { alignItems: 'center' },
    socialValue: { ...typography.heading, fontSize: 18, color: colors.text },
    socialLabel: { ...typography.caption, color: colors.textSecondary },
    followBtn: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      minHeight: 40,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    followBtnMuted: { backgroundColor: colors.border },
    followBtnText: { ...typography.label, fontSize: 14, color: colors.textOnPrimary },
    followBtnTextMuted: { color: colors.text },
    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
    messageBtn: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      minHeight: 40,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    messageBtnText: { ...typography.label, fontSize: 14, color: colors.primary },
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
    ranksSection: { marginHorizontal: spacing.lg, marginBottom: spacing.lg },
    ranksSectionTitle: { ...typography.heading, color: colors.text, marginBottom: spacing.md },
    ranksGrid: { flexDirection: 'row', gap: spacing.md, justifyContent: 'center' },
    rankCard: { flex: 1, minWidth: 0, backgroundColor: colors.cardBg, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', minHeight: 120 },
    rankCardEmoji: { fontSize: 28, marginBottom: spacing.xs },
    rankCardSport: { ...typography.label, color: colors.text, marginBottom: spacing.xs, textAlign: 'center' },
    rankCardTier: { ...typography.caption, color: colors.primary, fontWeight: '600', marginBottom: spacing.xs },
    rankCardVp: { ...typography.heading, fontSize: 22, color: colors.text },
    rankCardVpLabel: { ...typography.caption, color: colors.textSecondary, fontSize: 11 },
    rankCardStats: { flexDirection: 'row', marginTop: spacing.xs, gap: spacing.sm },
    rankCardStat: { alignItems: 'center' },
    rankCardStatValue: { ...typography.label, fontSize: 14, color: colors.text },
    rankCardStatLabel: { ...typography.caption, fontSize: 10, color: colors.textSecondary },
    card: { marginHorizontal: spacing.lg, backgroundColor: colors.cardBg, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
    cardTitle: { ...typography.heading, color: colors.text, marginBottom: spacing.sm },
    placeholder: { ...typography.caption, color: colors.textSecondary },
    matchHistoryItem: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
    matchHistoryItemLast: { borderBottomWidth: 0 },
    matchHistoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
    matchHistoryLeft: { flex: 1 },
    matchHistorySport: { ...typography.body, fontSize: 15, fontWeight: '600', color: colors.text },
    matchHistoryMeta: { ...typography.caption, fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
    matchHistoryResult: { ...typography.label, fontSize: 14, fontWeight: '600' },
    rankPage: { width: SCREEN_W - spacing.lg * 2, paddingHorizontal: spacing.lg },
    rankPageInner: { backgroundColor: colors.cardBg, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    rankEmoji: { fontSize: 48, marginBottom: spacing.sm },
    rankSport: { ...typography.heading, color: colors.text, marginBottom: spacing.xs },
    rankTier: { ...typography.body, color: colors.primary, marginBottom: spacing.md },
    rankStatRow: { flexDirection: 'row', gap: spacing.xl, marginBottom: spacing.md },
    rankStat: { alignItems: 'center' },
    rankStatValue: { ...typography.heading, fontSize: 20, color: colors.text },
    rankStatLabel: { ...typography.caption, color: colors.textSecondary },
    rankHint: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
    rankDotsRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.md, marginBottom: spacing.md },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    dotActive: { backgroundColor: colors.primary },
  });
}

export default function UserProfileScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'UserProfile'>>();
  const styles = createStyles(colors);

  const targetUserId = route.params?.userId ?? '';

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [rankIdx, setRankIdx] = useState(0);
  const [profile, setProfile] = useState<{ username: string | null; full_name: string | null; vp_total: number; preferred_sports: string[]; avatar_url: string | null } | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [followingCount, setFollowingCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [sportRatings, setSportRatings] = useState<SportRating[]>([]);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryItem[]>([]);
  const [followState, setFollowState] = useState<'none' | 'pending' | 'accepted'>('none');
  const [togglingFollow, setTogglingFollow] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!targetUserId) return;
    setLoadingProfile(true);
    try {
      const { data: p } = await supabase.from('profiles').select('username, full_name, vp_total, preferred_sports, avatar_url').eq('user_id', targetUserId).maybeSingle();
      const { count: fing } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetUserId).eq('status', 'accepted');
      const { count: fers } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', targetUserId).eq('status', 'accepted');
      const { data: ratings } = await supabase.from('user_sport_ratings').select('vp, rank_tier, rank_div, wins, losses, sports!inner(name)').eq('user_id', targetUserId);

      setProfile({
        username: p?.username ?? null,
        full_name: p?.full_name ?? null,
        vp_total: p?.vp_total ?? 0,
        preferred_sports: p?.preferred_sports ?? [],
        avatar_url: p?.avatar_url ?? null,
      });
      setFollowingCount(fing ?? 0);
      setFollowerCount(fers ?? 0);
      if (p?.avatar_url) {
        const url = await resolveAvatarUrl(p.avatar_url);
        if (url) setAvatarUri(url);
      }
      if (ratings) {
        setSportRatings((ratings as any[]).map((r) => ({
          sport: r.sports?.name ?? '?',
          rank_tier: r.rank_tier, rank_div: r.rank_div,
          vp: r.vp, wins: r.wins, losses: r.losses,
        })));
      }

      if (currentUserId && currentUserId !== targetUserId) {
        const { data: f } = await supabase.from('follows').select('status').eq('follower_id', currentUserId).eq('followed_id', targetUserId).maybeSingle();
        setFollowState((f as { status?: string })?.status === 'accepted' ? 'accepted' : (f as { status?: string })?.status === 'pending' ? 'pending' : 'none');
      }

      const { data: feedRows } = await supabase.from('match_feed').select('id, sport_name, match_type, status, created_at, scheduled_at, started_at, location_name, match_format, is_public, participants, games').order('created_at', { ascending: false }).limit(80);
      const rows = (feedRows ?? []) as MatchHistoryItem[];
      const theirMatches = rows.filter((m) => (m.participants ?? []).some((p: { user_id?: string }) => String(p?.user_id) === String(targetUserId)));
      setMatchHistory(theirMatches.slice(0, 30));
    } catch { /* swallow */ }
    finally { setLoadingProfile(false); }
  }, [targetUserId, currentUserId]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    })();
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  useEffect(() => {
    if (!targetUserId) return;
    const refreshCounts = async () => {
      const { count: fing } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetUserId).eq('status', 'accepted');
      const { count: fers } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', targetUserId).eq('status', 'accepted');
      setFollowingCount(fing ?? 0);
      setFollowerCount(fers ?? 0);
    };
    const channel = supabase
      .channel(`user-profile-follows-${targetUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `follower_id=eq.${targetUserId}` },
        refreshCounts,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `followed_id=eq.${targetUserId}` },
        refreshCounts,
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [targetUserId]);

  const rankingsData = useMemo(() => {
    const map = new Map(sportRatings.map((r) => [r.sport, r]));
    return SPORTS.map((s) => {
      const r = map.get(s);
      return { sport: s, rank_tier: r?.rank_tier ?? null, rank_div: r?.rank_div ?? null, vp: r?.vp ?? 0, wins: r?.wins ?? 0, losses: r?.losses ?? 0 };
    });
  }, [sportRatings]);

  const top3Rankings = useMemo(() => {
    const withStats = rankingsData.filter((r) => r.vp > 0 || r.rank_tier);
    if (withStats.length > 0) return [...withStats].sort((a, b) => b.vp - a.vp).slice(0, 3);
    const preferred = profile?.preferred_sports ?? [];
    const sportsToShow = preferred.length >= 3 ? preferred.slice(0, 3) : SPORTS.slice(0, 3);
    return sportsToShow.map((s) => {
      const r = rankingsData.find((rd) => rd.sport === s);
      return r ?? { sport: s, rank_tier: null, rank_div: null, vp: 0, wins: 0, losses: 0 };
    });
  }, [rankingsData, profile?.preferred_sports]);

  const sendFollowRequest = async () => {
    if (!currentUserId || togglingFollow || currentUserId === targetUserId) return;
    setTogglingFollow(true);
    try {
      if (followState === 'pending' || followState === 'accepted') {
        await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('followed_id', targetUserId);
        setFollowState('none');
        setFollowerCount((c) => Math.max(0, c - 1));
      } else {
        await supabase.from('follows').insert({ follower_id: currentUserId, followed_id: targetUserId, status: 'pending' });
        setFollowState('pending');
        const { data: myProfile } = await supabase.from('profiles').select('username, full_name').eq('user_id', currentUserId).maybeSingle();
        const displayName = (myProfile as { full_name?: string; username?: string })?.full_name ?? (myProfile as { full_name?: string; username?: string })?.username ?? 'Someone';
        await supabase
          .from('notifications')
          .delete()
          .match({ user_id: targetUserId, type: 'follow_request' })
          .eq('data->>from_user_id', String(currentUserId));
        await supabase.from('notifications').insert({
          user_id: targetUserId,
          type: 'follow_request',
          title: `${displayName} wants to follow you`,
          body: 'Accept or ignore this follow request.',
          data: { from_user_id: currentUserId },
        });
      }
    } catch { /* swallow */ }
    finally { setTogglingFollow(false); }
  };

  const initials = (profile?.full_name ?? profile?.username ?? '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  const isOwnProfile = currentUserId === targetUserId;

  if (!targetUserId) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.placeholder}>User not found</Text>
        <TouchableOpacity style={{ marginTop: spacing.md }} onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.primary }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{profile?.full_name || profile?.username || 'Profile'}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerCard}>
          {loadingProfile ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <View style={styles.avatarWrapper}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                )}
              </View>
              <Text style={styles.userName}>{profile?.full_name || profile?.username || 'Unknown'}</Text>
              <Text style={styles.userHandle}>@{profile?.username || 'username'}</Text>
              <View style={styles.socialRow}>
                <View style={styles.socialItem}>
                  <Text style={styles.socialValue}>{profile?.vp_total ?? 0}</Text>
                  <Text style={styles.socialLabel}>Total VP</Text>
                </View>
                <TouchableOpacity style={styles.socialItem} onPress={() => navigation.navigate('FollowList', { userId: targetUserId, initialTab: 'following' })} activeOpacity={0.8}>
                  <Text style={styles.socialValue}>{followingCount}</Text>
                  <Text style={styles.socialLabel}>Following</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.socialItem} onPress={() => navigation.navigate('FollowList', { userId: targetUserId, initialTab: 'followers' })} activeOpacity={0.8}>
                  <Text style={styles.socialValue}>{followerCount}</Text>
                  <Text style={styles.socialLabel}>Followers</Text>
                </TouchableOpacity>
              </View>
              {!isOwnProfile && currentUserId && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.followBtn, (followState === 'pending' || followState === 'accepted') && styles.followBtnMuted]}
                    onPress={sendFollowRequest}
                    disabled={togglingFollow}
                  >
                    {togglingFollow ? (
                      <ActivityIndicator size="small" color={followState !== 'none' ? colors.text : colors.textOnPrimary} />
                    ) : (
                      <Text style={[styles.followBtnText, (followState === 'pending' || followState === 'accepted') && styles.followBtnTextMuted]}>
                        {followState === 'accepted' ? 'Following' : followState === 'pending' ? 'Requested' : 'Follow'}
                      </Text>
                    )}
                  </TouchableOpacity>
                  {followState === 'accepted' && (
                    <TouchableOpacity
                      style={styles.messageBtn}
                      onPress={() => navigation.navigate('Chat', { userId: targetUserId })}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
                      <Text style={styles.messageBtnText}>Message</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, tab === 'overview' && styles.tabActive]} onPress={() => setTab('overview')} activeOpacity={0.8}>
            <Text style={[styles.tabText, tab === 'overview' && styles.tabTextActive]}>Overview</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'rankings' && styles.tabActive]} onPress={() => setTab('rankings')} activeOpacity={0.8}>
            <Text style={[styles.tabText, tab === 'rankings' && styles.tabTextActive]}>Rankings</Text>
          </TouchableOpacity>
        </View>

        {tab === 'overview' && (
          <>
            <View style={styles.ranksSection}>
              <Text style={styles.ranksSectionTitle}>Top 3 ranks</Text>
              <View style={styles.ranksGrid}>
                {top3Rankings.map((item) => (
                  <View key={item.sport} style={styles.rankCard}>
                    <Text style={styles.rankCardEmoji}>{SPORT_EMOJI[item.sport] ?? '🏆'}</Text>
                    <Text style={styles.rankCardSport} numberOfLines={1}>{item.sport}</Text>
                    <Text style={styles.rankCardTier}>{item.rank_tier ? `${item.rank_tier} ${item.rank_div ?? ''}`.trim() : 'Unranked'}</Text>
                    <Text style={styles.rankCardVp}>{item.vp}</Text>
                    <Text style={styles.rankCardVpLabel}>VP</Text>
                    <View style={styles.rankCardStats}>
                      <View style={styles.rankCardStat}><Text style={styles.rankCardStatValue}>{item.wins}</Text><Text style={styles.rankCardStatLabel}>W</Text></View>
                      <View style={styles.rankCardStat}><Text style={styles.rankCardStatValue}>{item.losses}</Text><Text style={styles.rankCardStatLabel}>L</Text></View>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Match history</Text>
              {matchHistory.length === 0 ? (
                <Text style={styles.placeholder}>No matches yet.</Text>
              ) : (
                matchHistory.map((m, idx) => {
                  const theirPart = (m.participants ?? []).find((p: { user_id?: string }) => String(p?.user_id) === String(targetUserId));
                  const others = (m.participants ?? []).filter((p: { user_id?: string }) => String(p?.user_id) !== String(targetUserId));
                  const opponentNames = others.map((p: { full_name?: string | null; username?: string | null }) => p?.full_name || p?.username || 'Opponent').join(', ');
                  const result = theirPart?.result === 'win' ? 'Win' : theirPart?.result === 'loss' ? 'Loss' : theirPart?.result === 'draw' ? 'Draw' : m.status === 'completed' ? '—' : m.status;
                  const games = (m.games ?? []).filter((g: { score_challenger: number; score_opponent: number }) => g.score_challenger > 0 || g.score_opponent > 0);
                  const scoreStr = games.length > 0 ? games.map((g: { score_challenger: number; score_opponent: number }) => `${g.score_challenger}-${g.score_opponent}`).join(', ') : null;
                  const dateStr = new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const timeStr = (m.started_at || m.scheduled_at || m.created_at) ? new Date(m.started_at || m.scheduled_at || m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;
                  const vpDelta = theirPart?.vp_delta ?? 0;
                  const vpStr = vpDelta !== 0 ? (vpDelta > 0 ? `+${vpDelta}` : `${vpDelta}`) + ' VP' : null;
                  const formatStr = (m.match_format || '1v1') === '2v2' ? '2v2' : '1v1';
                  const visibilityStr = m.is_public !== false ? 'Public' : 'Private';
                  const locationStr = m.location_name?.trim() || null;
                  const resultColor = result === 'Win' ? colors.primary : result === 'Loss' ? colors.error : colors.textSecondary;
                  return (
                    <View key={m.id} style={[styles.matchHistoryItem, idx === matchHistory.length - 1 && styles.matchHistoryItemLast]}>
                      <View style={styles.matchHistoryRow}>
                        <View style={styles.matchHistoryLeft}>
                          <Text style={styles.matchHistorySport}>{SPORT_EMOJI[m.sport_name] ?? '🏆'} {m.sport_name}</Text>
                          <Text style={styles.matchHistoryMeta}>
                            {dateStr}{timeStr ? ` at ${timeStr}` : ''} • {String(m.match_type).charAt(0).toUpperCase() + String(m.match_type).slice(1)} • {formatStr} • {visibilityStr}
                            {locationStr ? ` • ${locationStr}` : ''}
                            {'\n'}vs {opponentNames || '—'}
                            {(scoreStr || vpStr) ? ` • ${[scoreStr, vpStr].filter(Boolean).join(' • ')}` : ''}
                          </Text>
                        </View>
                        <Text style={[styles.matchHistoryResult, { color: resultColor }]}>{result}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        {tab === 'rankings' && (
          <>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => setRankIdx(Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - spacing.lg * 2)))}
              scrollEventThrottle={16}
              snapToInterval={SCREEN_W - spacing.lg * 2}
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
