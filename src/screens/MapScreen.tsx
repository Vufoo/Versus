import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { colors, spacing, typography } from '../constants/theme';
import { useLocation } from '../hooks/useLocation';

export default function MapScreen() {
  const location = useLocation({ watch: Platform.OS !== 'web' });

  const { status, coords, error } = location;

  const renderStatus = () => {
    if (status === 'pending') {
      return (
        <View style={styles.statusRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.statusText}>Requesting location permission…</Text>
        </View>
      );
    }

    if (status === 'denied') {
      return (
        <Text style={styles.statusError}>
          Location permission is off. Enable it in Settings to see players and matches near you.
        </Text>
      );
    }

    if (status === 'error') {
      return (
        <Text style={styles.statusError}>
          {error ?? 'There was a problem getting your location.'}
        </Text>
      );
    }

    if (coords) {
      return (
        <View style={styles.coordsRow}>
          <Text style={styles.coordsLabel}>Your location</Text>
          <Text style={styles.coordsValue}>
            {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Map</Text>
      <Text style={styles.subtitle}>
        This will become your live Versus map — see friends, nearby players, and open 1v1s around you.
      </Text>

      <View style={styles.mapShell}>
        <View style={styles.mapHeader}>
          <Text style={styles.mapTitle}>Nearby activity</Text>
          <Text style={styles.mapHint}>Prototype view (map visuals coming next).</Text>
        </View>

        <View style={styles.mapBody}>
          <View style={styles.youDotOuter}>
            <View style={styles.youDotInner} />
          </View>
          <Text style={styles.youLabel}>You</Text>
          <Text style={styles.mapBodyHint}>
            Once the full map is wired up, you’ll see courts, players, and open challenges here.
          </Text>
        </View>

        <View style={styles.footer}>{renderStatus()}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingTop: spacing.xxl,
  },
  title: {
    ...typography.title,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  mapShell: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  mapHeader: {
    marginBottom: spacing.md,
  },
  mapTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  mapHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  mapBody: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  youDotOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${colors.primary}22`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  youDotInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  youLabel: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  mapBodyHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    marginTop: spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statusError: {
    ...typography.caption,
    color: colors.error,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  coordsLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  coordsValue: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
});

