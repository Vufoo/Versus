import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import { supabase, resolveAvatarUrl } from '../lib/supabase';
import { SPORTS, SPORT_EMOJI } from '../constants/sports';

const SCREEN_W = Dimensions.get('window').width;

const GOLD   = '#F5C542';
const SILVER = '#B8C0CC';
const BRONZE = '#C47B3A';
const RANK_ACCENTS = [GOLD, SILVER, BRONZE];

type LeaderEntry = {
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  rank_tier: string | null;
  rank_div: string | null;
  vp: number;
};

type MyRating = {
  vp: number;
  losses: number;
  rank_tier: string | null;
  rank_div: string | null;
};

type SportData = {
  entries: LeaderEntry[];
  myRank: number | null;
  totalCount: number;
};

function tierColor(tier: string | null): string {
  switch (tier) {
    case 'Beginner': return '#9E9E9E';
    case 'Bronze':   return '#CD7F32';
    case 'Silver':   return '#C0C0C0';
    case 'Gold':     return '#FFD700';
    case 'Platinum': return '#00BCD4';
    case 'Diamond':  return '#64B5F6';
    case 'Pro':      return '#F44336';
    default:         return '#9E9E9E';
  }
}

// Derive tier from VP for users who have VP but no rank_tier yet
function deriveTier(vp: number, rank_tier: string | null): string | null {
  if (rank_tier) return rank_tier;
  if (vp <= 0) return null;
  if (vp < 100)  return 'Beginner';
  if (vp < 300)  return 'Bronze';
  if (vp < 600)  return 'Silver';
  if (vp < 1000) return 'Gold';
  if (vp < 1500) return 'Platinum';
  if (vp < 2200) return 'Diamond';
  return 'Pro';
}

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

    pageContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },

    // Compact sport header
    sportHeader: { alignItems: 'center', marginBottom: spacing.lg },
    sportEmoji: { fontSize: 36, marginBottom: spacing.xs },
    sportTitle: { ...typography.heading, color: c.text },

    // My rank card — sits above the list
    myRankCard: {
      backgroundColor: c.cardBg,
      borderRadius: borderRadius.lg,
      borderWidth: 1.5,
      borderColor: c.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    myRankIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    myRankTextBlock: { flex: 1 },
    myRankLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: c.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    myRankValue: { fontSize: 16, fontWeight: '700', color: c.text, marginTop: 2 },
    myRankSub: { fontSize: 11, color: c.textSecondary, marginTop: 2 },

    // Outer wrapper carries the border; inner card clips children
    listCardWrapper: {
      borderRadius: borderRadius.lg,
      borderWidth: 1.5,
      borderColor: c.primary,
    },
    listCard: {
      backgroundColor: c.cardBg,
      borderRadius: borderRadius.lg - 1.5,
      overflow: 'hidden',
    },

    // Column header row
    colHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      backgroundColor: c.primary,
      gap: spacing.sm,
    },
    colHeaderRank: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', width: 28, textAlign: 'center' },
    colHeaderPlayer: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', flex: 1 },
    colHeaderDiv: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textAlign: 'center', width: 72 },
    colHeaderVP: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textAlign: 'right', width: 52 },

    // Each row
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingRight: spacing.md,
      paddingLeft: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
      gap: spacing.sm,
    },
    rowAccentBar: {
      width: 3,
      alignSelf: 'stretch',
      borderRadius: 2,
    },
    rankNum: { fontSize: 12, fontWeight: '700', color: c.textSecondary, width: 22, textAlign: 'center' },
    medalText: { fontSize: 16, width: 22, textAlign: 'center' },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImg: { width: '100%', height: '100%', borderRadius: 999 },
    initials: { fontSize: 12, fontWeight: '700', color: c.textOnPrimary },
    info: { flex: 1, minWidth: 0 },
    name: { fontSize: 13, fontWeight: '600', color: c.text },
    nameMe: { color: c.primary },
    handle: { fontSize: 11, color: c.textSecondary, marginTop: 1 },
    divCol: { width: 72, alignItems: 'center' },
    vpCol: { width: 52, textAlign: 'right', fontSize: 11, fontWeight: '700', color: '#2563EB' },
    tierBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: borderRadius.sm, borderWidth: 1 },
    tierText: { fontSize: 9, fontWeight: '700' },
    // Empty slot placeholders
    emptyBar: { height: 7, borderRadius: 4, backgroundColor: c.border, opacity: 0.35 },

    // Dots
    dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: spacing.md },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.border },
    dotActive: { backgroundColor: c.primary },
  });
}

