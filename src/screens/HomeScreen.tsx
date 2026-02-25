import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../constants/theme';

type FeedMode = 'public' | 'my';

const FEED_ITEMS_PUBLIC = [
  {
    id: '1',
    sport: 'Pickleball',
    player1: 'Alex',
    player2: 'Jordan',
    score: '11-8, 11-6',
    winner: 'Alex',
    vpChange: '+12',
    timeAgo: '2h ago',
    location: 'Riverside Courts',
  },
  {
    id: '2',
    sport: 'Basketball',
    player1: 'Sam',
    player2: 'Riley',
    score: '21-15',
    winner: 'Sam',
    vpChange: '+8',
    timeAgo: '5h ago',
    location: 'Downtown Gym',
  },
  {
    id: '3',
    sport: 'Tennis',
    player1: 'Morgan',
    player2: 'Casey',
    score: '6-4, 6-3',
    winner: 'Morgan',
    vpChange: '+15',
    timeAgo: '1d ago',
    location: 'Central Park',
  },
];

const FEED_ITEMS_MY = [
  {
    id: 'm1',
    sport: 'Ping Pong',
    player1: 'You',
    player2: 'Jamie',
    score: '11-9, 11-7',
    winner: 'You',
    vpChange: '+10',
    timeAgo: 'Yesterday',
    location: 'Rec Center',
  },
  {
    id: 'm2',
    sport: 'Badminton',
    player1: 'You',
    player2: 'Taylor',
    score: '21-18, 21-19',
    winner: 'Taylor',
    vpChange: '-6',
    timeAgo: '3d ago',
    location: 'Community Center',
  },
];

function FeedCard({
  sport,
  player1,
  player2,
  score,
  winner,
  vpChange,
  timeAgo,
  location,
}: {
  sport: string;
  player1: string;
  player2: string;
  score: string;
  winner: string;
  vpChange: string;
  timeAgo: string;
  location: string;
}) {
  const isWin = vpChange.startsWith('+');
  const [liked, setLiked] = useState(false);

  const toggleLike = () => setLiked((prev) => !prev);

  return (
    <View style={styles.feedCard}>
      <View style={styles.feedCardHeader}>
        <Text style={styles.feedSport}>{sport}</Text>
        <Text style={styles.feedTime}>{timeAgo}</Text>
      </View>
      <View style={styles.feedImage}>
        <Ionicons name="image" size={22} color={colors.textSecondary} />
        <Text style={styles.feedImageText}>Match photos (placeholder)</Text>
      </View>
      <View style={styles.feedMatchup}>
        <Text style={styles.feedPlayer}>{player1}</Text>
        <Text style={styles.feedVs}>vs</Text>
        <Text style={styles.feedPlayer}>{player2}</Text>
      </View>
      <Text style={styles.feedScore}>{score}</Text>
      <View style={styles.feedFooter}>
        <Text style={styles.feedLocation}>{location}</Text>
        <View style={styles.feedVpRow}>
          <Text style={[styles.feedVp, isWin ? styles.feedVpWin : styles.feedVpLoss]}>
            {vpChange} VP
          </Text>
          <Text style={styles.feedWinner}>{winner} wins</Text>
        </View>
      </View>
      <View style={styles.feedActions}>
        <TouchableOpacity style={styles.actionButton} onPress={toggleLike} activeOpacity={0.8}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={18}
            color={liked ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.actionLabel,
              liked && { color: colors.primary, fontWeight: '600' },
            ]}
          >
            {liked ? 'Liked' : 'Like'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.actionLabel}>Comment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const [feedMode, setFeedMode] = useState<FeedMode>('my');
  const items = feedMode === 'public' ? FEED_ITEMS_PUBLIC : FEED_ITEMS_MY;

  return (
    <View style={styles.container}>
      <View style={styles.switcherRow}>
        <TouchableOpacity
          style={[styles.switcherTab, feedMode === 'my' && styles.switcherTabActive]}
          onPress={() => setFeedMode('my')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="people"
            size={18}
            color={feedMode === 'my' ? colors.textOnPrimary : colors.textSecondary}
          />
          <Text
            style={[
              styles.switcherLabel,
              feedMode === 'my' && styles.switcherLabelActive,
            ]}
          >
            My feed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.switcherTab, feedMode === 'public' && styles.switcherTabActive]}
          onPress={() => setFeedMode('public')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="globe-outline"
            size={18}
            color={feedMode === 'public' ? colors.textOnPrimary : colors.textSecondary}
          />
          <Text
            style={[
              styles.switcherLabel,
              feedMode === 'public' && styles.switcherLabelActive,
            ]}
          >
            Public
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.switcherHint}>
        {feedMode === 'my'
          ? 'Matches from you and friends'
          : 'Matches happening around you'}
      </Text>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <FeedCard
            sport={item.sport}
            player1={item.player1}
            player2={item.player2}
            score={item.score}
            winner={item.winner}
            vpChange={item.vpChange}
            timeAgo={item.timeAgo}
            location={item.location}
          />
        )}
      />
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
  switcherRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  switcherTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  switcherTabActive: {
    backgroundColor: colors.primary,
  },
  switcherLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  switcherLabelActive: {
    color: colors.textOnPrimary,
  },
  switcherHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  feedCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feedCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  feedImage: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.offWhite,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  feedImageText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  feedSport: {
    ...typography.label,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  feedTime: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  feedMatchup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  feedPlayer: {
    ...typography.heading,
    color: colors.text,
  },
  feedVs: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  feedScore: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  feedFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  feedLocation: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  feedVpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  feedVp: {
    ...typography.label,
  },
  feedVpWin: {
    color: colors.success,
  },
  feedVpLoss: {
    color: colors.error,
  },
  feedWinner: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  feedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.lg,
    paddingTop: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
