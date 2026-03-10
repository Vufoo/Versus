import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../constants/theme';
import { supabase, resolveAvatarUrl } from '../lib/supabase';

type FollowerEntry = {
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type ConversationMeta = {
  conversationId: string;
  latestBody: string | null;
  latestFromOther: boolean;
  latestCreatedAt: string;
  lastReadAt: string | null;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: { ...typography.heading, color: colors.text },
    chatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    chatInfo: { flex: 1 },
    chatTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 },
    chatName: { ...typography.body, fontWeight: '600', color: colors.text },
    chatDate: { ...typography.caption, fontSize: 12, color: colors.textSecondary },
    chatPreview: { ...typography.caption, color: colors.textSecondary },
    emptyText: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.xl,
      marginHorizontal: spacing.lg,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarWrapper: { position: 'relative' },
    unreadDot: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#007AFF',
      borderWidth: 2,
      borderColor: colors.background,
    },
    avatarImage: { width: 44, height: 44, borderRadius: 22 },
    avatarInitials: { fontSize: 16, fontWeight: '700', color: colors.text },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    composeBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    composeSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: spacing.xl, maxHeight: '70%' },
    composeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    composeTitle: { ...typography.heading, color: colors.text },
    composeEmpty: { ...typography.body, color: colors.textSecondary, textAlign: 'center', padding: spacing.xl },
  });
}

function getInitials(fullName: string | null, username: string | null): string {
  if (fullName?.trim()) {
    return fullName.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  }
  if (username?.trim()) return username.trim().slice(0, 2).toUpperCase();
  return '?';
}

function formatMessageDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

