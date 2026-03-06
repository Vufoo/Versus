import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../constants/theme';
import { supabase, resolveAvatarUrl } from '../lib/supabase';

type FollowTab = 'followers' | 'following';

type FollowUser = {
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  followStatus?: 'none' | 'pending' | 'accepted';
};

import type { RootStackParamList } from '../navigation/RootNavigator';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: { padding: spacing.xs, marginRight: spacing.sm },
    title: { ...typography.title, color: colors.text, flex: 1 },
    tabRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: colors.primary },
    tabText: { ...typography.label, color: colors.textSecondary },
    tabTextActive: { color: colors.primary, fontWeight: '600' },
    listContent: { paddingVertical: spacing.md },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImg: { width: 48, height: 48, borderRadius: 24 },
    avatarInitials: { ...typography.heading, fontSize: 18, color: colors.text },
    userInfo: { flex: 1 },
    userName: { ...typography.body, fontWeight: '600', color: colors.text },
    userHandle: { ...typography.caption, color: colors.textSecondary },
    followBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    followBtnMuted: { backgroundColor: colors.border, borderColor: colors.border },
    followBtnText: { ...typography.label, color: colors.primary },
    followBtnTextMuted: { color: colors.text },
    empty: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
  });
}

export default function FollowListScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'FollowList'>>();
  const styles = createStyles(colors);

  const userId = route.params?.userId ?? null;
  const initialTab = route.params?.initialTab ?? 'followers';

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<FollowTab>(initialTab);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [followStates, setFollowStates] = useState<Record<string, 'none' | 'pending' | 'accepted'>>({});
  const [togglingFollow, setTogglingFollow] = useState<string | null>(null);

  const targetUserId = userId ?? currentUserId;

  const loadFollowStates = useCallback(async () => {
    if (!currentUserId) return;
    const { data } = await supabase
      .from('follows')
      .select('followed_id, status')
      .eq('follower_id', currentUserId);
    const map: Record<string, 'pending' | 'accepted'> = {};
    (data ?? []).forEach((r: { followed_id: string; status: string }) => {
      map[r.followed_id] = r.status as 'pending' | 'accepted';
    });
    setFollowStates(map);
  }, [currentUserId]);

  const loadFollowers = useCallback(async () => {
    if (!targetUserId) return;
    const { data } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('followed_id', targetUserId)
      .eq('status', 'accepted');
    const ids = (data ?? []).map((r: { follower_id: string }) => r.follower_id);
    if (ids.length === 0) {
      setFollowers([]);
      return;
    }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, full_name, avatar_url')
      .in('user_id', ids);
    const users = (profiles ?? []) as FollowUser[];
    for (const u of users) {
      if (u.avatar_url) {
        const url = await resolveAvatarUrl(u.avatar_url);
        if (url) u.avatar_url = url;
      }
    }
    setFollowers(users);
  }, [targetUserId]);

  const loadFollowing = useCallback(async () => {
    if (!targetUserId) return;
    const { data } = await supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', targetUserId)
      .eq('status', 'accepted');
    const ids = (data ?? []).map((r: { followed_id: string }) => r.followed_id);
    if (ids.length === 0) {
      setFollowing([]);
      return;
    }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, full_name, avatar_url')
      .in('user_id', ids);
    const users = (profiles ?? []) as FollowUser[];
    for (const u of users) {
      if (u.avatar_url) {
        const url = await resolveAvatarUrl(u.avatar_url);
        if (url) u.avatar_url = url;
      }
    }
    setFollowing(users);
  }, [targetUserId]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    })();
  }, []);

  useEffect(() => {
    if (!targetUserId) return;
    setLoading(true);
    Promise.all([loadFollowers(), loadFollowing(), loadFollowStates()]).finally(() => setLoading(false));
  }, [targetUserId, loadFollowers, loadFollowing, loadFollowStates]);

  useEffect(() => {
    if (!targetUserId) return;
    const channel = supabase
      .channel(`follows-${targetUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows',
          filter: `follower_id=eq.${targetUserId}`,
        },
        () => {
          loadFollowers();
          loadFollowing();
          loadFollowStates();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows',
          filter: `followed_id=eq.${targetUserId}`,
        },
        () => {
          loadFollowers();
          loadFollowing();
          loadFollowStates();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [targetUserId, loadFollowers, loadFollowing, loadFollowStates]);

  const sendFollowRequest = async (targetId: string) => {
    if (!currentUserId || togglingFollow) return;
    setTogglingFollow(targetId);
    try {
      const current = followStates[targetId];
      if (current === 'pending' || current === 'accepted') {
        await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('followed_id', targetId);
        setFollowStates((prev) => { const n = { ...prev }; delete n[targetId]; return n; });
        if (isOwnProfile && tab === 'following') {
          setFollowing((prev) => prev.filter((u) => u.user_id !== targetId));
        }
      } else {
        await supabase.from('follows').insert({ follower_id: currentUserId, followed_id: targetId, status: 'pending' });
        setFollowStates((prev) => ({ ...prev, [targetId]: 'pending' }));
        const { data: myProfile } = await supabase.from('profiles').select('username, full_name').eq('user_id', currentUserId).maybeSingle();
        const displayName = (myProfile as { full_name?: string; username?: string })?.full_name ?? (myProfile as { full_name?: string; username?: string })?.username ?? 'Someone';
        await supabase
          .from('notifications')
          .delete()
          .match({ user_id: targetId, type: 'follow_request' })
          .eq('data->>from_user_id', String(currentUserId));
        await supabase.from('notifications').insert({
          user_id: targetId,
          type: 'follow_request',
          title: `${displayName} wants to follow you`,
          body: 'Accept or ignore this follow request.',
          data: { from_user_id: currentUserId },
        });
      }
    } catch { /* swallow */ }
    finally { setTogglingFollow(null); }
  };

  const data = tab === 'followers' ? followers : following;
  const isOwnProfile = !userId || userId === currentUserId;

  const renderUser = ({ item }: { item: FollowUser }) => {
    const state = followStates[item.user_id] ?? 'none';
    const label = state === 'accepted' ? 'Following' : state === 'pending' ? 'Pending' : 'Follow';
    const isMuted = state !== 'none';
    const showFollowBtn = (isOwnProfile && tab === 'following') || (!isOwnProfile && currentUserId && item.user_id !== currentUserId);

    return (
      <View style={styles.userRow}>
        <TouchableOpacity
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('UserProfile', { userId: item.user_id })}
        >
          <View style={styles.avatar}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarInitials}>
                {(item.full_name ?? item.username ?? '?').slice(0, 2).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.full_name || item.username || 'Unknown'}</Text>
            {item.username && <Text style={styles.userHandle}>@{item.username}</Text>}
          </View>
        </TouchableOpacity>
        {showFollowBtn && (
          <TouchableOpacity
            style={[styles.followBtn, isMuted && styles.followBtnMuted]}
            onPress={() => sendFollowRequest(item.user_id)}
            disabled={togglingFollow === item.user_id}
          >
            {togglingFollow === item.user_id ? (
              <ActivityIndicator size="small" color={isMuted ? colors.text : colors.primary} />
            ) : (
              <Text style={[styles.followBtnText, isMuted && styles.followBtnTextMuted]}>{label}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{tab === 'followers' ? 'Followers' : 'Following'}</Text>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'followers' && styles.tabActive]}
          onPress={() => setTab('followers')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, tab === 'followers' && styles.tabTextActive]}>Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'following' && styles.tabActive]}
          onPress={() => setTab('following')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, tab === 'following' && styles.tabTextActive]}>Following</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.user_id}
          renderItem={renderUser}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {tab === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
            </Text>
          }
        />
      )}
    </View>
  );
}
