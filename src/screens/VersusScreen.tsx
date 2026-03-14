import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal, Pressable, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { spacing, typography, borderRadius } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import { supabase } from '../lib/supabase';
import NewMatchModal from '../components/NewMatchModal';
import { useMembership } from '../hooks/useMembership';

import { SPORTS, sportLabel } from '../constants/sports';

type Flow = null | 'ranked' | 'casual' | 'local';

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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
    },
    pageHeader: { marginBottom: spacing.sm },
    pageTitle: { ...typography.heading, color: colors.text },
    header: { marginBottom: spacing.lg },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
      marginBottom: spacing.md,
    },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: spacing.xxl },
    sportDropdownBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.cardBg,
      marginBottom: spacing.md,
    },
    sportDropdownLabel: { ...typography.label, color: colors.textSecondary, fontSize: 11, marginBottom: 1 },
    sportDropdownValue: { ...typography.label, color: colors.text, fontSize: 15, fontWeight: '700' },
    sportDropdownLeft: { flexDirection: 'column' },
    // dropdown modal
    dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    dropdownSheet: {
      backgroundColor: colors.cardBg,
      borderTopLeftRadius: borderRadius.xl ?? 20,
      borderTopRightRadius: borderRadius.xl ?? 20,
      paddingBottom: spacing.xl,
      maxHeight: '75%',
    },
    dropdownSheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dropdownSheetTitle: { ...typography.label, color: colors.text, fontSize: 15, fontWeight: '700' },
    dropdownSportRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dropdownSportRowSelected: { backgroundColor: colors.primary + '18' },
    dropdownSportName: { ...typography.body, fontSize: 14, color: colors.text },
    dropdownSportNameSelected: { color: colors.primary, fontWeight: '700' },
    dropdownSportRating: { ...typography.caption, fontSize: 11, color: colors.textSecondary },
    // calendar
    calendarCard: {
      backgroundColor: colors.cardBg,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    calendarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    calendarTitle: { ...typography.label, fontSize: 13, fontWeight: '700', color: colors.text },
    calendarStreakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary + '20',
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: borderRadius.full,
    },
    calendarStreakText: { ...typography.label, fontSize: 12, color: colors.primary, fontWeight: '700' },
    calendarDayLabels: {
      flexDirection: 'row',
      marginBottom: spacing.xs,
    },
    calendarDayLabel: {
      flex: 1,
      textAlign: 'center',
      ...typography.caption,
      fontSize: 10,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calendarCell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calendarDayNum: { ...typography.caption, fontSize: 11, color: colors.textSecondary },
    calendarDayNumToday: { color: colors.primary, fontWeight: '700' },
    calendarDayNumPlayed: { color: colors.text, fontWeight: '600', fontSize: 10, marginTop: 1 },
    calendarFlame: { fontSize: 16, lineHeight: 20 },
    rankRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    rankCard: {
      flex: 1,
      flexDirection: 'column',
      justifyContent: 'center',
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardBg,
      gap: 2,
      marginRight: spacing.xs,
    },
    rankLabel: { ...typography.caption, color: colors.textSecondary },
    rankSport: { ...typography.label, fontSize: 14, fontWeight: '700', color: colors.text },
    rankValue: {
      ...typography.caption,
      fontSize: 12,
      color: colors.primary,
      marginTop: 2,
    },
    rankHint: { ...typography.caption, color: colors.textSecondary },
    leaderboardCard: {
      flex: 1,
      marginLeft: spacing.xs,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardBg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    leaderboardLabel: { ...typography.caption, fontSize: 11, color: colors.textSecondary, textAlign: 'center' },
    leaderboardTitle: { ...typography.label, fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' },
    primaryButton: {
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
    },
    buttonIconWrap: { marginBottom: spacing.sm },
    primaryButtonTitle: {
      ...typography.heading,
      color: colors.textOnPrimary,
      marginBottom: spacing.xs,
    },
    primaryButtonSub: {
      ...typography.caption,
      color: 'rgba(255,255,255,0.9)',
    },
    rankedButton: {
      backgroundColor: colors.primary,
      borderColor: colors.primaryDark,
    },
    casualButton: {
      backgroundColor: colors.cardBg,
      borderColor: colors.border,
    },
    casualTitle: { color: colors.text },
    casualSub: { color: colors.textSecondary },
    localButton: {
      backgroundColor: colors.cardBg,
      borderColor: colors.border,
    },
    lockedButton: {
      opacity: 0.7,
      position: 'relative',
    },
    lockedBadge: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      backgroundColor: colors.textSecondary,
      borderRadius: borderRadius.sm,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
    },
    lockedBadgeText: { ...typography.caption, color: colors.background, fontSize: 10, fontWeight: '600' },
  });
}