export default function MessagesScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followers, setFollowers] = useState<FollowerEntry[]>([]);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const [conversationByUser, setConversationByUser] = useState<Record<string, ConversationMeta>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeFollowing, setComposeFollowing] = useState<FollowerEntry[]>([]);
  const [composeAvatarUrls, setComposeAvatarUrls] = useState<Record<string, string>>({});
  const [composeLoading, setComposeLoading] = useState(false);

  const loadFollowers = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const uid = user.id;
    setCurrentUserId(uid);

    // Accepted followers (people who follow you)
    const { data: followRows } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('followed_id', uid)
      .eq('status', 'accepted');
    const followerIds = (followRows ?? []).map((r: { follower_id: string }) => r.follower_id);

    // All conversations you are part of
    const { data: convos } = await supabase
      .from('dm_conversations')
      .select('id, user1_id, user2_id')
      .or(`user1_id.eq.${uid},user2_id.eq.${uid}`);
    const convList = (convos ?? []) as { id: string; user1_id: string; user2_id: string }[];
    const convIds = convList.map((c) => c.id);
    const otherByConv: Record<string, string> = {};
    convList.forEach((c) => {
      const other = c.user1_id === uid ? c.user2_id : c.user1_id;
      otherByConv[c.id] = other;
    });

    // Build unified list of people we have a DM with OR who follow us.
    const conversationUserIds = Array.from(new Set(Object.values(otherByConv)));
    const profileIds = Array.from(new Set([...followerIds, ...conversationUserIds])).filter(
      (id) => id && id !== uid,
    );

    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, full_name, avatar_url')
        .in('user_id', profileIds);
      const list = (profiles ?? []) as FollowerEntry[];
      setFollowers(list);
      list.forEach((p) => {
        if (p.avatar_url) {
          resolveAvatarUrl(p.avatar_url).then((url) => {
            if (url) setAvatarUrls((prev) => ({ ...prev, [p.user_id]: url }));
          });
        }
      });
    } else {
      setFollowers([]);
    }

    const readMap: Record<string, string> = {};
    if (convIds.length > 0) {
      const { data: readRows } = await supabase
        .from('dm_conversation_read')
        .select('conversation_id, last_read_at')
        .eq('user_id', uid)
        .in('conversation_id', convIds);
      (readRows ?? []).forEach((r: { conversation_id: string; last_read_at: string }) => {
        readMap[r.conversation_id] = r.last_read_at;
      });
    }

    let messages: { conversation_id: string; sender_id: string; body: string; created_at: string }[] = [];
    if (convIds.length > 0) {
      const { data: msgRows } = await supabase
        .from('dm_messages')
        .select('conversation_id, sender_id, body, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false });
      messages = (msgRows ?? []) as { conversation_id: string; sender_id: string; body: string; created_at: string }[];
    }

    const latestByConv: Record<string, { body: string; sender_id: string; created_at: string }> = {};
    messages.forEach((m) => {
      if (!latestByConv[m.conversation_id]) {
        latestByConv[m.conversation_id] = { body: m.body, sender_id: m.sender_id, created_at: m.created_at };
      }
    });

    const metaByUser: Record<string, ConversationMeta> = {};
    convList.forEach((c) => {
      const otherId = otherByConv[c.id];
      const latest = latestByConv[c.id];
      if (!otherId) return;
      const lastReadAt = readMap[c.id] ?? null;
      if (!latest) {
        metaByUser[otherId] = {
          conversationId: c.id,
          latestBody: null,
          latestFromOther: false,
          latestCreatedAt: '',
          lastReadAt,
        };
        return;
      }
      metaByUser[otherId] = {
        conversationId: c.id,
        latestBody: latest.body,
        latestFromOther: latest.sender_id !== uid,
        latestCreatedAt: latest.created_at,
        lastReadAt,
      };
    });
    setConversationByUser(metaByUser);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFollowers();
    }, [loadFollowers]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFollowers();
    setRefreshing(false);
  }, [loadFollowers]);

  const openCompose = async () => {
    if (!currentUserId) return;
    setComposeOpen(true);
    setComposeLoading(true);
    const { data: followRows } = await supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', currentUserId)
      .eq('status', 'accepted');
    const ids = (followRows ?? []).map((r: any) => r.followed_id);
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, full_name, avatar_url')
        .in('user_id', ids);
      const list = (profiles ?? []) as FollowerEntry[];
      setComposeFollowing(list);
      list.forEach((p) => {
        if (p.avatar_url) {
          resolveAvatarUrl(p.avatar_url).then((url) => {
            if (url) setComposeAvatarUrls((prev) => ({ ...prev, [p.user_id]: url }));
          });
        }
      });
    } else {
      setComposeFollowing([]);
    }
    setComposeLoading(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Messages</Text>
        <TouchableOpacity onPress={openCompose} hitSlop={12}>
          <Ionicons name="create-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {followers.length === 0 ? (
            <Text style={styles.emptyText}>
              Your conversations will appear here. Start a chat from a profile or from your followers.
            </Text>
          ) : (
            followers.map((f) => {
              const meta = conversationByUser[f.user_id];
              const preview = meta?.latestBody ?? (f.username ? `@${f.username}` : 'Tap to message');
              const unread = Boolean(
                meta?.latestFromOther &&
                meta?.latestCreatedAt &&
                (!meta?.lastReadAt || new Date(meta.latestCreatedAt) > new Date(meta.lastReadAt))
              );
              return (
                <View key={f.user_id} style={styles.chatRow}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('UserProfile', { userId: f.user_id })}
                  >
                    <View style={styles.avatarWrapper}>
                      <View style={styles.avatar}>
                        {avatarUrls[f.user_id] ? (
                          <Image source={{ uri: avatarUrls[f.user_id] }} style={styles.avatarImage} />
                        ) : (
                          <Text style={styles.avatarInitials}>{getInitials(f.full_name, f.username)}</Text>
                        )}
                      </View>
                      {unread && <View style={styles.unreadDot} />}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.chatInfo}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('Chat', { userId: f.user_id })}
                  >
                    <View style={styles.chatTopRow}>
                      <Text style={styles.chatName}>{f.full_name || f.username || 'User'}</Text>
                      {meta?.latestCreatedAt ? (
                        <Text style={styles.chatDate}>{formatMessageDate(meta.latestCreatedAt)}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.chatPreview} numberOfLines={1}>
                      {preview}
                    </Text>
                  </TouchableOpacity>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <Modal visible={composeOpen} transparent animationType="slide" onRequestClose={() => setComposeOpen(false)}>
        <View style={styles.composeBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setComposeOpen(false)} />
          <View style={styles.composeSheet}>
            <View style={styles.composeHeader}>
              <Text style={styles.composeTitle}>New Message</Text>
              <TouchableOpacity onPress={() => setComposeOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {composeLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ padding: spacing.xl }} />
            ) : composeFollowing.length === 0 ? (
              <Text style={styles.composeEmpty}>Follow someone to start a conversation.</Text>
            ) : (
              <FlatList
                data={composeFollowing}
                keyExtractor={(item) => item.user_id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.chatRow}
                    activeOpacity={0.7}
                    onPress={() => { setComposeOpen(false); navigation.navigate('Chat', { userId: item.user_id }); }}
                  >
                    <View style={styles.avatar}>
                      {composeAvatarUrls[item.user_id] ? (
                        <Image source={{ uri: composeAvatarUrls[item.user_id] }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatarInitials}>{getInitials(item.full_name, item.username)}</Text>
                      )}
                    </View>
                    <View style={styles.chatInfo}>
                      <Text style={styles.chatName}>{item.full_name || item.username || 'User'}</Text>
                      {item.username ? <Text style={styles.chatPreview}>@{item.username}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
