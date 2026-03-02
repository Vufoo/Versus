import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
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

  const loadFollowers = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const uid = user.id;
    setCurrentUserId(uid);

    const { data: followRows } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('followed_id', uid)
      .eq('status', 'accepted');
    const followerIds = (followRows ?? []).map((r: { follower_id: string }) => r.follower_id);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, full_name, avatar_url')
      .in('user_id', followerIds.length ? followerIds : ['00000000-0000-0000-0000-000000000000']);
    const list = (profiles ?? []).filter((p: FollowerEntry) => p.user_id !== uid) as FollowerEntry[];
    setFollowers(list);
    list.forEach((p) => {
      if (p.avatar_url) {
        resolveAvatarUrl(p.avatar_url).then((url) => {
          if (url) setAvatarUrls((prev) => ({ ...prev, [p.user_id]: url }));
        });
      }
    });

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

  useEffect(() => {
    loadFollowers();
  }, [loadFollowers]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Messages</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {followers.length === 0 ? (
            <Text style={styles.emptyText}>
              Your followers will appear here. When someone follows you and you're both connected, you can message them.
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
                <TouchableOpacity
                  key={f.user_id}
                  style={styles.chatRow}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('Chat', { userId: f.user_id })}
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
                  <View style={styles.chatInfo}>
                    <View style={styles.chatTopRow}>
                      <Text style={styles.chatName}>{f.full_name || f.username || 'User'}</Text>
                      {meta?.latestCreatedAt ? (
                        <Text style={styles.chatDate}>{formatMessageDate(meta.latestCreatedAt)}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.chatPreview} numberOfLines={1}>
                      {preview}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}
