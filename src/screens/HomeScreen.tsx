import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../constants/theme';
import { sportLabel, SPORT_EMOJI } from '../constants/sports';
import { supabase } from '../lib/supabase';
import UserSearch from '../components/UserSearch';
import type { SearchedUser } from '../components/UserSearch';

type FeedMode = 'public' | 'my';

type Participant = {
  user_id: string;
  role: string;
  result: string;
  score: string | null;
  vp_delta: number;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type FeedMatch = {
  id: string;
  created_at: string;
  scheduled_at: string | null;
  match_type: string;
  status: string;
  location_name: string | null;
  notes: string | null;
  created_by: string;
  sport_name: string;
  sport_slug: string;
  participants: Participant[];
  likes_count: number;
  comments_count: number;
};

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: { match_id?: string; from_user_id?: string };
  read: boolean;
  created_at: string;
};

function Avatar({
  initials,
  avatarUrl,
  size,
  colors,
  isWinner,
}: {
  initials: string;
  avatarUrl?: string | null;
  size: number;
  colors: ThemeColors;
  isWinner?: boolean;
}) {
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: isWinner ? colors.primary : colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: size * 0.38,
          fontWeight: '700',
          color: isWinner ? colors.textOnPrimary : colors.text,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

function getInitials(p: Participant): string {
  return (p.full_name ?? p.username ?? '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getName(p: Participant): string {
  return p.full_name ?? p.username ?? 'Unknown';
}

function FeedCard({
  item,
  currentUserId,
  styles,
  colors,
}: {
  item: FeedMatch;
  currentUserId: string | null;
  styles: ReturnType<typeof createHomeStyles>;
  colors: ThemeColors;
}) {
  const challenger = (item.participants ?? []).find((p) => p.role === 'challenger');
  const opponent = (item.participants ?? []).find((p) => p.role === 'opponent');
  const p1 = challenger ?? (item.participants ?? [])[0];
  const p2 = opponent ?? (item.participants ?? [])[1];

  if (!p1) return null;

  const isCompleted = item.status === 'completed';
  const winnerVp = Math.max(p1?.vp_delta ?? 0, p2?.vp_delta ?? 0);
  const vpChange = winnerVp > 0 ? `+${winnerVp}` : '0';
  const isWin = winnerVp > 0;

  const d = item.scheduled_at ? new Date(item.scheduled_at) : new Date(item.created_at);
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const statusLabel = item.status === 'pending' ? 'Pending' : item.status === 'confirmed' ? 'Confirmed' : item.status === 'completed' ? 'Completed' : item.status;

  const [liked, setLiked] = useState(false);

  return (
    <View style={styles.feedCard}>
      <View style={styles.playersRow}>
        <View style={styles.playerCol}>
          <Avatar
            initials={p1 ? getInitials(p1) : '?'}
            avatarUrl={p1?.avatar_url}
            size={44}
            colors={colors}
            isWinner={isCompleted && p1?.result === 'win'}
          />
          <Text style={styles.playerName} numberOfLines={1}>
            {p1?.user_id === currentUserId ? 'You' : getName(p1!)}
          </Text>
        </View>
        <View style={styles.vsCol}>
          <Text style={styles.vsText}>vs</Text>
          {isCompleted && p1?.score ? (
            <Text style={styles.scoreText}>{p1.score}</Text>
          ) : (
            <Text style={[styles.scoreText, { fontSize: 12, color: colors.textSecondary }]}>{statusLabel}</Text>
          )}
        </View>
        <View style={styles.playerCol}>
          {p2 ? (
            <>
              <Avatar
                initials={getInitials(p2)}
                avatarUrl={p2.avatar_url}
                size={44}
                colors={colors}
                isWinner={isCompleted && p2.result === 'win'}
              />
              <Text style={styles.playerName} numberOfLines={1}>
                {p2.user_id === currentUserId ? 'You' : getName(p2)}
              </Text>
            </>
          ) : (
            <>
              <Avatar initials="?" size={44} colors={colors} />
              <Text style={styles.playerName}>TBD</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.sportRow}>
        <Text style={styles.sportEmoji}>{SPORT_EMOJI[item.sport_name] ?? '🏆'}</Text>
        <Text style={styles.sportName}>{item.sport_name}</Text>
        {isCompleted && (
          <View style={[styles.vpPill, isWin ? styles.vpPillWin : styles.vpPillLoss]}>
            <Text style={[styles.vpPillText, isWin ? styles.vpTextWin : styles.vpTextLoss]}>
              {vpChange} VP
            </Text>
          </View>
        )}
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.detailText}>{dateStr}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.detailText}>{timeStr}</Text>
        </View>
        {item.match_type && (
          <View style={styles.detailItem}>
            <Ionicons name="trophy-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.detailText}>{item.match_type}</Text>
          </View>
        )}
      </View>

      {item.location_name && (
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.locationText}>{item.location_name}</Text>
        </View>
      )}

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setLiked((p) => !p)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={18}
            color={liked ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.actionLabel, liked && { color: colors.primary, fontWeight: '600' }]}>
            {liked ? 'Liked' : 'Like'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8}>
          <Ionicons name="chatbubble-outline" size={17} color={colors.textSecondary} />
          <Text style={styles.actionLabel}>Comment</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8}>
          <Ionicons name="share-outline" size={17} color={colors.textSecondary} />
          <Text style={styles.actionLabel}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createHomeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    topBarIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topBarTitle: { ...typography.heading, color: colors.text },
    topBarRight: { flexDirection: 'row', gap: spacing.sm },
    badge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.error,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    badgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
    switcherRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    switcherTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
    },
    switcherTabActive: { backgroundColor: colors.primary },
    switcherLabel: { ...typography.label, color: colors.textSecondary },
    switcherLabelActive: { color: colors.textOnPrimary },
    switcherHint: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.md,
      marginHorizontal: spacing.lg,
    },
    listContent: { paddingBottom: spacing.xxl, paddingHorizontal: spacing.lg },
    emptyFeed: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },

    feedCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    playersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    playerCol: { flex: 1, alignItems: 'center', gap: spacing.xs },
    playerName: { ...typography.label, color: colors.text, textAlign: 'center' },
    vsCol: { alignItems: 'center', paddingHorizontal: spacing.sm },
    vsText: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    scoreText: { ...typography.heading, fontSize: 16, color: colors.text },

    sportRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    sportEmoji: { fontSize: 18 },
    sportName: { ...typography.label, color: colors.primary, flex: 1, textTransform: 'uppercase' },
    vpPill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.full,
    },
    vpPillWin: { backgroundColor: 'rgba(45,106,45,0.12)' },
    vpPillLoss: { backgroundColor: 'rgba(185,28,28,0.1)' },
    vpPillText: { ...typography.label, fontSize: 11 },
    vpTextWin: { color: colors.success },
    vpTextLoss: { color: colors.error },

    detailsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    detailItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    detailText: { ...typography.caption, fontSize: 12, color: colors.textSecondary },

    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginBottom: spacing.sm,
    },
    locationText: { ...typography.caption, fontSize: 12, color: colors.textSecondary },

    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    actionLabel: { ...typography.caption, color: colors.textSecondary },

    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-start',
    },
    modalCard: {
      backgroundColor: colors.surface,
      marginTop: 60,
      marginHorizontal: spacing.lg,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      maxHeight: '70%',
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    modalTitle: { ...typography.heading, color: colors.text },
    searchInput: {
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.background,
      color: colors.text,
      marginBottom: spacing.md,
    },
    suggestedTitle: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
    suggestedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    suggestedName: { ...typography.body, color: colors.text, flex: 1 },
    suggestedHandle: { ...typography.caption, color: colors.textSecondary },
    addBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
    },
    addBtnText: { ...typography.label, color: colors.textOnPrimary },

    msgModalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl,
      maxHeight: '85%',
    },
    chatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    chatInfo: { flex: 1 },
    chatName: { ...typography.body, fontWeight: '600', color: colors.text },
    chatPreview: { ...typography.caption, color: colors.textSecondary },
    chatTime: { ...typography.caption, color: colors.textSecondary },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },

    /* ---- Notifications modal ---- */
    notifModalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl,
      maxHeight: '85%',
    },
    notifCard: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    notifIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notifContent: { flex: 1 },
    notifTitle: { ...typography.body, fontSize: 14, fontWeight: '600', color: colors.text },
    notifTitleUnread: { fontWeight: '700' },
    notifBody: { ...typography.caption, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    notifTime: { ...typography.caption, fontSize: 11, color: colors.border, marginTop: 4 },
    notifActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    notifAccept: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
    },
    notifAcceptText: { ...typography.label, color: colors.textOnPrimary },
    notifDecline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.error,
    },
    notifDeclineText: { ...typography.label, color: colors.error },
    notifUnreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginTop: 6,
    },
  });
}