const MEMBERSHIP_LOCK_MESSAGE =
  'Find ranked match and Find casual match are only available in the membership version of Versus. Upgrade in Settings to unlock.';

export default function VersusScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { hasMembership } = useMembership();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [flow, setFlow] = useState<Flow>(null);
  const [sport, setSport] = useState<string>(SPORTS[0]);
  const closeFlow = () => setFlow(null);

  const [sportRatings, setSportRatings] = useState<Record<string, { rank_tier: string | null; rank_div: string | null; vp: number }>>({});
  const [preferredSports, setPreferredSports] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sportDropdownOpen, setSportDropdownOpen] = useState(false);

  // Default to first preferred sport once loaded
  useEffect(() => {
    if (preferredSports.length > 0) setSport(preferredSports[0]);
  }, [preferredSports]);

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [ratingsRes, profRes] = await Promise.all([
        supabase.from('user_sport_ratings').select('vp, rank_tier, rank_div, sport_id, sports!inner(name)').eq('user_id', user.id),
        supabase.from('profiles').select('preferred_sports').eq('user_id', user.id).maybeSingle(),
      ]);

      if (ratingsRes.data) {
        const map: typeof sportRatings = {};
        for (const r of ratingsRes.data as any[]) {
          const name = r.sports?.name;
          if (name) map[name] = { rank_tier: r.rank_tier, rank_div: r.rank_div, vp: r.vp };
        }
        setSportRatings(map);
      }

      if (profRes.data?.preferred_sports) setPreferredSports(profRes.data.preferred_sports);
    } catch { /* swallow */ }
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const orderedSports = useMemo(() => {
    if (preferredSports.length === 0) return SPORTS;
    const prefSet = new Set(preferredSports);
    const rest = SPORTS.filter((s) => !prefSet.has(s));
    return [...preferredSports, ...rest] as readonly string[];
  }, [preferredSports]);

  const currentRating = sportRatings[sport];
  const rankTierDisplay = currentRating
    ? `${currentRating.rank_tier ?? 'Unranked'} ${currentRating.rank_div ?? ''}`.trim() + ' \u00b7 '
    : 'Unranked \u00b7 ';
  const rankVpDisplay = currentRating ? `${currentRating.vp} VP` : '0 VP';

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Versus</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.text} colors={[colors.primary]} progressBackgroundColor={colors.cardBg} />}
      >
        {/* Header content — inside ScrollView so pull-to-refresh works from the top */}
        <View style={styles.header}>
        <Text style={styles.subtitle}>
          Choose your sport, see your rank, then find someone to play.
        </Text>

        {/* Sport dropdown button */}
        <TouchableOpacity style={styles.sportDropdownBtn} onPress={() => setSportDropdownOpen(true)} activeOpacity={0.85}>
          <View style={styles.sportDropdownLeft}>
            <Text style={styles.sportDropdownLabel}>Sport</Text>
            <Text style={styles.sportDropdownValue}>{sportLabel(sport)}</Text>
          </View>
          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Sport picker modal */}
        <Modal visible={sportDropdownOpen} transparent animationType="slide" onRequestClose={() => setSportDropdownOpen(false)}>
          <Pressable style={styles.dropdownOverlay} onPress={() => setSportDropdownOpen(false)}>
            <Pressable style={styles.dropdownSheet} onPress={() => {}}>
              <View style={styles.dropdownSheetHeader}>
                <Text style={styles.dropdownSheetTitle}>Select Sport</Text>
                <TouchableOpacity onPress={() => setSportDropdownOpen(false)} hitSlop={12}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={orderedSports as string[]}
                keyExtractor={(item) => item}
                renderItem={({ item: s }) => {
                  const rating = sportRatings[s];
                  const ratingLabel = rating ? `${rating.rank_tier ?? 'Unranked'} · ${rating.vp} VP` : 'Unranked';
                  const isSelected = s === sport;
                  return (
                    <TouchableOpacity
                      style={[styles.dropdownSportRow, isSelected && styles.dropdownSportRowSelected]}
                      onPress={() => { setSport(s); setSportDropdownOpen(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dropdownSportName, isSelected && styles.dropdownSportNameSelected]}>
                        {sportLabel(s)}
                      </Text>
                      <Text style={styles.dropdownSportRating}>{ratingLabel}</Text>
                    </TouchableOpacity>
                  );
                }}
                showsVerticalScrollIndicator={false}
              />
            </Pressable>
          </Pressable>
        </Modal>
        <View style={styles.rankRow}>
          <View style={styles.rankCard}>
            <Text style={styles.rankLabel}>Your ranking in</Text>
            <Text style={styles.rankSport} numberOfLines={1}>{sport}</Text>
            <Text numberOfLines={1}>
              <Text style={[styles.rankValue, { color: tierColor(currentRating?.rank_tier ?? null) }]}>{rankTierDisplay}</Text>
              <Text style={[styles.rankValue, { color: '#2563EB', fontWeight: '700' }]}>{rankVpDisplay}</Text>
            </Text>
          </View>
          <TouchableOpacity
            style={styles.leaderboardCard}
            onPress={() => navigation.navigate('Leaderboard')}
            activeOpacity={0.85}
          >
            <Ionicons name="trophy" size={18} color={colors.primary} />
            <Text style={styles.leaderboardTitle}>Leaderboards</Text>
            <Text style={styles.leaderboardLabel}>Top players</Text>
          </TouchableOpacity>
        </View>
      </View>

        <TouchableOpacity
          style={[styles.primaryButton, styles.rankedButton]}
          onPress={() => setFlow('local')}
          activeOpacity={0.85}
        >
          <View style={styles.buttonIconWrap}>
            <Ionicons name="person-add-outline" size={28} color={colors.textOnPrimary} />
          </View>
          <Text style={styles.primaryButtonTitle}>
            New Match
          </Text>
          <Text style={styles.primaryButtonSub}>
            Set up with someone in person. Choose ranked or casual, pick settings, and send an invite.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, styles.casualButton]}
          onPress={() => Alert.alert('Coming soon', 'Find ranked match will be available in a future update.')}
          activeOpacity={0.85}
        >
          <View style={styles.buttonIconWrap}>
            <Ionicons name="trophy" size={28} color={colors.text} />
          </View>
          <Text style={[styles.primaryButtonTitle, styles.casualTitle]}>Find ranked match</Text>
          <Text style={[styles.primaryButtonSub, styles.casualSub]}>
            Coming soon
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, styles.casualButton]}
          onPress={() => Alert.alert('Coming soon', 'Find casual match will be available in a future update.')}
          activeOpacity={0.85}
        >
          <View style={styles.buttonIconWrap}>
            <Ionicons name="happy-outline" size={28} color={colors.text} />
          </View>
          <Text style={[styles.primaryButtonTitle, styles.casualTitle]}>
            Find casual match
          </Text>
          <Text style={[styles.primaryButtonSub, styles.casualSub]}>
            Coming soon
          </Text>
        </TouchableOpacity>

        
      </ScrollView>

      <NewMatchModal
        visible={flow !== null}
        onClose={closeFlow}
        onCreated={() => navigation.navigate('Home')}
        colors={colors}
        initialSport={sport}
        initialMatchType={flow === 'ranked' ? 'ranked' : 'casual'}
        preferredSports={preferredSports}
      />
    </View>
  );
}
