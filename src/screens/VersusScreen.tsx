import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../constants/theme';

const SPORTS = ['Pickleball', 'Basketball', 'Tennis', 'Bowling', 'Boxing', 'Badminton', 'Ping Pong'];

const SPORT_RANK: Record<string, string> = {
  Pickleball: 'Gold II · 1320 VP',
  Basketball: 'Silver I · 1180 VP',
  Tennis: 'Gold I · 1290 VP',
  Bowling: 'Bronze III · 980 VP',
  Boxing: 'Unranked · —',
  Badminton: 'Silver II · 1210 VP',
  'Ping Pong': 'Platinum IV · 1450 VP',
};

type Flow = null | 'ranked' | 'casual' | 'local';

export default function VersusScreen() {
  const [flow, setFlow] = useState<Flow>(null);
  const [localIsRanked, setLocalIsRanked] = useState(true);
  const [sport, setSport] = useState<string>(SPORTS[0]);

  const closeFlow = () => setFlow(null);

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
                  {s}
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
            <Text style={styles.rankValue}>{SPORT_RANK[sport] ?? 'Unranked · —'}</Text>
            <Text style={styles.rankHint}>Ranks update after verified matches.</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Find ranked match */}
        <TouchableOpacity
          style={[styles.primaryButton, styles.rankedButton]}
          onPress={() => setFlow('ranked')}
          activeOpacity={0.85}
        >
          <View style={styles.buttonIconWrap}>
            <Ionicons name="trophy" size={28} color={colors.textOnPrimary} />
          </View>
          <Text style={styles.primaryButtonTitle}>Find ranked match</Text>
          <Text style={styles.primaryButtonSub}>
            Search for one person nearby. Accept or decline. Both must accept — then chat to set the time. Either player can change time or settings after.
          </Text>
        </TouchableOpacity>

        {/* Find casual match */}
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
            Same flow as ranked — we find one person for you. No VP or rank impact. Great for practice or trying a new sport.
          </Text>
        </TouchableOpacity>

        {/* Local match */}
        <TouchableOpacity
          style={[styles.primaryButton, styles.localButton]}
          onPress={() => setFlow('local')}
          activeOpacity={0.85}
        >
          <View style={styles.buttonIconWrap}>
            <Ionicons name="person-add-outline" size={28} color={colors.text} />
          </View>
          <Text style={[styles.primaryButtonTitle, styles.casualTitle]}>
            Local match
          </Text>
          <Text style={[styles.primaryButtonSub, styles.casualSub]}>
            Set up with someone in person. Choose ranked or casual and match settings. Both must be on Versus — send an invite to link up.
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Flow modals */}
      <Modal visible={flow !== null} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={closeFlow}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {flow === 'ranked' && 'Find ranked match'}
                {flow === 'casual' && 'Find casual match'}
                {flow === 'local' && 'Local match'}
              </Text>
              <TouchableOpacity onPress={closeFlow} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {flow === 'ranked' && (
              <View style={styles.modalBody}>
                <Text style={styles.modalStep}>1. We search for one person near you.</Text>
                <Text style={styles.modalStep}>2. You can accept or decline the matchup.</Text>
                <Text style={styles.modalStep}>3. Both must accept for the match to go through.</Text>
                <Text style={styles.modalStep}>4. A chat opens to settle on time and place.</Text>
                <Text style={styles.modalStep}>5. After acceptance, either player can change time or settings.</Text>
                <TouchableOpacity style={styles.modalCta} onPress={closeFlow}>
                  <Text style={styles.modalCtaText}>Start searching (coming soon)</Text>
                </TouchableOpacity>
              </View>
            )}
            {flow === 'casual' && (
              <View style={styles.modalBody}>
                <Text style={styles.modalStep}>Same as ranked: we find one person, you accept/decline, both accept → chat to set time. No VP or rank impact.</Text>
                <TouchableOpacity style={styles.modalCta} onPress={closeFlow}>
                  <Text style={styles.modalCtaText}>Start searching (coming soon)</Text>
                </TouchableOpacity>
              </View>
            )}
            {flow === 'local' && (
              <View style={styles.modalBody}>
                <Text style={styles.modalPara}>
                  Set up a match with someone next to you. Both must be signed up on Versus.
                </Text>
                <TouchableOpacity
                  style={[styles.toggleRow, localIsRanked && styles.toggleRowActive]}
                  onPress={() => setLocalIsRanked(true)}
                >
                  <Ionicons
                    name="trophy"
                    size={20}
                    color={localIsRanked ? colors.textOnPrimary : colors.textSecondary}
                  />
                  <Text style={[styles.toggleLabel, localIsRanked && styles.toggleLabelActive]}>
                    Ranked
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleRow, !localIsRanked && styles.toggleRowActive]}
                  onPress={() => setLocalIsRanked(false)}
                >
                  <Ionicons
                    name="happy-outline"
                    size={20}
                    color={!localIsRanked ? colors.textOnPrimary : colors.textSecondary}
                  />
                  <Text style={[styles.toggleLabel, !localIsRanked && styles.toggleLabelActive]}>
                    Casual
                  </Text>
                </TouchableOpacity>
                <Text style={styles.modalHint}>
                  Match settings (sport, time, place) can be set here. You’ll send an invite; they accept to confirm.
                </Text>
                <TouchableOpacity style={styles.modalCta} onPress={closeFlow}>
                  <Text style={styles.modalCtaText}>Send invite (coming soon)</Text>
                </TouchableOpacity>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
  },
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
  sportChipLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  sportChipLabelSelected: {
    color: colors.textOnPrimary,
  },
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
  rankRight: {
    alignItems: 'flex-end',
    maxWidth: '55%',
  },
  rankLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  rankSport: {
    ...typography.heading,
    color: colors.text,
  },
  rankValue: {
    ...typography.label,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  rankHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  primaryButton: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  buttonIconWrap: {
    marginBottom: spacing.sm,
  },
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
  casualTitle: {
    color: colors.text,
  },
  casualSub: {
    color: colors.textSecondary,
  },
  localButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.title,
    color: colors.text,
  },
  modalBody: {
    paddingBottom: spacing.lg,
  },
  modalStep: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalPara: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.md,
  },
  modalHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  toggleRowActive: {
    backgroundColor: colors.primary,
  },
  toggleLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  toggleLabelActive: {
    color: colors.textOnPrimary,
  },
  modalCta: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  modalCtaText: {
    ...typography.heading,
    color: colors.textOnPrimary,
  },
});
