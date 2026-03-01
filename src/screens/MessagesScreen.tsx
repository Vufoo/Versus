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
    chatName: { ...typography.body, fontWeight: '600', color: colors.text },
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

export default function MessagesScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followers, setFollowers] = useState<FollowerEntry[]>([]);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const loadFollowers = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setCurrentUserId(user.id);
    const { data: followRows } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('followed_id', user.id)
      .eq('status', 'accepted');
    const followerIds = (followRows ?? []).map((r: { follower_id: string }) => r.follower_id);
    if (followerIds.length === 0) {
      setFollowers([]);
      setLoading(false);
      return;
    }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, full_name, avatar_url')
      .in('user_id', followerIds);
    const list = (profiles ?? []) as FollowerEntry[];
    setFollowers(list);
    list.forEach((p) => {
      if (p.avatar_url) {
        resolveAvatarUrl(p.avatar_url).then((url) => {
          if (url) setAvatarUrls((prev) => ({ ...prev, [p.user_id]: url }));
        });
      }
    });
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
            followers.map((f) => (
              <TouchableOpacity
                key={f.user_id}
                style={styles.chatRow}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Chat', { userId: f.user_id })}
              >
                <View style={styles.avatar}>
                  {avatarUrls[f.user_id] ? (
                    <Image source={{ uri: avatarUrls[f.user_id] }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitials}>{getInitials(f.full_name, f.username)}</Text>
                  )}
                </View>
                <View style={styles.chatInfo}>
                  <Text style={styles.chatName}>{f.full_name || f.username || 'User'}</Text>
                  <Text style={styles.chatPreview} numberOfLines={1}>
                    {f.username ? `@${f.username}` : 'Tap to message'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
