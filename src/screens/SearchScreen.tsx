import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../constants/theme';
import { supabase, resolveAvatarUrl } from '../lib/supabase';
import { requestContactsPermission, getContactHashes } from '../lib/contacts';
import UserSearch from '../components/UserSearch';
import type { SearchedUser } from '../components/UserSearch';

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
    recSection: { marginTop: spacing.lg },
    recTitle: {
      ...typography.label,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      fontSize: 11,
      marginBottom: spacing.sm,
    },
    recRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider ?? colors.border,
      gap: spacing.md,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImg: { width: 40, height: 40, borderRadius: 20 },
    initials: { fontSize: 14, fontWeight: '700', color: colors.textOnPrimary },
    info: { flex: 1 },
    name: { ...typography.body, fontSize: 14, fontWeight: '600', color: colors.text },
    handle: { ...typography.caption, color: colors.textSecondary },
    recLoader: { paddingVertical: spacing.lg, alignItems: 'center' },
    contactsBanner: {
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    contactsBannerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    contactsBannerTitle: {
      ...typography.body,
      fontSize: 14,
      fontWeight: '600' as const,
      color: colors.text,
      flex: 1,
    },
    contactsBannerSub: {
      ...typography.caption,
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    contactsBannerAllow: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
    },
    contactsBannerAllowText: { ...typography.label, color: colors.textOnPrimary },
    contactSubLabel: { ...typography.caption, color: colors.textSecondary, fontSize: 11 },
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
  const [searchQuery, setSearchQuery] = useState('');

  const [recommended, setRecommended] = useState<SearchedUser[]>([]);
  const [recLoading, setRecLoading] = useState(false);

  const [contactsGranted, setContactsGranted] = useState(false);
  const [contactsBannerVisible, setContactsBannerVisible] = useState(false);
  const [contactUsers, setContactUsers] = useState<SearchedUser[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  const loadContactMatches = useCallback(async (userId: string) => {
    setContactsLoading(true);
    try {
      const hashes = await getContactHashes();
      if (hashes.length === 0) return;
      const { data } = await supabase
        .from('profiles')
        .select('user_id, username, full_name, avatar_url')
        .in('phone_hash', hashes)
        .neq('user_id', userId);
      if (data) {
        const resolved = await Promise.all(
          (data as any[]).map(async (u) => ({
            user_id: u.user_id,
            username: u.username,
            full_name: u.full_name,
            avatar_url: (await resolveAvatarUrl(u.avatar_url)) ?? u.avatar_url,
          })),
        );
        setContactUsers(resolved);
      }
    } catch { /* swallow */ }
    finally { setContactsLoading(false); }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const stored = await AsyncStorage.getItem('contacts_permission');
      if (stored === 'granted') {
        setContactsGranted(true);
        loadContactMatches(user.id);
      } else if (stored !== 'dismissed') {
        setContactsBannerVisible(true);
      }

      const { data: fRows } = await supabase
        .from('follows')
        .select('followed_id, status')
        .eq('follower_id', user.id);
      const map: Record<string, 'pending' | 'accepted'> = {};
      if (fRows) {
        for (const r of fRows as { followed_id: string; status: string }[]) map[r.followed_id] = r.status as 'pending' | 'accepted';
        setFollowStates(map);
      }

      // Fetch recommended: top players by vp not already followed
      setRecLoading(true);
      try {
        const followedIds = Object.keys(map);
        const { data: recData } = await supabase
          .from('profiles')
          .select('user_id, username, full_name, avatar_url, vp_total')
          .neq('user_id', user.id)
          .not('user_id', 'in', followedIds.length > 0 ? `(${followedIds.join(',')})` : '(00000000-0000-0000-0000-000000000000)')
          .order('vp_total', { ascending: false })
          .limit(10);

        if (recData) {
          const resolved = await Promise.all(
            (recData as any[]).map(async (u) => ({
              user_id: u.user_id,
              username: u.username,
              full_name: u.full_name,
              avatar_url: (await resolveAvatarUrl(u.avatar_url)) ?? u.avatar_url,
            })),
          );
          setRecommended(resolved);
        }
      } catch { /* swallow */ }
      finally { setRecLoading(false); }
    })();
  }, [loadContactMatches]);

  const sendFollowRequest = useCallback(async (targetUserId: string) => {
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
        const displayName = (myProfile as any)?.full_name ?? (myProfile as any)?.username ?? 'Someone';
        await supabase.from('notifications').delete().match({ user_id: targetUserId, type: 'follow_request' }).eq('data->>from_user_id', String(currentUserId));
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
  }, [currentUserId, followStates, togglingFollow]);

  const renderFollowBtn = (user: SearchedUser) => {
    const state = followStates[user.user_id] ?? 'none';
    const label = state === 'accepted' ? 'Following' : state === 'pending' ? 'Pending' : 'Follow';
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
  };

  const handleAllowContacts = useCallback(async () => {
    const status = await requestContactsPermission();
    if (status === 'granted') {
      await AsyncStorage.setItem('contacts_permission', 'granted');
      setContactsGranted(true);
      setContactsBannerVisible(false);
      if (currentUserId) loadContactMatches(currentUserId);
    } else {
      await AsyncStorage.setItem('contacts_permission', 'dismissed');
      setContactsBannerVisible(false);
    }
  }, [currentUserId, loadContactMatches]);

  const handleDismissBanner = useCallback(async () => {
    await AsyncStorage.setItem('contacts_permission', 'dismissed');
    setContactsBannerVisible(false);
  }, []);

  const getInitials = (u: SearchedUser) =>
    (u.full_name ?? u.username ?? '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const showRecommended = searchQuery.trim().length < 2;

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
        <Text style={styles.hint}>Search by username or name</Text>
        <UserSearch
          colors={colors}
          excludeUserId={currentUserId ?? undefined}
          placeholder="Search by username or name..."
          onSelect={(user) => navigation.navigate('UserProfile', { userId: user.user_id })}
          onQueryChange={setSearchQuery}
          renderAction={(user) => renderFollowBtn(user)}
        />

        {showRecommended && (
          <>
            {/* Contacts banner */}
            {contactsBannerVisible && (
              <View style={styles.contactsBanner}>
                <View style={styles.contactsBannerHeader}>
                  <Ionicons name="people-outline" size={16} color={colors.primary} />
                  <Text style={styles.contactsBannerTitle}>Find friends from your contacts</Text>
                  <TouchableOpacity onPress={handleDismissBanner} hitSlop={10} activeOpacity={0.7}>
                    <Ionicons name="close" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.contactsBannerSub}>See which of your contacts are already on Versus</Text>
                <TouchableOpacity style={styles.contactsBannerAllow} onPress={handleAllowContacts} activeOpacity={0.8}>
                  <Text style={styles.contactsBannerAllowText}>Connect contacts</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* From your contacts section */}
            {(contactsGranted && (contactsLoading || contactUsers.length > 0)) && (
              <View style={styles.recSection}>
                <Text style={styles.recTitle}>From your contacts</Text>
                {contactsLoading ? (
                  <View style={styles.recLoader}><ActivityIndicator color={colors.primary} /></View>
                ) : (
                  <FlatList
                    data={contactUsers}
                    keyExtractor={(item) => item.user_id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.recRow}
                        onPress={() => navigation.navigate('UserProfile', { userId: item.user_id })}
                        activeOpacity={0.8}
                      >
                        <View style={styles.avatar}>
                          {item.avatar_url ? (
                            <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
                          ) : (
                            <Text style={styles.initials}>{getInitials(item)}</Text>
                          )}
                        </View>
                        <View style={styles.info}>
                          <Text style={styles.name} numberOfLines={1}>{item.full_name ?? item.username ?? 'Unknown'}</Text>
                          <Text style={styles.contactSubLabel}>In your contacts</Text>
                        </View>
                        {renderFollowBtn(item)}
                      </TouchableOpacity>
                    )}
                    scrollEnabled={false}
                  />
                )}
              </View>
            )}

            {/* Suggested for you section */}
            <View style={styles.recSection}>
              <Text style={styles.recTitle}>Suggested for you</Text>
              {recLoading ? (
                <View style={styles.recLoader}><ActivityIndicator color={colors.primary} /></View>
              ) : (
                <FlatList
                  data={recommended}
                  keyExtractor={(item) => item.user_id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.recRow}
                      onPress={() => navigation.navigate('UserProfile', { userId: item.user_id })}
                      activeOpacity={0.8}
                    >
                      <View style={styles.avatar}>
                        {item.avatar_url ? (
                          <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
                        ) : (
                          <Text style={styles.initials}>{getInitials(item)}</Text>
                        )}
                      </View>
                      <View style={styles.info}>
                        <Text style={styles.name} numberOfLines={1}>{item.full_name ?? item.username ?? 'Unknown'}</Text>
                        {item.username ? <Text style={styles.handle}>@{item.username}</Text> : null}
                      </View>
                      {renderFollowBtn(item)}
                    </TouchableOpacity>
                  )}
                  scrollEnabled={false}
                />
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
}
