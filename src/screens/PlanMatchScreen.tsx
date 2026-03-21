import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { spacing, typography, borderRadius } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import { useLanguage } from '../i18n/LanguageContext';
import { supabase } from '../lib/supabase';
import { sportLabel } from '../constants/sports';
import NewMatchModal from '../components/NewMatchModal';

type CalendarDay = { id: string; day: number; isCurrentMonth: boolean; isToday: boolean };

function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildMonthGrid(year: number, month: number): CalendarDay[][] {
  const todayStr = localDateStr(new Date());
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: CalendarDay[] = [];

  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const id = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ id, day: d, isCurrentMonth: false, isToday: id === todayStr });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const id = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ id, day: d, isCurrentMonth: true, isToday: id === todayStr });
  }

  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const id = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ id, day: d, isCurrentMonth: false, isToday: id === todayStr });
    }
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type UpcomingMatch = {
  id: string;
  sport_name: string;
  status: string;
  match_type: string;
  scheduled_at: string;
  location_name: string | null;
  participants: any[];
};

function createPlanStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
    },
    pageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: spacing.sm,
    },
    pageTitle: { ...typography.heading, color: colors.text },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
    },
    calendarCard: {
      backgroundColor: colors.cardBg,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.lg,
    },
    calendarHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    calendarTitle: {
      ...typography.heading,
      color: colors.text,
    },
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    weekdayRow: {
      flexDirection: 'row',
      marginBottom: spacing.xs,
    },
    weekdayCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    weekdayText: {
      ...typography.label,
      color: colors.textSecondary,
      fontSize: 12,
    },
    calendarWeekRow: {
      flexDirection: 'row',
    },
    calendarCell: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      position: 'relative',
    },
    calendarCellInner: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calendarCellSelected: {
      backgroundColor: colors.primary,
    },
    calendarCellToday: {
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    calendarDayText: {
      ...typography.body,
      fontSize: 14,
      color: colors.text,
    },
    calendarDayTextMuted: {
      color: colors.border,
    },
    calendarDayTextSelected: {
      color: colors.textOnPrimary,
      fontWeight: '600',
    },
    dayFlame: {
      position: 'absolute',
      top: 2,
      right: 2,
      fontSize: 9,
      lineHeight: 11,
    },
    calendarCellHasMatch: {
      borderWidth: 1.5,
      borderColor: '#F97316',
    },
    streakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: '#F9731620',
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: borderRadius.full,
    },
    streakText: { ...typography.caption, fontSize: 11, color: '#F97316', fontWeight: '700' },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    sectionTitle: { ...typography.heading, color: colors.text },
    sectionDate: { ...typography.caption, color: colors.textSecondary },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm - 2,
      borderRadius: borderRadius.md,
    },
    createBtnText: { ...typography.label, color: colors.textOnPrimary, fontSize: 13 },
    matchCard: {
      backgroundColor: colors.cardBg,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    matchDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    matchInfo: { flex: 1 },
    matchTitle: { ...typography.body, fontSize: 13, fontWeight: '600', color: colors.text },
    matchSub: { ...typography.caption, fontSize: 11, color: colors.textSecondary, marginTop: 1 },
    matchStatus: {
      ...typography.label,
      fontSize: 10,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.full,
      overflow: 'hidden',
    },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg },
    todayBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    todayBtnText: { ...typography.label, color: colors.primary, fontSize: 12 },
  });
}

