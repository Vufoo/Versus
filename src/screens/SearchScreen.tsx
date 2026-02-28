import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../constants/theme';
import { supabase } from '../lib/supabase';
import UserSearch from '../components/UserSearch';

function createSearchStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: { ...typography.title, color: colors.text },
    backBtn: { padding: spacing.xs },
    content: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    hint: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    addBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
    },
    addBtnMuted: { backgroundColor: colors.border },
    addBtnText: { ...typography.label, color: colors.textOnPrimary },
    addBtnTextMuted: { color: colors.text },
  });
}

export default function SearchScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const styles = createSearchStyles(colors);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followStates, setFollowStates] = useState<Record<string, 'none' | 'pending' | 'accepted'>>({});
  const [togglingFollow, setTogglingFollow] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: fRows } = await supabase
        .from('follows')
        .select('followed_id, status')
        .eq('follower_id', user.id);
      if (fRows) {
        const map: Record<string, 'pending' | 'accepted'> = {};
        for (const r of fRows as { followed_id: string; status: string }[]) map[r.followed_id] = r.status as 'pending' | 'accepted';
        setFollowStates(map);
      }
    })();
  }, []);

  const sendFollowRequest = async (targetUserId: string) => {
    if (!currentUserId || togglingFollow) return;
    setTogglingFollow(targetUserId);
    try {
      const current = followStates[targetUserId];
      if (current === 'pending' || current === 'accepted') {
        await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('followed_id', targetUserId);
        setFollowStates((prev) => { const next = { ...prev }; delete next[targetUserId]; return next; });
      } else {
        await supabase.from('follows').insert({ follower_id: currentUserId, followed_id: targetUserId, status: 'pending' });
        setFollowStates((prev) => ({ ...prev, [targetUserId]: 'pending' }));

        const { data: myProfile } = await supabase.from('profiles').select('username, full_name').eq('user_id', currentUserId).maybeSingle();
        const displayName = (myProfile as { full_name?: string; username?: string })?.full_name ?? (myProfile as { full_name?: string; username?: string })?.username ?? 'Someone';
        await supabase.from('notifications').insert({
          user_id: targetUserId,
          type: 'follow_request',
          title: `${displayName} wants to follow you`,
          body: 'Accept or ignore this follow request.',
          data: { from_user_id: currentUserId },
        });
      }
    } catch { /* swallow */ }
    finally { setTogglingFollow(null); }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Find people</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.content}>
        <Text style={styles.hint}>Search by username or name (min 2 characters)</Text>
        <UserSearch
          colors={colors}
          excludeUserId={currentUserId ?? undefined}
          placeholder="Search by username or name..."
          onSelect={(user) => navigation.navigate('UserProfile', { userId: user.user_id })}
          renderAction={(user) => {
            const state = followStates[user.user_id] ?? 'none';
            const label = state === 'accepted' ? 'Following' : state === 'pending' ? 'Requested' : 'Follow';
            const isMuted = state !== 'none';
            return (
              <TouchableOpacity
                style={[styles.addBtn, isMuted && styles.addBtnMuted]}
                activeOpacity={0.8}
                onPress={() => sendFollowRequest(user.user_id)}
                disabled={togglingFollow === user.user_id}
              >
                {togglingFollow === user.user_id ? (
                  <ActivityIndicator size="small" color={isMuted ? colors.text : colors.textOnPrimary} />
                ) : (
                  <Text style={[styles.addBtnText, isMuted && styles.addBtnTextMuted]}>{label}</Text>
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </View>
  );
}
