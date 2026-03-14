import React, { useState } from 'react';
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
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../constants/theme';

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
      gap: spacing.md,
    },
    backBtn: { padding: spacing.xs },
    title: { ...typography.title, color: colors.text, flex: 1 },
    scroll: { padding: spacing.lg },
    section: { marginBottom: spacing.xl },
    sectionTitle: {
      ...typography.label,
      color: colors.primary,
      textTransform: 'uppercase',
      fontSize: 11,
      letterSpacing: 0.8,
      marginBottom: spacing.sm,
    },
    item: {
      backgroundColor: colors.cardBg,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.sm,
      overflow: 'hidden',
    },
    itemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      gap: spacing.sm,
    },
    question: {
      ...typography.body,
      fontSize: 14,
      fontWeight: '600' as const,
      color: colors.text,
      flex: 1,
    },
    answer: {
      ...typography.body,
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
  });
}

const FAQ_SECTIONS = [
  {
    title: 'Getting Started',
    items: [
      {
        q: 'What is Versus?',
        a: 'Versus is a competitive sports app that lets you challenge friends and other players to ranked and casual matches across 15+ sports. Track your wins, losses, and VP (Victory Points) to climb the ranks.',
      },
      {
        q: 'How do I create a match?',
        a: 'Tap the "+" button on the home screen to open New Match. Select a sport, choose a format (1v1 or 2v2 where available), pick ranked or casual, set a location and time, then invite your opponent. They\'ll receive a notification to accept.',
      },
      {
        q: 'What match types are available?',
        a: 'Ranked — affects your VP and rank. Casual — just for fun, no VP changes. Local — open challenges visible to nearby players. Practice — no records kept.',
      },
    ],
  },
  {
    title: 'Ranking System',
    items: [
      {
        q: 'What are VP (Victory Points)?',
        a: 'VP are earned by winning ranked matches. Each sport has its own VP total. The more VP you accumulate, the higher your rank tier in that sport.',
      },
      {
        q: 'What are the rank tiers?',
        a: 'From lowest to highest: Beginner → Bronze → Silver → Gold → Platinum → Diamond → Pro. Each tier has divisions (e.g., Bronze I, Bronze II, Bronze III) to show your progress within the tier.',
      },
      {
        q: 'How is VP calculated after a match?',
        a: 'After a ranked match is completed and both players confirm the result, VP is awarded to the winner and deducted from the loser. The amount varies based on match format and outcome.',
      },
      {
        q: 'What happens if I lose a ranked match?',
        a: 'You lose VP. Your rank tier can drop if your VP falls below the threshold for that tier. This is why match confirmation from both sides is required — to keep results fair.',
      },
      {
        q: 'How does the Leaderboard work?',
        a: 'The Leaderboard shows the top players per sport ranked by VP. Swipe left/right to switch sports. Your rank is shown at the top even if you\'re outside the top 10. Players with 0 VP don\'t appear on the board.',
      },
    ],
  },
  {
    title: 'Matches & Results',
    items: [
      {
        q: 'How do I record match results?',
        a: 'After completing a match, open it from your home feed and tap "Submit Result". Enter the scores for each game. Both players must confirm before VP is awarded.',
      },
      {
        q: 'What is 2v2?',
        a: '2v2 is available for Tennis, Ping Pong, Basketball, and Volleyball. You invite a teammate in addition to your opponents. All four players must accept before the match is confirmed.',
      },
      {
        q: 'Can I cancel a match?',
        a: 'Yes. Open the match and tap the cancel option. Canceling a planned match before it starts has no effect on VP.',
      },
    ],
  },
  {
    title: 'Social & Privacy',
    items: [
      {
        q: 'How does following work?',
        a: 'You can follow other players to see their match activity on your feed. If their profile is set to Private, they must approve your follow request first.',
      },
      {
        q: 'How do I find friends?',
        a: 'Use the Search screen (magnifying glass icon) to find players by username or name. You can also connect your contacts to see which of your phone contacts are on Versus — your contacts are never sent to our servers, only a one-way hash is used for matching.',
      },
      {
        q: 'How does contact matching work?',
        a: 'To be discoverable via contacts, add your phone number in Edit Profile. Your number is hashed (irreversibly encrypted) before being stored — we never see or store your actual number. Others who have your number saved in their contacts will then see you in their "From your contacts" list on the Search screen.',
      },
      {
        q: 'What does Private profile mean?',
        a: 'A Private profile hides your match history from users who don\'t follow you. Your username and basic info are still visible in search results.',
      },
    ],
  },
];

function FAQItem({ q, a, colors, styles }: { q: string; a: string; colors: ThemeColors; styles: ReturnType<typeof createStyles> }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.item}>
      <TouchableOpacity style={styles.itemHeader} onPress={() => setOpen((v) => !v)} activeOpacity={0.7}>
        <Text style={styles.question}>{q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
      </TouchableOpacity>
      {open && (
        <>
          <View style={styles.divider} />
          <Text style={styles.answer}>{a}</Text>
        </>
      )}
    </View>
  );
}

export default function FAQScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const styles = createStyles(colors);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>FAQ</Text>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {FAQ_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} colors={colors} styles={styles} />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
