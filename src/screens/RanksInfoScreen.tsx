import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../constants/theme';

const TIERS = [
  { name: 'Beginner', short: 'BGN', color: '#9E9E9E', vpToNext: '1 VP' },
  { name: 'Bronze',   short: 'BR',  color: '#CD7F32', vpToNext: '10 VP' },
  { name: 'Silver',   short: 'SI',  color: '#C0C0C0', vpToNext: '10 VP' },
  { name: 'Gold',     short: 'GO',  color: '#FFD700', vpToNext: '10 VP' },
  { name: 'Platinum', short: 'PL',  color: '#00BCD4', vpToNext: '10 VP' },
  { name: 'Diamond',  short: 'DI',  color: '#64B5F6', vpToNext: '10 VP' },
  { name: 'Pro',      short: 'PRO', color: '#F44336', vpToNext: null },
];

const VP_RULES = [
  { emoji: '⚔️', title: 'Win',     body: 'Earn VP\nBonus for upsets' },
  { emoji: '📉', title: 'Lose',    body: 'Give VP\nFloors at 0' },
  { emoji: '🏆', title: 'Promote', body: 'Fill bar → next tier\nAt Pro, VP grows forever' },
];

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
    content: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      justifyContent: 'space-between',
    },

    // Tier diagram
    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: c.primary,
      textTransform: 'uppercase', letterSpacing: 0.8,
      marginBottom: spacing.sm,
    },
    tierRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.cardBg,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: c.primary + '30',
      overflow: 'hidden',
      height: 48,
    },
    tierAccent: { width: 5, alignSelf: 'stretch' },
    tierBadge: {
      width: 34, height: 34, borderRadius: 17,
      alignItems: 'center', justifyContent: 'center',
      marginHorizontal: spacing.md,
    },
    tierBadgeText: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
    tierName: { fontSize: 15, fontWeight: '700', flex: 1 },
    tierVpRight: { fontSize: 11, fontWeight: '600', color: c.textSecondary, marginRight: spacing.md },

    // Connector between tiers
    connector: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 5 + spacing.md + 17,  // align with center of badge
      height: 20,
      gap: 4,
    },
    connectorLine: { width: 1, height: 20, backgroundColor: c.text, opacity: 0.25, position: 'absolute', left: 0 },
    connectorVp: { fontSize: 10, color: c.text, opacity: 0.5, marginLeft: 8 },

    // Rules
    rulesSection: { gap: spacing.sm },
    rulesRow: { flexDirection: 'row', gap: spacing.sm },
    ruleCard: {
      flex: 1,
      backgroundColor: c.cardBg,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: c.primary + '55',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      alignItems: 'center',
      gap: 5,
    },
    ruleEmoji: { fontSize: 22 },
    ruleTitle: { fontSize: 13, fontWeight: '700', color: c.text },
    ruleBody: { fontSize: 10, color: c.textSecondary, textAlign: 'center', lineHeight: 15 },

    // Lock note
    lockNote: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingTop: spacing.sm,
    },
    lockText: { fontSize: 12, color: c.textSecondary, fontStyle: 'italic' },
  });
}

export default function RanksInfoScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ranks & Rules</Text>
      </View>

      <View style={styles.content}>
        {/* Tier progression */}
        <View>
          <Text style={styles.sectionLabel}>Rank Progression</Text>

          {TIERS.map((tier, i) => (
            <View key={tier.name}>
              <View style={styles.tierRow}>
                <View style={[styles.tierAccent, { backgroundColor: tier.color }]} />
                <View style={[styles.tierBadge, { backgroundColor: tier.color, shadowColor: tier.color, shadowOpacity: 0.45, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 }]}>
                  <Text style={styles.tierBadgeText}>{tier.short}</Text>
                </View>
                <Text style={[styles.tierName, { color: tier.color }]}>{tier.name}</Text>
                {tier.vpToNext
                  ? <Text style={styles.tierVpRight}>{tier.vpToNext} →</Text>
                  : <Text style={[styles.tierVpRight, { color: tier.color, fontWeight: '700' }]}>VP keeps growing ∞</Text>
                }
              </View>

              {i < TIERS.length - 1 && (
                <View style={styles.connector}>
                  <View style={styles.connectorLine} />
                  <Ionicons name="arrow-down" size={11} color={colors.text} style={{ opacity: 0.35 }} />
                  <Text style={styles.connectorVp}>{TIERS[i + 1].vpToNext ? `Earn ${tier.vpToNext} to promote` : ''}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* How VP works */}
        <View style={styles.rulesSection}>
          <Text style={styles.sectionLabel}>How It Works</Text>
          <View style={styles.rulesRow}>
            {VP_RULES.map(({ emoji, title, body }) => (
              <View key={title} style={styles.ruleCard}>
                <Text style={styles.ruleEmoji}>{emoji}</Text>
                <Text style={styles.ruleTitle}>{title}</Text>
                <Text style={styles.ruleBody}>{body}</Text>
              </View>
            ))}
          </View>
          <View style={styles.lockNote}>
            <Ionicons name="lock-closed" size={13} color={colors.textSecondary} />
            <Text style={styles.lockText}>Tiers are permanent — you can never be demoted</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
