import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import { supabase, resolveAvatarUrl } from '../lib/supabase';
import { SPORTS, sportLabel } from '../constants/sports';

type LeaderEntry = {
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  rank_tier: string | null;
  rank_div: string | null;
  vp: number;
};

function tierColor(tier: string | null): string {
  switch (tier) {
    case 'Beginner': return '#9E9E9E';
    case 'Bronze': return '#CD7F32';
    case 'Silver': return '#C0C0C0';
    case 'Gold': return '#FFD700';
    case 'Platinum': return '#00BCD4';
    case 'Diamond': return '#64B5F6';
    case 'Pro': return '#F44336';
    default: return '#9E9E9E';
  }
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      gap: spacing.sm,
    },
    headerTitle: { ...typography.title, color: c.text, flex: 1 },
    sportsRow: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    sportsContent: { gap: spacing.sm },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.background,
    },
    chipSel: { backgroundColor: c.primary, borderColor: c.primaryDark },
    chipText: { ...typography.label, color: c.textSecondary },
    chipTextSel: { color: c.textOnPrimary },
    listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty: { ...typography.body, color: c.textSecondary, textAlign: 'center', marginTop: spacing.xxl },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: 1,
      borderBottomColor: c.divider ?? c.border,
      gap: spacing.md,
    },
    rankNum: {
      ...typography.label,
      fontSize: 15,
      fontWeight: '700',
      color: c.textSecondary,
      width: 28,
      textAlign: 'center',
    },
    rankNumTop: { color: c.primary },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImg: { width: 40, height: 40, borderRadius: 20 },
    initials: { fontSize: 14, fontWeight: '700', color: c.textOnPrimary },
    info: { flex: 1 },
    name: { ...typography.body, fontSize: 14, fontWeight: '600', color: c.text },
    handle: { ...typography.caption, color: c.textSecondary, marginTop: 1 },
    tierBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
    },
    tierText: { ...typography.caption, fontSize: 11, fontWeight: '700' },
    vp: { ...typography.caption, fontSize: 12, color: c.textSecondary, marginTop: 1, textAlign: 'right' },
    medalGold: { fontSize: 18 },
  });
}

export default function LeaderboardScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [sport, setSport] = useState<string>(SPORTS[0]);
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (sportName: string) => {
    setLoading(true);
    try {
      const { data: sportRow } = await supabase
        .from('sports')
        .select('id')
        .eq('name', sportName)
        .maybeSingle();
      if (!sportRow) { setEntries([]); return; }

      const { data } = await supabase
        .from('user_sport_ratings')
        .select('user_id, vp, rank_tier, rank_div, profiles!inner(username, full_name, avatar_url)')
        .eq('sport_id', sportRow.id)
        .order('vp', { ascending: false })
        .limit(25);

      if (!data) { setEntries([]); return; }

      const resolved = await Promise.all(
        (data as any[]).map(async (r) => ({
          user_id: r.user_id,
          username: r.profiles?.username ?? null,
          full_name: r.profiles?.full_name ?? null,
          avatar_url: (await resolveAvatarUrl(r.profiles?.avatar_url)) ?? r.profiles?.avatar_url ?? null,
          rank_tier: r.rank_tier,
          rank_div: r.rank_div,
          vp: r.vp,
        })),
      );
      setEntries(resolved);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(sport); }, [sport, load]);

  const getInitials = (e: LeaderEntry) =>
    (e.full_name ?? e.username ?? '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const medals = ['🥇', '🥈', '🥉'];

  const renderItem = ({ item, index }: { item: LeaderEntry; index: number }) => {
    const color = tierColor(item.rank_tier);
    const isTop3 = index < 3;
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('UserProfile', { userId: item.user_id })}
        activeOpacity={0.8}
      >
        {isTop3 ? (
          <Text style={styles.medalGold}>{medals[index]}</Text>
        ) : (
          <Text style={[styles.rankNum, index < 3 && styles.rankNumTop]}>{index + 1}</Text>
        )}
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
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          {item.rank_tier ? (
            <View style={[styles.tierBadge, { borderColor: color }]}>
              <Text style={[styles.tierText, { color }]}>{item.rank_tier}{item.rank_div ? ` ${item.rank_div}` : ''}</Text>
            </View>
          ) : null}
          <Text style={styles.vp}>{item.vp} VP</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leaderboards</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sportsRow}
        contentContainerStyle={styles.sportsContent}
      >
        {SPORTS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, s === sport && styles.chipSel]}
            onPress={() => setSport(s)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, s === sport && styles.chipTextSel]}>{sportLabel(s)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.user_id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.empty}>No ranked players yet for {sport}.</Text>}
        />
      )}
    </View>
  );
}
