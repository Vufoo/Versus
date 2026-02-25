import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../constants/theme';

const FOLLOWING = ['alex', 'jordan', 'sam', 'riley', 'morgan', 'casey'];
const FOLLOWERS = ['jamie', 'taylor', 'chris', 'pat'];

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.avatarWrapper}>
          <Text style={styles.avatarInitials}>U</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.userName}>Your name</Text>
          <Text style={styles.userHandle}>@username</Text>
          <TouchableOpacity style={styles.changePhotoButton} activeOpacity={0.8}>
            <Ionicons name="camera-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.changePhotoText}>Change photo (placeholder)</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>—</Text>
          <Text style={styles.statLabel}>VP</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>{FOLLOWING.length}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>{FOLLOWERS.length}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
      </View>

      <View style={styles.vpCard}>
        <Text style={styles.vpLabel}>Victory Points (VP)</Text>
        <Text style={styles.vpValue}>—</Text>
        <Text style={styles.vpHint}>Ranked wins here will increase your VP.</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Followers</Text>
          <View style={styles.pillRow}>
            {FOLLOWERS.map((name) => (
              <View key={name} style={styles.pill}>
                <Ionicons name="person" size={14} color={colors.textSecondary} />
                <Text style={styles.pillText}>{name}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Following</Text>
          <View style={styles.pillRow}>
            {FOLLOWING.map((name) => (
              <View key={name} style={styles.pill}>
                <Ionicons name="person" size={14} color={colors.textSecondary} />
                <Text style={styles.pillText}>{name}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Match history</Text>
          <Text style={styles.placeholder}>Recent wins, losses, and casual games will appear here.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Settings</Text>
          <Text style={styles.placeholder}>
            Location sharing, notifications, and account details will be configurable here.
          </Text>
        </View>
      </ScrollView>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarInitials: {
    ...typography.heading,
    fontSize: 28,
    color: colors.textOnPrimary,
  },
  headerText: {
    flex: 1,
  },
  userName: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  userHandle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  changePhotoText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  statBlock: {
    alignItems: 'center',
    minWidth: 72,
  },
  statValue: {
    ...typography.heading,
    color: colors.text,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.divider,
  },
  vpCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  vpLabel: {
    ...typography.label,
    color: colors.textOnPrimary,
    opacity: 0.9,
    marginBottom: spacing.xs,
  },
  vpValue: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  vpHint: {
    ...typography.caption,
    color: colors.textOnPrimary,
    opacity: 0.9,
    marginTop: spacing.sm,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  placeholder: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillText: {
    ...typography.caption,
    color: colors.text,
  },
});

