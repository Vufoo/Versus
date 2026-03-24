import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal, Pressable, FlatList, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { spacing, typography, borderRadius } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import { useLanguage } from '../i18n/LanguageContext';
import { supabase, resolveAvatarUrl } from '../lib/supabase';
import NewMatchModal from '../components/NewMatchModal';
import { useMembership } from '../hooks/useMembership';

import { SPORTS, sportLabel } from '../constants/sports';
import GradientCard from '../components/GradientCard';

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
    topBar: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingBottom: 9,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.cardBg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginHorizontal: -spacing.lg,
      marginBottom: spacing.lg,
    },
    topBarIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      overflow: 'hidden' as const,
    },
    topBarRight: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
    },
    header: { marginBottom: spacing.sm },
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
    // dropdown popover
    dropdownSheet: {
      position: 'absolute' as const,
      backgroundColor: colors.cardBg,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 320,
      overflow: 'hidden' as const,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
    },
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
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
      overflow: 'hidden' as const,
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
      gap: 2,
      marginRight: spacing.xs,
      overflow: 'hidden' as const,
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
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginLeft: spacing.xs,
    },
    leaderboardLabel: { ...typography.caption, fontSize: 11, color: colors.textSecondary, textAlign: 'center' },
    leaderboardTitle: { ...typography.label, fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' },
    primaryButton: {
      borderRadius: borderRadius.lg,
      paddingVertical: 20,
      paddingHorizontal: spacing.md,
      marginBottom: 10,
      borderWidth: 1,
    },
    buttonIconWrap: { marginBottom: 4 },
    primaryButtonTitle: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: colors.textOnPrimary,
      marginBottom: 2,
    },
    primaryButtonSub: {
      fontSize: 12,
      fontWeight: '400' as const,
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
  const { colors, mode: themeMode } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { hasMembership } = useMembership();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [flow, setFlow] = useState<Flow>(null);
  const [sport, setSport] = useState<string>(SPORTS[0]);
  const closeFlow = () => setFlow(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [sportRatings, setSportRatings] = useState<Record<string, { rank_tier: string | null; rank_div: string | null; vp: number }>>({});
  const [preferredSports, setPreferredSports] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sportDropdownOpen, setSportDropdownOpen] = useState(false);
  const [dropdownLayout, setDropdownLayout] = useState<{ top: number; left: number; width: number } | null>(null);
  const sportBtnRef = useRef<any>(null);

  const openSportDropdown = () => {
    sportBtnRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
      setDropdownLayout({ top: y + height + 4, left: x, width });
      setSportDropdownOpen(true);
    });
  };

  // Default to first preferred sport once loaded
  useEffect(() => {
    if (preferredSports.length > 0) setSport(preferredSports[0]);
  }, [preferredSports]);

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);
      const [ratingsRes, profRes] = await Promise.all([
        supabase.from('user_sport_ratings').select('vp, rank_tier, rank_div, sport_id, sports!inner(name)').eq('user_id', user.id),
        supabase.from('profiles').select('preferred_sports, avatar_url').eq('user_id', user.id).maybeSingle(),
      ]);
      const avatarUrl = (profRes.data as any)?.avatar_url;
      if (avatarUrl) {
        const resolved = await resolveAvatarUrl(avatarUrl);
        if (resolved) setAvatarUri(resolved);
      }

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
    <View style={[styles.container, { paddingTop: 0 }]}>
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        {/* Left: profile avatar */}
        <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
          {avatarUri
            ? <Image source={{ uri: avatarUri }} style={{ width: 34, height: 34, borderRadius: 17 }} />
            : <Ionicons name="person-outline" size={18} color={colors.text} />}
        </TouchableOpacity>
        {/* Center: logo */}
        <Image
          source={themeMode === 'dark' ? require('../../assets/icon_dark_mode.png') : require('../../assets/icon_light_mode.png')}
          style={{ height: 44, width: 100, marginVertical: -5 }}
          resizeMode="contain"
        />
        {/* Right: search + settings */}
        <View style={styles.topBarRight}>
          <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.navigate('Search')} activeOpacity={0.8}>
            <Ionicons name="search" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.navigate('Settings')} activeOpacity={0.8}>
            <Ionicons name="settings-outline" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
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

        {/* Sport dropdown button */}
        <TouchableOpacity ref={sportBtnRef} style={styles.sportDropdownBtn} onPress={openSportDropdown} activeOpacity={0.85}>
          <View style={styles.sportDropdownLeft}>
            <Text style={styles.sportDropdownLabel}>{t.versus.sport}</Text>
            <Text style={styles.sportDropdownValue}>{sportLabel(sport)}</Text>
          </View>
          <Ionicons name={sportDropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Sport picker popover */}
        <Modal visible={sportDropdownOpen} transparent animationType="fade" onRequestClose={() => setSportDropdownOpen(false)}>
          <Pressable style={{ flex: 1 }} onPress={() => setSportDropdownOpen(false)}>
            <View style={[styles.dropdownSheet, { top: dropdownLayout?.top ?? 200, left: dropdownLayout?.left ?? spacing.lg, width: dropdownLayout?.width ?? 300 }]}>
              <FlatList
                data={orderedSports as string[]}
                keyExtractor={(item) => item}
                renderItem={({ item: s }) => {
                  const rating = sportRatings[s];
                  const ratingLabel = rating ? `${rating.rank_tier ?? t.common.unranked} · ${rating.vp} VP` : t.common.unranked;
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
            </View>
          </Pressable>
        </Modal>
        <View style={styles.rankRow}>
          <GradientCard style={styles.rankCard}>
            <Text style={styles.rankLabel}>{t.versus.yourRankingIn}</Text>
            <Text style={styles.rankSport} numberOfLines={1}>{sport}</Text>
            <Text numberOfLines={1}>
              <Text style={[styles.rankValue, { color: tierColor(currentRating?.rank_tier ?? null) }]}>{rankTierDisplay}</Text>
              <Text style={[styles.rankValue, { color: '#2563EB', fontWeight: '700' }]}>{rankVpDisplay}</Text>
            </Text>
          </GradientCard>
          <GradientCard
            style={styles.leaderboardCard}
            onPress={() => navigation.navigate('Leaderboard')}
            activeOpacity={0.85}
          >
            <Ionicons name="trophy" size={18} color={colors.primary} />
            <Text style={styles.leaderboardTitle}>{t.versus.leaderboards}</Text>
            <Text style={styles.leaderboardLabel}>{t.versus.topPlayers}</Text>
          </GradientCard>
        </View>
      </View>

        <TouchableOpacity
          style={[styles.primaryButton, styles.rankedButton]}
          onPress={() => setFlow('local')}
          activeOpacity={0.85}
        >
          <View style={styles.buttonIconWrap}>
            <Ionicons name="person-add-outline" size={22} color={colors.textOnPrimary} />
          </View>
          <Text style={styles.primaryButtonTitle}>
            {t.versus.newMatch}
          </Text>
          <Text style={styles.primaryButtonSub}>
            {t.versus.newMatchSub}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, styles.casualButton]}
          onPress={() => Alert.alert('Coming soon', 'Tournaments will be available in a future update.')}
          activeOpacity={0.85}
        >
          <View style={styles.buttonIconWrap}>
            <Ionicons name="ribbon-outline" size={22} color={colors.text} />
          </View>
          <Text style={[styles.primaryButtonTitle, styles.casualTitle]}>{t.versus.newTournament}</Text>
          <Text style={[styles.primaryButtonSub, styles.casualSub]}>
            {t.common.comingSoon}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, styles.casualButton]}
          onPress={() => Alert.alert('Coming soon', 'Find ranked match will be available in a future update.')}
          activeOpacity={0.85}
        >
          <View style={styles.buttonIconWrap}>
            <Ionicons name="trophy" size={22} color={colors.text} />
          </View>
          <Text style={[styles.primaryButtonTitle, styles.casualTitle]}>{t.versus.findRankedMatch}</Text>
          <Text style={[styles.primaryButtonSub, styles.casualSub]}>
            {t.common.comingSoon}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, styles.casualButton]}
          onPress={() => Alert.alert('Coming soon', 'Find casual match will be available in a future update.')}
          activeOpacity={0.85}
        >
          <View style={styles.buttonIconWrap}>
            <Ionicons name="happy-outline" size={22} color={colors.text} />
          </View>
          <Text style={[styles.primaryButtonTitle, styles.casualTitle]}>
            {t.versus.findCasualMatch}
          </Text>
          <Text style={[styles.primaryButtonSub, styles.casualSub]}>
            {t.common.comingSoon}
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
