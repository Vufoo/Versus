import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    title: { ...typography.heading, color: colors.text },
    subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
    webPlaceholder: {
      flex: 1,
      borderRadius: 20,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      backgroundColor: colors.offWhite,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
      margin: spacing.lg,
    },
    webPlaceholderText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  });
}

export default function MapScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Map</Text>
          <Text style={styles.subtitle}>
            Maps not available on web.
          </Text>
        </View>
      </View>
      <View style={styles.webPlaceholder}>
        <Ionicons name="map-outline" size={64} color={colors.textSecondary} style={{ marginBottom: spacing.md }} />
        <Text style={styles.webPlaceholderText}>
          Your live Versus map — see friends, nearby players, and open 1v1s around you.
        </Text>
        <Text style={[styles.webPlaceholderText, { marginTop: spacing.sm, fontSize: 12 }]}>
          Use the iOS or Android app to view the map.
        </Text>
      </View>
    </View>
  );
}