export default function PlanMatchScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const styles = useMemo(() => createPlanStyles(colors), [colors]);

  const today = new Date();
  const todayStr = localDateStr(today);
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [selectedDayId, setSelectedDayId] = useState<string>(todayStr);
  const [modalVisible, setModalVisible] = useState(false);

  const monthGrid = useMemo(() => buildMonthGrid(calYear, calMonth), [calYear, calMonth]);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [allMatches, setAllMatches] = useState<UpcomingMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [preferredSports, setPreferredSports] = useState<string[]>([]);

  const loadMatches = useCallback(async () => {
    setLoadingMatches(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Fetch preferred_sports and participant match IDs in parallel
      const [profResult, participantResult] = await Promise.all([
        supabase.from('profiles').select('preferred_sports').eq('user_id', user.id).maybeSingle(),
        supabase.from('match_participants').select('match_id').eq('user_id', user.id),
      ]);
      if (profResult.data?.preferred_sports) setPreferredSports(profResult.data.preferred_sports);

      const participantMatchIds = (participantResult.data ?? []).map((r: any) => r.match_id as string);

      // Filter at DB level — avoids fetching 100 global matches and slicing client-side
      let query = supabase
        .from('match_feed')
        .select('id, sport_name, status, match_type, scheduled_at, location_name, participants, created_by')
        .not('status', 'eq', 'canceled')
        .order('scheduled_at', { ascending: true });

      if (participantMatchIds.length > 0) {
        query = query.or(`created_by.eq.${user.id},id.in.(${participantMatchIds.join(',')})`);
      } else {
        query = query.eq('created_by', user.id);
      }

      const { data } = await query;
      setAllMatches((data ?? []) as UpcomingMatch[]);
    } catch { /* swallow */ }
    finally { setLoadingMatches(false); }
  }, []);

  useEffect(() => { if (isFocused) loadMatches(); }, [isFocused, loadMatches]);

  const handleRefresh = useCallback(async () => {
    if (loadingMatches) return;
    setRefreshing(true);
    await loadMatches();
    setRefreshing(false);
  }, [loadMatches, loadingMatches]);

  const matchDayIds = useMemo(
    () => new Set(allMatches.map((m) => m.scheduled_at ? localDateStr(new Date(m.scheduled_at)) : null).filter(Boolean) as string[]),
    [allMatches],
  );

  const currentStreak = useMemo(() => {
    const now = new Date();
    let count = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      if (matchDayIds.has(localDateStr(d))) count++;
      else break;
    }
    return count;
  }, [matchDayIds]);

  const selectedDayMatches = useMemo(
    () => allMatches.filter((m) => m.scheduled_at ? localDateStr(new Date(m.scheduled_at)) === selectedDayId : false),
    [allMatches, selectedDayId],
  );

  const goToPrevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  };
  const goToNextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  };
  const goToToday = () => {
    setCalMonth(today.getMonth());
    setCalYear(today.getFullYear());
    setSelectedDayId(todayStr);
  };

  const selectedDateLabel = new Date(selectedDayId + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const statusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return colors.success;
      case 'in_progress': return colors.success;
      case 'pending': return colors.warning;
      case 'completed': return colors.success;
      default: return colors.textSecondary;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      {selectedDayId !== todayStr && (
        <View style={[styles.pageHeader, { justifyContent: 'flex-end' }]}>
          <TouchableOpacity style={styles.todayBtn} onPress={goToToday} activeOpacity={0.8}>
            <Text style={styles.todayBtnText}>{t.common.today}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.calendarCard}>
        <View style={styles.calendarHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={styles.calendarTitle}>
              {MONTH_NAMES[calMonth]} {calYear}
            </Text>
            {currentStreak > 0 && (
              <View style={styles.streakBadge}>
                <Text style={{ fontSize: 11 }}>🔥</Text>
                <Text style={styles.streakText}>{currentStreak}d</Text>
              </View>
            )}
          </View>
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={goToPrevMonth} hitSlop={12}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={goToNextMonth} hitSlop={12}>
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAY_HEADERS.map((wd) => (
            <View key={wd} style={styles.weekdayCell}>
              <Text style={styles.weekdayText}>{wd}</Text>
            </View>
          ))}
        </View>

        {monthGrid.map((week, wi) => (
          <View key={wi} style={styles.calendarWeekRow}>
            {week.map((cell) => {
              const isSelected = cell.id === selectedDayId;
              const hasMatch = matchDayIds.has(cell.id);
              return (
                <TouchableOpacity
                  key={cell.id}
                  style={styles.calendarCell}
                  activeOpacity={0.7}
                  onPress={() => setSelectedDayId(cell.id)}
                >
                  <View
                    style={[
                      styles.calendarCellInner,
                      cell.isToday && !isSelected && styles.calendarCellToday,
                      hasMatch && !isSelected && styles.calendarCellHasMatch,
                      isSelected && styles.calendarCellSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        !cell.isCurrentMonth && styles.calendarDayTextMuted,
                        isSelected && styles.calendarDayTextSelected,
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </View>
                  {hasMatch && (
                    <Text style={styles.dayFlame}>🔥</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>{t.plan.matches}</Text>
          <Text style={styles.sectionDate}>{selectedDateLabel}</Text>
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={18} color={colors.textOnPrimary} />
          <Text style={styles.createBtnText}>{t.plan.newMatch}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.text} colors={[colors.primary]} progressBackgroundColor={colors.cardBg} />}
      >
        {loadingMatches ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : selectedDayMatches.length === 0 ? (
          <Text style={styles.emptyText}>
            No matches on this day.{'\n'}Tap "New Match" to schedule one.
          </Text>
        ) : null}
        {!loadingMatches && selectedDayMatches.map((m) => {
          const d = m.scheduled_at ? new Date(m.scheduled_at) : null;
          const timeStr = d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
          const opponent = (m.participants ?? []).find((p: any) => p.user_id !== currentUserId);
          const sc = statusColor(m.status);
          return (
            <TouchableOpacity
              key={m.id}
              style={styles.matchCard}
              onPress={() => navigation.navigate('Home', { scrollToMatchId: m.id })}
              activeOpacity={0.8}
            >
              <View style={[styles.matchDot, { backgroundColor: sc }]} />
              <View style={styles.matchInfo}>
                <Text style={styles.matchTitle} numberOfLines={1}>
                  {sportLabel(m.sport_name)} vs {opponent?.full_name ?? opponent?.username ?? 'TBD'}
                </Text>
                <Text style={styles.matchSub} numberOfLines={1}>
                  {timeStr}{m.match_type ? ` · ${m.match_type.charAt(0).toUpperCase() + m.match_type.slice(1)}` : ''}
                </Text>
              </View>
              <Text style={[styles.matchStatus, { backgroundColor: `${sc}18`, color: sc }]}>
                {m.status === 'in_progress' ? 'In Progress' : m.status.charAt(0).toUpperCase() + m.status.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <NewMatchModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onCreated={() => { loadMatches(); setModalVisible(false); }}
        colors={colors}
        initialDate={selectedDayId}
        preferredSports={preferredSports}
      />
    </View>
  );
}
