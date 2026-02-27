import { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../constants/theme';

const PLACEHOLDER_CHATS = [
  { id: '1', name: 'Alex M.', initials: 'AM', preview: 'Good game yesterday!', time: '2h ago' },
  { id: '2', name: 'Jamie P.', initials: 'JP', preview: 'Rematch this weekend?', time: '5h ago' },
  { id: '3', name: 'Pickleball Group', initials: 'PG', preview: "Who's free Saturday?", time: '1d ago' },
];

function Avatar({
  initials,
  size,
  colors,
}: {
  initials: string;
  size: number;
  colors: ThemeColors;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.38, fontWeight: '700', color: colors.text }}>{initials}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: { ...typography.heading, color: colors.text },
    chatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    chatInfo: { flex: 1 },
    chatName: { ...typography.body, fontWeight: '600', color: colors.text },
    chatPreview: { ...typography.caption, color: colors.textSecondary },
    chatTime: { ...typography.caption, color: colors.textSecondary },
    emptyText: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.xl,
      marginHorizontal: spacing.lg,
    },
  });
}

export default function MessagesScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Messages</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        {PLACEHOLDER_CHATS.map((chat) => (
          <TouchableOpacity key={chat.id} style={styles.chatRow} activeOpacity={0.7}>
            <Avatar initials={chat.initials} size={44} colors={colors} />
            <View style={styles.chatInfo}>
              <Text style={styles.chatName}>{chat.name}</Text>
              <Text style={styles.chatPreview} numberOfLines={1}>
                {chat.preview}
              </Text>
            </View>
            <Text style={styles.chatTime}>{chat.time}</Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.emptyText}>
          More chats will appear as you play matches and connect with friends.
        </Text>
      </ScrollView>
    </View>
  );
}