export default function LeaderboardScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [sportIdx, setSportIdx] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myRatings, setMyRatings] = useState<Record<string, MyRating>>({});
  const [sportData, setSportData] = useState<Partial<Record<string, SportData>>>({});
  const [initDone, setInitDone] = useState(false);
  const loadedRef = useRef(new Set<string>());

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ?? null;
      setCurrentUserId(userId);
      if (userId) {
        const { data: ratings } = await supabase
          .from('user_sport_ratings')
          .select('vp, losses, rank_tier, rank_div, sports!inner(name)')
          .eq('user_id', userId);
        const map: Record<string, MyRating> = {};
        for (const r of (ratings ?? []) as any[]) {
          const sName = (r.sports as any)?.name;
          if (sName) map[sName] = { vp: r.vp ?? 0, losses: r.losses ?? 0, rank_tier: r.rank_tier ?? null, rank_div: r.rank_div ?? null };
        }
        setMyRatings(map);
      }
      setInitDone(true);
    })();
  }, []);

  const loadSport = useCallback(async (sportName: string, userId: string | null, ratings: Record<string, MyRating>) => {
    if (loadedRef.current.has(sportName)) return;
    loadedRef.current.add(sportName);
    try {
      const { data: sportRow, error: sportErr } = await supabase.from('sports').select('id').eq('name', sportName).maybeSingle();
      if (sportErr) console.error('[Leaderboard] sport lookup error:', sportErr);
      if (!sportRow) { setSportData(prev => ({ ...prev, [sportName]: { entries: [], myRank: null, totalCount: 0 } })); return; }

      const myRating = userId ? ratings[sportName] : undefined;
      const myVp = myRating?.vp ?? 0;
      const myLosses = myRating?.losses ?? 0;

      // Step 1: get top 10 user_ids + stats (no join — avoid silent INNER JOIN drops)
      const top10Promise = supabase.from('user_sport_ratings')
        .select('user_id, vp, rank_tier, rank_div')
        .eq('sport_id', sportRow.id)
        .gt('vp', 0)
        .order('vp', { ascending: false })
        .limit(10);

      const totalPromise = supabase.from('user_sport_ratings')
        .select('*', { count: 'exact', head: true })
        .eq('sport_id', sportRow.id);

      const aboveVpPromise = userId
        ? supabase.from('user_sport_ratings').select('*', { count: 'exact', head: true }).eq('sport_id', sportRow.id).gt('vp', myVp)
        : Promise.resolve({ count: 0 });

      const sameVpPromise = userId
        ? supabase.from('user_sport_ratings').select('*', { count: 'exact', head: true }).eq('sport_id', sportRow.id).eq('vp', myVp).gt('losses', myLosses)
        : Promise.resolve({ count: 0 });

      const [top10Res, totalRes, aboveVpRes, sameVpRes] = await Promise.all([top10Promise, totalPromise, aboveVpPromise, sameVpPromise]);

      if (top10Res.error) console.error('[Leaderboard] top10 query error:', top10Res.error);

      const rows = (top10Res.data ?? []) as { user_id: string; vp: number; rank_tier: string | null; rank_div: string | null }[];

      // Step 2: fetch profiles separately for those user_ids
      const userIds = rows.map(r => r.user_id);
      let profileMap: Record<string, { username: string | null; full_name: string | null; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profileRows, error: profileErr } = await supabase
          .from('profiles')
          .select('user_id, username, full_name, avatar_url')
          .in('user_id', userIds);
        if (profileErr) console.error('[Leaderboard] profiles query error:', profileErr);
        await Promise.all((profileRows ?? []).map(async (p: any) => {
          profileMap[p.user_id] = {
            username: p.username ?? null,
            full_name: p.full_name ?? null,
            avatar_url: (await resolveAvatarUrl(p.avatar_url)) ?? null,
          };
        }));
      }

      const resolved: LeaderEntry[] = rows.map(r => ({
        user_id: r.user_id,
        username: profileMap[r.user_id]?.username ?? null,
        full_name: profileMap[r.user_id]?.full_name ?? null,
        avatar_url: profileMap[r.user_id]?.avatar_url ?? null,
        rank_tier: r.rank_tier,
        rank_div: r.rank_div,
        vp: r.vp,
      }));

      setSportData(prev => ({
        ...prev,
        [sportName]: {
          entries: resolved,
          myRank: userId ? (aboveVpRes?.count ?? 0) + (sameVpRes?.count ?? 0) + 1 : null,
          totalCount: totalRes?.count ?? 0,
        },
      }));
    } catch (e) {
      console.error('[Leaderboard] loadSport error:', e);
      setSportData(prev => ({ ...prev, [sportName]: { entries: [], myRank: null, totalCount: 0 } }));
    }
  }, []);

  useEffect(() => {
    if (!initDone) return;
    loadSport(SPORTS[sportIdx], currentUserId, myRatings);
  }, [sportIdx, initDone, currentUserId, myRatings, loadSport]);

  const getInitials = (e: LeaderEntry) =>
    (e.full_name ?? e.username ?? '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const medals = ['🥇', '🥈', '🥉'];
  const slots = (data: SportData | undefined): (LeaderEntry | null)[] =>
    Array.from({ length: 10 }, (_, i) => data?.entries[i] ?? null);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.versus.leaderboards}</Text>
      </View>

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          if (idx !== sportIdx) setSportIdx(idx);
        }}
        scrollEventThrottle={16}
        snapToInterval={SCREEN_W}
        decelerationRate="fast"
        style={{ flex: 1 }}
      >
        {SPORTS.map((sportName) => {
          const data = sportData[sportName];
          const myRating = myRatings[sportName];
          const rows = slots(data);

          return (
            <View key={sportName} style={{ width: SCREEN_W }}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pageContent} nestedScrollEnabled>

                {/* Compact sport header */}
                <View style={styles.sportHeader}>
                  <Text style={styles.sportEmoji}>{SPORT_EMOJI[sportName] ?? '🏆'}</Text>
                  <Text style={styles.sportTitle}>{sportName} {t.leaderboard.rankings}</Text>
                </View>

                {/* Your rank — top of page */}
                {data && (
                  <View style={styles.myRankCard}>
                    <View style={styles.myRankIcon}>
                      <Ionicons name="person" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.myRankTextBlock}>
                      <Text style={styles.myRankLabel}>{t.leaderboard.yourRank}</Text>
                      {myRating && myRating.vp > 0 ? (
                        <>
                          <Text style={styles.myRankValue}>
                            #{data.myRank}
                            {'  '}
                            <Text style={{ color: tierColor(deriveTier(myRating.vp, myRating.rank_tier)), fontSize: 14 }}>
                              {deriveTier(myRating.vp, myRating.rank_tier)}{myRating.rank_div ? ` ${myRating.rank_div}` : ''}
                            </Text>
                          </Text>
                          <Text style={styles.myRankSub}>
                            <Text style={{ color: '#2563EB', fontWeight: '700' }}>{myRating.vp} VP</Text>
                            {' · '}{data.totalCount} {t.leaderboard.playersTotal}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.myRankValue}>{t.common.unranked}</Text>
                      )}
                    </View>
                  </View>
                )}

                {/* 10-slot leaderboard card */}
                <View style={styles.listCardWrapper}>
                <View style={styles.listCard}>
                  {/* Column headers */}
                  <View style={styles.colHeader}>
                    <Text style={styles.colHeaderRank}>#</Text>
                    <Text style={[styles.colHeaderPlayer, { marginLeft: 36 + spacing.sm }]}>{t.leaderboard.player}</Text>
                    <Text style={styles.colHeaderDiv}>{t.leaderboard.rank}</Text>
                    <Text style={styles.colHeaderVP}>{t.leaderboard.vp}</Text>
                  </View>

                  {!data ? (
                    <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xxl }} />
                  ) : (
                    rows.map((entry, idx) => {
                      const isTop3 = idx < 3;
                      const accent = isTop3 ? RANK_ACCENTS[idx] : null;
                      const isMe = entry ? String(entry.user_id) === String(currentUserId) : false;
                      const tier = entry ? deriveTier(entry.vp, entry.rank_tier) : null;
                      const tColor = tier ? tierColor(tier) : null;
                      const isLast = idx === 9;

                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[
                            styles.row,
                            isLast && { borderBottomWidth: 0 },
                            accent && { backgroundColor: accent + '0E' },
                            isMe && !accent && { backgroundColor: colors.primary + '10' },
                          ]}
                          onPress={() => entry && navigation.navigate('UserProfile', { userId: entry.user_id })}
                          activeOpacity={entry ? 0.7 : 1}
                          disabled={!entry}
                        >
                          {/* Accent bar for top 3 */}
                          {accent
                            ? <View style={[styles.rowAccentBar, { backgroundColor: accent }]} />
                            : <View style={{ width: 3 }} />
                          }

                          {/* Rank */}
                          {isTop3
                            ? <Text style={styles.medalText}>{medals[idx]}</Text>
                            : <Text style={styles.rankNum}>{idx + 1}</Text>
                          }

                          {/* Avatar */}
                          <View style={[
                            styles.avatar,
                            accent && { borderWidth: 1.5, borderColor: accent },
                            !entry && { backgroundColor: colors.border, opacity: 0.3 },
                          ]}>
                            {entry?.avatar_url
                              ? <Image source={{ uri: entry.avatar_url }} style={styles.avatarImg} />
                              : entry
                                ? <Text style={styles.initials}>{getInitials(entry)}</Text>
                                : null
                            }
                          </View>

                          {/* Name + handle */}
                          <View style={styles.info}>
                            {entry ? (
                              <>
                                <Text style={[styles.name, isMe && styles.nameMe]} numberOfLines={1}>
                                  {entry.full_name ?? entry.username ?? 'Unknown'}{isMe ? ` (${t.common.you})` : ''}
                                </Text>
                                {entry.username ? <Text style={styles.handle}>@{entry.username}</Text> : null}
                              </>
                            ) : (
                              <>
                                <View style={[styles.emptyBar, { width: 70 + (idx % 3) * 22 }]} />
                                <View style={[styles.emptyBar, { width: 44, marginTop: 5 }]} />
                              </>
                            )}
                          </View>

                          {/* Rank (tier/div) column */}
                          <View style={styles.divCol}>
                            {entry ? (
                              tier && tColor ? (
                                <View style={[styles.tierBadge, { borderColor: tColor }]}>
                                  <Text style={[styles.tierText, { color: tColor }]}>
                                    {tier}{entry.rank_div ? ` ${entry.rank_div}` : ''}
                                  </Text>
                                </View>
                              ) : null
                            ) : (
                              <View style={[styles.emptyBar, { width: 44 }]} />
                            )}
                          </View>

                          {/* VP column */}
                          {entry ? (
                            <Text style={styles.vpCol}>{entry.vp} VP</Text>
                          ) : (
                            <View style={[styles.emptyBar, { width: 32 }]} />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
                </View>

              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.dotsRow}>
        {SPORTS.map((_, i) => (
          <View key={i} style={[styles.dot, i === sportIdx && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}
