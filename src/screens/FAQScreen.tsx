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
      {
        q: 'What is the Plan view?',
        a: 'The Plan view (calendar icon in the tab bar) shows your upcoming and past matches on a calendar. Days with any match are highlighted with a colored circle; days with completed matches also show a 🔥 beneath the date. The streak counter (🔥 Xd) in the calendar header shows how many consecutive days you\'ve played. Tap "Today" between the navigation arrows to jump back to the current date.',
      },
      {
        q: 'How do I set my preferred sports?',
        a: 'Go to your Profile → Edit Profile → Preferred Sports. The order you select them matters — your sports appear in that order on your profile cards, in the Versus view, and everywhere else in the app.',
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
        a: 'The Leaderboard shows the top 10 players per sport ranked by VP. Swipe left/right to switch sports. Your own rank and VP are shown in a card at the top even if you\'re outside the top 10. Players with 0 VP don\'t appear on the board.',
      },
      {
        q: 'Do casual or practice matches affect my rank?',
        a: 'No. Only Ranked matches change your VP and rank. Casual, Local, and Practice matches are tracked in your history but have no effect on your standing.',
      },
    ],
  },
  {
    title: 'Matches & Results',
    items: [
      {
        q: 'What do the match statuses mean?',
        a: 'Planned — scheduled but not yet accepted by all players. Pending — waiting on opponent acceptance. Confirmed — all players accepted, ready to play. In Progress — match has started. Paused — temporarily paused. Completed — finished and results recorded.',
      },
      {
        q: 'How do I record match results?',
        a: 'For casual and local matches: tap "Finish" on the active match card, then select the winner (or Draw). For ranked matches: both players must tap "Request Finish" on the match card; once both confirm, VP is awarded automatically. Scores can be edited at any time on a completed casual match via the ⋯ menu.',
      },
      {
        q: 'What is 2v2?',
        a: '2v2 is available for Tennis, Ping Pong, Basketball, and Volleyball. You invite a teammate in addition to your opponents. All four players must accept before the match is confirmed.',
      },
      {
        q: 'Can I cancel a match?',
        a: 'Yes. Open the match card and use the cancel option. Canceling permanently deletes the match from your feed — no VP is affected. For pending or confirmed ranked matches, only the creator can cancel alone. For completed ranked matches, all participants must confirm deletion, which also reverses any VP changes.',
      },
      {
        q: 'What happens if there\'s a dispute over results?',
        a: 'Both players must confirm the result for VP to be awarded. If one player submits different scores, the match will remain unresolved until both sides agree. Contact support if a dispute cannot be resolved.',
      },
    ],
  },
  {
    title: 'Map & Location',
    items: [
      {
        q: 'Who can see my location on the map?',
        a: 'Only mutual followers can see each other\'s location — meaning you follow them AND they follow you (both accepted). Strangers cannot see your location even if your setting is set to Public. If either person has their location set to Private, neither can see the other.',
      },
      {
        q: 'How do I control my location visibility?',
        a: 'Go to Settings → Location Privacy and choose Public or Private. Public shares your location with mutual followers only. Private means no one can see your location on the map, not even mutual followers.',
      },
      {
        q: 'Is my exact location shown to others?',
        a: 'No. Match location pins show only the general area (neighborhood or city level), not an exact address. This protects your privacy while still letting you find nearby games.',
      },
      {
        q: 'What matches appear on the map?',
        a: 'Only public matches are shown. Private matches are never visible on the map to anyone other than the participants. Matches from mutual followers appear anywhere on the map; other public matches only appear within your selected radius (2, 5, 10, or 20 miles).',
      },
      {
        q: 'How do I request to join a match on the map?',
        a: 'Tap a match pin to see its details. If it\'s open, tap "Request to Join." The match creator receives a notification and can accept or deny your request. If accepted, you\'re added to the match. If denied, you\'ll receive a notification and the button stays greyed out.',
      },
      {
        q: 'Can I turn off location sharing entirely?',
        a: 'Yes — two ways. Set Location Privacy to Private in Settings, or deny location permission for Versus in your phone\'s system settings. Either will prevent your location from appearing on the map.',
      },
      {
        q: 'Why isn\'t my location updating on the map?',
        a: 'Your location only updates after you\'ve moved roughly 100 meters from where it was last recorded. This is intentional to reduce battery drain. Make sure location permissions are set to "Always" or "While Using" in your phone\'s settings for the most accurate updates.',
      },
    ],
  },
  {
    title: 'Social & Privacy',
    items: [
      {
        q: 'How does following work?',
        a: 'You can follow other players to see their match activity on your feed. If their profile is set to Private, they must approve your follow request first. Mutual follows (both following each other) unlock location visibility on the map.',
      },
      {
        q: 'How do I find friends?',
        a: 'Use the Search screen (magnifying glass icon) to find players by username or name. You can also connect your contacts to see which of your phone contacts are on Versus — your contacts are never sent to our servers, only a one-way hash is used for matching.',
      },
      {
        q: 'How does contact matching work?',
        a: 'To be discoverable via contacts, add your phone number in Edit Profile. Your number is hashed (irreversibly encrypted) before being stored — we never see or store your actual number. Others who have your number saved in their contacts will see you in their "From your contacts" section on the Search screen.',
      },
      {
        q: 'How do I message someone?',
        a: 'Tap the chat bubble icon at the top of the Home screen, or visit a player\'s profile and tap the message button. Direct messages are private and only visible to you and the recipient.',
      },
      {
        q: 'What does Private profile mean?',
        a: 'A Private profile hides your match history and stats from users who don\'t follow you. Your username and basic info are still visible in search results. Followers you\'ve approved can see your full profile.',
      },
      {
        q: 'Can I block or report a user?',
        a: 'You can remove followers at any time by going to your follower list and removing them. To report inappropriate behavior, contact us through the Support section in Settings.',
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
