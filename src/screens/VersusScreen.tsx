import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { spacing, typography, borderRadius } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import { supabase } from '../lib/supabase';
import NewMatchModal from '../components/NewMatchModal';

import { SPORTS, sportLabel } from '../constants/sports';

type Flow = null | 'ranked' | 'casual' | 'local';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    header: { marginBottom: spacing.lg },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
      marginBottom: spacing.md,
    },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: spacing.xxl },
    sportsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    sportChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm - 2,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      marginRight: spacing.sm,
    },
    sportChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primaryDark,
    },
    sportChipLabel: { ...typography.label, color: colors.textSecondary },
    sportChipLabelSelected: { color: colors.textOnPrimary },
    rankCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    rankLeft: {},
    rankRight: { alignItems: 'flex-end', maxWidth: '55%' },
    rankLabel: { ...typography.caption, color: colors.textSecondary },
    rankSport: { ...typography.heading, color: colors.text },
    rankValue: {
      ...typography.label,
      color: colors.primary,
      marginBottom: spacing.xs,
    },
    rankHint: { ...typography.caption, color: colors.textSecondary },
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
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    casualTitle: { color: colors.text },
    casualSub: { color: colors.textSecondary },
    localButton: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
  });
}

export default function VersusScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [flow, setFlow] = useState<Flow>(null);
  const [localIsRanked, setLocalIsRanked] = useState(false);
  const [sport, setSport] = useState<string>(SPORTS[0]);
  const closeFlow = () => setFlow(null);

  const [sportRatings, setSportRatings] = useState<Record<string, { rank_tier: string | null; rank_div: string | null; vp: number }>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('user_sport_ratings')
          .select('vp, rank_tier, rank_div, sport_id, sports!inner(name)')
          .eq('user_id', user.id);

        if (!cancelled && data) {
          const map: typeof sportRatings = {};
          for (const r of data as any[]) {
            const name = r.sports?.name;
            if (name) map[name] = { rank_tier: r.rank_tier, rank_div: r.rank_div, vp: r.vp };
          }
          setSportRatings(map);
        }
      } catch { /* swallow */ }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const currentRating = sportRatings[sport];
  const rankDisplay = currentRating
    ? `${currentRating.rank_tier ?? 'Unranked'} ${currentRating.rank_div ?? ''} \u00b7 ${currentRating.vp} VP`.trim()
    : 'Unranked \u00b7 0 VP';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          Choose your sport, see your rank, then find someone to play.
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sportsRow}
        >
          {SPORTS.map((s) => {
            const isSelected = s === sport;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.sportChip, isSelected && styles.sportChipSelected]}
                onPress={() => setSport(s)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.sportChipLabel,
                    isSelected && styles.sportChipLabelSelected,
                  ]}
                >
                  {sportLabel(s)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={styles.rankCard}>
          <View style={styles.rankLeft}>
            <Text style={styles.rankLabel}>Your ranking in</Text>
            <Text style={styles.rankSport}>{sport}</Text>
          </View>
          <View style={styles.rankRight}>
            <Text style={styles.rankValue}>{rankDisplay}</Text>
            <Text style={styles.rankHint}>Ranks update after verified matches.</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={[styles.primaryButton, styles.rankedButton]}
          onPress={() => setFlow('local')}
          activeOpacity={0.85}
        >
          <View style={styles.buttonIconWrap}>
            <Ionicons name="person-add-outline" size={28} color={colors.textOnPrimary} />
          </View>
          <Text style={styles.primaryButtonTitle}>
            New match
          </Text>
          <Text style={styles.primaryButtonSub}>
            Set up with someone in person. Choose ranked or casual, pick settings, and send an invite.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, styles.casualButton]}
          onPress={() => setFlow('ranked')}
          activeOpacity={0.85}
        >
          <View style={styles.buttonIconWrap}>
            <Ionicons name="trophy" size={28} color={colors.text} />
          </View>
          <Text style={[styles.primaryButtonTitle, styles.casualTitle]}>Find ranked match</Text>
          <Text style={[styles.primaryButtonSub, styles.casualSub]}>
           Get matched up with an opponent. VP and rank are impacted. Put your skills to the test.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, styles.casualButton]}
          onPress={() => setFlow('casual')}
          activeOpacity={0.85}
        >
          <View style={styles.buttonIconWrap}>
            <Ionicons name="happy-outline" size={28} color={colors.text} />
          </View>
          <Text style={[styles.primaryButtonTitle, styles.casualTitle]}>
            Find casual match
          </Text>
          <Text style={[styles.primaryButtonSub, styles.casualSub]}>
            Get matched up with a casual player. No VP or rank impact. Great for a practice partner or trying a new sport.
          </Text>
        </TouchableOpacity>

        
      </ScrollView>

      <NewMatchModal
        visible={flow !== null}
        onClose={closeFlow}
        onCreated={() => navigation.navigate('Home')}
        colors={colors}
        initialSport={sport}
        initialMatchType={flow === 'ranked' ? 'ranked' : flow === 'casual' ? 'casual' : (localIsRanked ? 'ranked' : 'casual')}
      />
    </View>
  );
}