const PLACEHOLDER_CHATS = [
  { id: '1', name: 'Alex M.', initials: 'AM', preview: 'Good game yesterday!', time: '2h ago' },
  { id: '2', name: 'Jamie P.', initials: 'JP', preview: 'Rematch this weekend?', time: '5h ago' },
  { id: '3', name: 'Pickleball Group', initials: 'PG', preview: "Who's free Saturday?", time: '1d ago' },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createHomeStyles(colors), [colors]);
  const [feedMode, setFeedMode] = useState<FeedMode>('my');
  const [searchVisible, setSearchVisible] = useState(false);
  const [messagesVisible, setMessagesVisible] = useState(false);
  const [notifsVisible, setNotifsVisible] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [feedItems, setFeedItems] = useState<FeedMatch[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [togglingFollow, setTogglingFollow] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: fRows } = await supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', user.id);
      if (fRows) setFollowingIds(new Set(fRows.map((r: any) => r.followed_id)));
    })();
  }, []);

  const toggleFollow = async (targetUserId: string) => {
    if (!currentUserId || togglingFollow) return;
    setTogglingFollow(targetUserId);
    try {
      const isFollowing = followingIds.has(targetUserId);
      if (isFollowing) {
        await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('followed_id', targetUserId);
        setFollowingIds((prev) => { const s = new Set(prev); s.delete(targetUserId); return s; });
      } else {
        await supabase.from('follows').insert({ follower_id: currentUserId, followed_id: targetUserId });
        setFollowingIds((prev) => new Set(prev).add(targetUserId));
      }
    } catch { /* swallow */ }
    finally { setTogglingFollow(null); }
  };

  const loadFeed = useCallback(async () => {
    setLoadingFeed(true);
    try {
      const { data } = await supabase
        .from('match_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setFeedItems((data ?? []) as FeedMatch[]);
    } catch { /* swallow */ }
    finally { setLoadingFeed(false); }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      const items = (data ?? []) as NotificationItem[];
      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.read).length);
    } catch { /* swallow */ }
  }, []);

  useEffect(() => { loadFeed(); loadNotifications(); }, [loadFeed, loadNotifications]);

  const myFeed = useMemo(
    () => feedItems.filter((m) => (m.participants ?? []).some((p) => p.user_id === currentUserId)),
    [feedItems, currentUserId],
  );
  const publicFeed = useMemo(
    () => feedItems.filter((m) => m.status === 'confirmed' || m.status === 'completed'),
    [feedItems],
  );
  const displayedItems = feedMode === 'my' ? myFeed : publicFeed;

  const handleAcceptInvite = async (notif: NotificationItem) => {
    const matchId = notif.data?.match_id;
    if (!matchId || !currentUserId) return;
    try {
      await supabase.from('matches').update({ status: 'confirmed' }).eq('id', matchId);
      await supabase.from('notifications').update({ read: true }).eq('id', notif.id);

      const fromUserId = notif.data?.from_user_id;
      if (fromUserId) {
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('username')
          .eq('user_id', currentUserId)
          .maybeSingle();
        await supabase.from('notifications').insert({
          user_id: fromUserId,
          type: 'match_accepted',
          title: `${myProfile?.username ?? 'Your opponent'} accepted!`,
          body: 'Your match is confirmed. Game on!',
          data: { match_id: matchId, from_user_id: currentUserId },
        });
      }

      loadNotifications();
      loadFeed();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not accept invite.');
    }
  };

  const handleDeclineInvite = async (notif: NotificationItem) => {
    const matchId = notif.data?.match_id;
    if (!matchId || !currentUserId) return;
    try {
      await supabase.from('matches').update({ status: 'canceled' }).eq('id', matchId);
      await supabase.from('notifications').update({ read: true }).eq('id', notif.id);

      const fromUserId = notif.data?.from_user_id;
      if (fromUserId) {
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('username')
          .eq('user_id', currentUserId)
          .maybeSingle();
        await supabase.from('notifications').insert({
          user_id: fromUserId,
          type: 'match_declined',
          title: `${myProfile?.username ?? 'Your opponent'} declined`,
          body: 'The match invite was declined.',
          data: { match_id: matchId, from_user_id: currentUserId },
        });
      }

      loadNotifications();
      loadFeed();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not decline invite.');
    }
  };

  const openNotifs = () => {
    setNotifsVisible(true);
    supabase
      .from('notifications')
      .update({ read: true })
      .eq('read', false)
      .then(() => {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      });
  };

  const notifIcon = (type: string) => {
    if (type === 'match_invite') return { name: 'flash' as const, bg: colors.primary };
    if (type === 'match_accepted') return { name: 'checkmark-circle' as const, bg: colors.success };
    if (type === 'match_declined') return { name: 'close-circle' as const, bg: colors.error };
    return { name: 'notifications' as const, bg: colors.textSecondary };
  };

  return (
    <View style={styles.container}>
      {/* ---- Top bar ---- */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBarIcon}
          activeOpacity={0.8}
          onPress={() => setSearchVisible(true)}
        >
          <Ionicons name="search" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Versus</Text>
        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={styles.topBarIcon}
            activeOpacity={0.8}
            onPress={openNotifs}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.text} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.topBarIcon}
            activeOpacity={0.8}
            onPress={() => setMessagesVisible(true)}
          >
            <Ionicons name="chatbubbles-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ---- Feed switcher ---- */}
      <View style={styles.switcherRow}>
        <TouchableOpacity
          style={[styles.switcherTab, feedMode === 'my' && styles.switcherTabActive]}
          onPress={() => setFeedMode('my')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="people"
            size={18}
            color={feedMode === 'my' ? colors.textOnPrimary : colors.textSecondary}
          />
          <Text style={[styles.switcherLabel, feedMode === 'my' && styles.switcherLabelActive]}>
            My feed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.switcherTab, feedMode === 'public' && styles.switcherTabActive]}
          onPress={() => setFeedMode('public')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="globe-outline"
            size={18}
            color={feedMode === 'public' ? colors.textOnPrimary : colors.textSecondary}
          />
          <Text style={[styles.switcherLabel, feedMode === 'public' && styles.switcherLabelActive]}>
            Public
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.switcherHint}>
        {feedMode === 'my' ? 'Matches you\'re part of' : 'All confirmed & completed matches'}
      </Text>

      {/* ---- Feed ---- */}
      {loadingFeed ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={displayedItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={() => { loadFeed(); loadNotifications(); }}
          refreshing={loadingFeed}
          ListEmptyComponent={
            <Text style={styles.emptyFeed}>
              {feedMode === 'my'
                ? 'No matches yet. Create one from the Plan tab!'
                : 'No public matches yet.'}
            </Text>
          }
          renderItem={({ item }) => (
            <FeedCard item={item} currentUserId={currentUserId} styles={styles} colors={colors} />
          )}
        />
      )}

      {/* ---- Search modal ---- */}
      <Modal visible={searchVisible} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setSearchVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Find people</Text>
              <TouchableOpacity onPress={() => setSearchVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <UserSearch
              colors={colors}
              excludeUserId={currentUserId ?? undefined}
              placeholder="Search by username or name..."
              onSelect={() => {}}
              renderAction={(user) => {
                const isFollowing = followingIds.has(user.user_id);
                return (
                  <TouchableOpacity
                    style={[styles.addBtn, isFollowing && { backgroundColor: colors.border }]}
                    activeOpacity={0.8}
                    onPress={() => toggleFollow(user.user_id)}
                    disabled={togglingFollow === user.user_id}
                  >
                    {togglingFollow === user.user_id ? (
                      <ActivityIndicator size="small" color={isFollowing ? colors.text : colors.textOnPrimary} />
                    ) : (
                      <Text style={[styles.addBtnText, isFollowing && { color: colors.text }]}>
                        {isFollowing ? 'Following' : 'Follow'}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ---- Notifications modal ---- */}
      <Modal visible={notifsVisible} transparent animationType="slide">
        <Pressable
          style={[styles.modalBackdrop, { justifyContent: 'flex-end' }]}
          onPress={() => setNotifsVisible(false)}
        >
          <Pressable style={styles.notifModalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setNotifsVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {notifications.length === 0 && (
                <Text style={styles.emptyText}>No notifications yet.</Text>
              )}
              {notifications.map((n) => {
                const icon = notifIcon(n.type);
                const isInvite = n.type === 'match_invite' && !n.read;
                return (
                  <View key={n.id} style={styles.notifCard}>
                    <View style={[styles.notifIconCircle, { backgroundColor: `${icon.bg}20` }]}>
                      <Ionicons name={icon.name} size={20} color={icon.bg} />
                    </View>
                    <View style={styles.notifContent}>
                      <Text style={[styles.notifTitle, !n.read && styles.notifTitleUnread]}>
                        {n.title}
                      </Text>
                      {n.body && <Text style={styles.notifBody}>{n.body}</Text>}
                      <Text style={styles.notifTime}>{timeAgo(n.created_at)}</Text>
                      {isInvite && (
                        <View style={styles.notifActions}>
                          <TouchableOpacity
                            style={styles.notifAccept}
                            activeOpacity={0.8}
                            onPress={() => handleAcceptInvite(n)}
                          >
                            <Ionicons name="checkmark" size={16} color={colors.textOnPrimary} />
                            <Text style={styles.notifAcceptText}>Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.notifDecline}
                            activeOpacity={0.8}
                            onPress={() => handleDeclineInvite(n)}
                          >
                            <Ionicons name="close" size={16} color={colors.error} />
                            <Text style={styles.notifDeclineText}>Decline</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                    {!n.read && <View style={styles.notifUnreadDot} />}
                  </View>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ---- Messages modal ---- */}
      <Modal visible={messagesVisible} transparent animationType="slide">
        <Pressable
          style={[styles.modalBackdrop, { justifyContent: 'flex-end' }]}
          onPress={() => setMessagesVisible(false)}
        >
          <Pressable style={styles.msgModalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Messages</Text>
              <TouchableOpacity onPress={() => setMessagesVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {PLACEHOLDER_CHATS.map((chat) => (
                <TouchableOpacity key={chat.id} style={styles.chatRow} activeOpacity={0.7}>
                  <Avatar initials={chat.initials} size={44} colors={colors} />
                  <View style={styles.chatInfo}>
                    <Text style={styles.chatName}>{chat.name}</Text>
                    <Text style={styles.chatPreview} numberOfLines={1}>
                      {chat.preview}
                    </Text>
                  </View>
                  <Text style={styles.chatTime}>{chat.time}</Text>
                </TouchableOpacity>
              ))}
              <Text style={styles.emptyText}>
                More chats will appear as you play matches and connect with friends.
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
