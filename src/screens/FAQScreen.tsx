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
        a: 'Versus is a competitive sports tracking app for recreational players. Challenge friends to ranked and casual matches across 9 sports, track your wins and losses, earn VP (Victory Points), and climb per-sport leaderboards.',
      },
      {
        q: 'What sports are supported?',
        a: 'Tennis, Pickleball, Badminton, Ping Pong, Racquetball, Squash, Basketball, Golf, and Volleyball. 2v2 formats are available for Tennis, Ping Pong, Basketball, and Volleyball.',
      },
      {
        q: 'How do I create a match?',
        a: 'Tap the "+" button on the home screen to open New Match. Choose a sport, format (1v1 or 2v2 where available), and match type (Ranked, Casual, or Practice). Set a location and time, then invite your opponent. They\'ll get a notification to accept.',
      },
      {
        q: 'What match types are available?',
        a: 'Ranked — affects your VP and rank. Casual — tracked in history but no VP changes. Practice — log solo or group sessions; tracks time spent, not wins or losses.',
      },
      {
        q: 'What is the Plan view?',
        a: 'The Plan view (calendar icon) shows your upcoming and past matches on a calendar. Tap any day to see matches on that date. The streak counter shows how many consecutive days you\'ve played. Tap "Today" to jump back to the current date.',
      },
      {
        q: 'How do I set my preferred sports?',
        a: 'Go to Profile → Edit Profile → Preferred Sports. The order you select determines how your sports appear on your profile and throughout the app.',
      },
    ],
  },
  {
    title: 'Ranking System',
    items: [
      {
        q: 'What are VP (Victory Points)?',
        a: 'VP are earned by winning ranked matches. Each sport tracks VP independently. Accumulate VP to advance through rank tiers in that sport.',
      },
      {
        q: 'What are the rank tiers?',
        a: 'From lowest to highest: Beginner → Bronze → Silver → Gold → Platinum → Diamond → Pro. Each tier has divisions (I, II, III) showing your progress within the tier.',
      },
      {
        q: 'How is VP awarded after a match?',
        a: 'Once a ranked match is completed and confirmed, VP is awarded to the winner and deducted from the loser. The amount depends on match format and outcome.',
      },
      {
        q: 'Can my rank drop?',
        a: 'Yes. Losing ranked matches costs VP. If your VP falls below a tier threshold, you\'ll drop to the lower tier. This is why both players must confirm results — to keep standings fair.',
      },
      {
        q: 'How does the Leaderboard work?',
        a: 'The Leaderboard (in the Versus tab) shows the top players per sport ranked by VP. Your own rank appears even if you\'re outside the top 10. Players with 0 VP are not shown.',
      },
      {
        q: 'Do casual or practice matches affect my rank?',
        a: 'No. Only Ranked matches change your VP and rank tier. Casual and Practice matches are tracked in your history but have no effect on standings.',
      },
    ],
  },
  {
    title: 'Matches & Results',
    items: [
      {
        q: 'What do the match statuses mean?',
        a: 'Planned — scheduled ahead of time. Pending — waiting on opponent to accept. Confirmed — all players accepted, ready to play. In Progress — match timer is running. Paused — temporarily stopped. Completed — results recorded.',
      },
      {
        q: 'How do I start and finish a match?',
        a: 'Once confirmed, tap "Start" on the match card to begin the timer. Tap "Finish" when done and select the winner (or Draw for casual). For ranked matches, both players must tap "Request Finish" — VP is awarded once both confirm.',
      },
      {
        q: 'Can I edit a completed match?',
        a: 'Yes. Tap the ⋯ menu on any completed match you were part of to edit scores, duration (for practice), or other details.',
      },
      {
        q: 'What is 2v2?',
        a: '2v2 is available for Tennis, Ping Pong, Basketball, and Volleyball. Invite a teammate and two opponents. All four players must accept before the match is confirmed.',
      },
      {
        q: 'Can I cancel a match?',
        a: 'Yes — tap the ⋯ menu on the match card and select Cancel. Canceling removes the match from your feed with no VP impact. For completed ranked matches, all participants must confirm deletion, which also reverses VP changes.',
      },
      {
        q: 'What if there\'s a dispute over results?',
        a: 'Both players must confirm the result for VP to be awarded. If scores submitted don\'t match, the match stays unresolved until both sides agree. Contact support if a dispute can\'t be settled.',
      },
    ],
  },
  {
    title: 'Map & Location',
    items: [
      {
        q: 'Who can see my location on the map?',
        a: 'Only mutual followers — you follow them and they follow you (both accepted). Strangers cannot see your location even if your visibility is set to Public. If either person sets location to Private, neither can see the other.',
      },
      {
        q: 'How do I control location visibility?',
        a: 'Go to Settings → Location → Public or Private. Public shares your approximate location with mutual followers only. Private hides you from the map entirely.',
      },
      {
        q: 'Is my exact location shown?',
        a: 'No. Pins show only a general area — not an exact address. This protects your privacy while still helping you find nearby matches.',
      },
      {
        q: 'What matches appear on the map?',
        a: 'Public matches from mutual followers appear anywhere on the map. Other public matches appear within your selected radius (2, 5, 10, or 20 miles). Private matches are never visible to non-participants.',
      },
      {
        q: 'Why isn\'t my location updating?',
        a: 'Location updates after you\'ve moved roughly 100 meters from the last recorded position — this limits battery drain. Make sure Versus has location permission ("While Using" or "Always") in your phone\'s settings.',
      },
    ],
  },
  {
    title: 'Social & Messaging',
    items: [
      {
        q: 'How does following work?',
        a: 'Follow other players to see their match activity in your feed. If their profile is Private, they must approve your request. Mutual follows unlock location sharing on the map.',
      },
      {
        q: 'How do I find friends?',
        a: 'Use the Search screen (magnifying glass) to find players by username or name. You can also connect your contacts — only a one-way hash is used for matching, your contacts are never stored on our servers.',
      },
      {
        q: 'How do I send a direct message?',
        a: 'Tap the chat icon at the top of the Home screen, or visit a player\'s profile and tap the message button. Conversations only appear in your inbox once you\'ve exchanged at least one message.',
      },
      {
        q: 'What does a Private profile mean?',
        a: 'A Private profile hides your match history and stats from non-followers. Your username is still visible in search. Approved followers can see your full profile.',
      },
      {
        q: 'Can I remove a follower or report someone?',
        a: 'Yes — go to your follower list to remove anyone. To report a user, use the Report option on their profile or contact us through Settings → Report a Problem.',
      },
    ],
  },
  {
    title: 'Membership',
    items: [
      {
        q: 'What is Versus Membership?',
        a: 'Membership is a premium tier coming soon that will unlock exclusive features for serious players. Stay tuned for the launch announcement.',
      },
      {
        q: 'What will membership include?',
        a: 'Details are being finalized, but membership perks will include enhanced stats, profile customization, and priority access to new features.',
      },
      {
        q: 'How will I be notified when membership launches?',
        a: 'Make sure push notifications are enabled in Settings. You\'ll receive an in-app notification as soon as memberships become available.',
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
