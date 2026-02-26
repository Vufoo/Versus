import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { spacing, typography, borderRadius } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import { supabase } from '../lib/supabase';

import { sportLabel } from '../constants/sports';
import NewMatchModal from '../components/NewMatchModal';

type Day = {
  id: string;
  label: string;
  weekday: string;
  date: Date;
};

function buildUpcomingDays(count = 7): Day[] {
  const today = new Date();
  const formatterDay = new Intl.DateTimeFormat('en-US', { day: 'numeric' });
  const formatterWeekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

  return Array.from({ length: count }).map((_, idx) => {
    const d = new Date(today);
    d.setDate(today.getDate() + idx);
    return {
      id: d.toISOString().slice(0, 10),
      label: formatterDay.format(d),
      weekday: formatterWeekday.format(d),
      date: d,
    };
  });
}

type CalendarDay = { id: string; day: number; isCurrentMonth: boolean; isToday: boolean };

function buildMonthGrid(year: number, month: number): CalendarDay[][] {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
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

function createPlanStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    title: {
      ...typography.title,
      color: colors.primary,
      marginBottom: spacing.xs,
    },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
    },
    calendarCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.lg,
    },
    calendarTitle: {
      ...typography.heading,
      color: colors.text,
      marginBottom: spacing.sm,
    },
    calendarHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    calendarExpandButton: { padding: spacing.xs },
    daysRow: { gap: spacing.sm },
    dayChip: {
      width: 64,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: spacing.sm,
    },
    dayChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primaryDark,
    },
    dayWeekday: {
      ...typography.label,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    dayLabel: { ...typography.heading, color: colors.text },
    dayTextSelected: { color: colors.textOnPrimary },
    calendarHint: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.sm,
    },
    calendarHintStrong: { fontWeight: '600', color: colors.text },
    inlineRow: { marginBottom: spacing.md },
    nextTitle: { ...typography.heading, color: colors.text },
    nextSubtitle: { ...typography.caption, color: colors.textSecondary },
    newMatchButton: {
      position: 'absolute',
      right: spacing.lg,
      bottom: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      shadowColor: '#000',
      shadowOpacity: 0.16,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 12,
      elevation: 4,
    },
    newMatchText: {
      ...typography.heading,
      color: colors.textOnPrimary,
      fontSize: 18,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl,
      maxHeight: '90%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    modalTitle: { ...typography.title, color: colors.text },
    modalScroll: { flex: 1 },
    modalScrollContent: { paddingBottom: spacing.lg },
    label: {
      ...typography.label,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    input: {
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.background,
      color: colors.text,
      marginBottom: spacing.md,
    },
    notesInput: { height: 96, textAlignVertical: 'top' },
    sportsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    sportChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm - 2,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    sportChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primaryDark,
    },
    sportChipLabel: { ...typography.label, color: colors.textSecondary },
    sportChipLabelSelected: { color: colors.textOnPrimary },
    selectedOpponent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.background,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.primary,
      padding: spacing.sm,
      marginBottom: spacing.md,
    },
    selectedOpponentAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedOpponentAvatarImg: { width: 32, height: 32, borderRadius: 16 },
    selectedOpponentInitials: { fontSize: 12, fontWeight: '700', color: colors.textOnPrimary },
    selectedOpponentName: { ...typography.body, fontSize: 14, color: colors.text, flex: 1 },
    selectedOpponentRemove: { padding: spacing.xs },
    matchTypeRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    matchTypeChip: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
    },
    matchTypeChipSelected: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
    matchTypeLabel: { ...typography.label, color: colors.textSecondary },
    matchTypeLabelSelected: { color: colors.textOnPrimary },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    timeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    timeBtnActive: { borderColor: colors.primary },
    timeText: { ...typography.body, fontSize: 14, color: colors.text },
    timePickerModal: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
    },
    timePickerCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    timePickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    timePickerTitle: { ...typography.heading, color: colors.text },
    timePickerRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    timePickerCol: { alignItems: 'center' },
    timePickerValue: { ...typography.title, fontSize: 40, color: colors.text, minWidth: 60, textAlign: 'center' },
    timePickerSmallLabel: { ...typography.caption, color: colors.textSecondary },
    timePickerArrow: { padding: spacing.sm },
    amPmBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    amPmBtnActive: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
    amPmText: { ...typography.label, color: colors.textSecondary },
    amPmTextActive: { color: colors.textOnPrimary },
    timePickerDone: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    timePickerDoneText: { ...typography.heading, fontSize: 16, color: colors.textOnPrimary },
    summaryRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'flex-start',
      marginTop: spacing.sm,
    },
    summaryText: {
      ...typography.caption,
      color: colors.textSecondary,
      flex: 1,
    },
    modalCta: {
      marginTop: spacing.lg,
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    modalCtaDisabled: { opacity: 0.5 },
    modalCtaText: {
      ...typography.heading,
      color: colors.textOnPrimary,
    },
    upcomingCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    upcomingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    upcomingInfo: { flex: 1 },
    upcomingTitle: { ...typography.body, fontSize: 14, fontWeight: '600', color: colors.text },
    upcomingSub: { ...typography.caption, fontSize: 12, color: colors.textSecondary },
    upcomingStatus: {
      ...typography.label,
      fontSize: 10,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.full,
      overflow: 'hidden',
    },
    dayChipDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
      marginTop: 3,
    },
    expandBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
    },
    expandCard: {
      width: '100%',
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    expandHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    expandTitle: { ...typography.heading, color: colors.text },
    expandMonthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    expandMonthLabel: { ...typography.heading, color: colors.text, minWidth: 140, textAlign: 'center' },
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
      paddingVertical: 10,
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
    expandHint: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.sm,
    },
    expandHintStrong: { fontWeight: '600', color: colors.text },
  });
}

export default function PlanMatchScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const styles = useMemo(() => createPlanStyles(colors), [colors]);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const days = useMemo(() => buildUpcomingDays(), []);

  const today = new Date();
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());
  const monthGrid = useMemo(() => buildMonthGrid(calYear, calMonth), [calYear, calMonth]);

  const goToPrevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  };
  const goToNextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  };
  const [selectedDayId, setSelectedDayId] = useState<string>(days[0]?.id ?? '');
  const [modalVisible, setModalVisible] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  type UpcomingMatch = {
    id: string;
    sport_name: string;
    status: string;
    scheduled_at: string;
    location_name: string | null;
    participants: any[];
  };
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatch[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);

  const selectedDay = days.find((d) => d.id === selectedDayId);
  const openModal = () => setModalVisible(true);
  const closeModal = () => setModalVisible(false);

  const matchDayIds = useMemo(
    () => new Set(upcomingMatches.map((m) => m.scheduled_at?.slice(0, 10)).filter(Boolean)),
    [upcomingMatches],
  );

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    })();
  }, []);

  const loadUpcoming = useCallback(async () => {
    setLoadingUpcoming(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('match_feed')
        .select('*')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(20);
      const mine = (data ?? []).filter((m: any) =>
        (m.participants ?? []).some((p: any) => p.user_id === user.id),
      );
      setUpcomingMatches(mine as UpcomingMatch[]);
    } catch { /* swallow */ }
    finally { setLoadingUpcoming(false); }
  }, []);

  useEffect(() => { loadUpcoming(); }, [loadUpcoming]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Plan a match</Text>
      <Text style={styles.subtitle}>
        Tap a day on the calendar, then create a match with a friend.
      </Text>

      <View style={styles.calendarCard}>
        <View style={styles.calendarHeaderRow}>
          <Text style={styles.calendarTitle}>Calendar</Text>
          <TouchableOpacity
            onPress={() => setCalendarExpanded(true)}
            style={styles.calendarExpandButton}
            hitSlop={12}
          >
            <Ionicons name="expand-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daysRow}
        >
          {days.map((day) => {
            const isSelected = day.id === selectedDayId;
            return (
              <TouchableOpacity
                key={day.id}
                style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                onPress={() => setSelectedDayId(day.id)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.dayWeekday,
                    isSelected && styles.dayTextSelected,
                  ]}
                >
                  {day.weekday}
                </Text>
                <Text
                  style={[
                    styles.dayLabel,
                    isSelected && styles.dayTextSelected,
                  ]}
                >
                  {day.label}
                </Text>
                {matchDayIds.has(day.id) && <View style={[styles.dayChipDot, isSelected && { backgroundColor: colors.textOnPrimary }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {selectedDay && (
          <Text style={styles.calendarHint}>
            Planning for{' '}
            <Text style={styles.calendarHintStrong}>{selectedDay.weekday}</Text>.
          </Text>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.inlineRow}>
          <Text style={styles.nextTitle}>Upcoming matches</Text>
          <Text style={styles.nextSubtitle}>
            {loadingUpcoming ? 'Loading...' : upcomingMatches.length === 0 ? 'No upcoming matches. Create one!' : ''}
          </Text>
        </View>
        {upcomingMatches.map((m) => {
          const d = m.scheduled_at ? new Date(m.scheduled_at) : null;
          const dateStr = d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
          const timeStr = d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
          const opponent = (m.participants ?? []).find((p: any) => p.user_id !== currentUserId);
          const statusColor = m.status === 'confirmed' ? colors.success : m.status === 'pending' ? colors.warning : colors.textSecondary;
          return (
            <View key={m.id} style={styles.upcomingCard}>
              <View style={[styles.upcomingDot, { backgroundColor: statusColor }]} />
              <View style={styles.upcomingInfo}>
                <Text style={styles.upcomingTitle}>
                  {sportLabel(m.sport_name)} vs {opponent?.full_name ?? opponent?.username ?? 'TBD'}
                </Text>
                <Text style={styles.upcomingSub}>
                  {dateStr}{timeStr ? ` at ${timeStr}` : ''}{m.location_name ? ` · ${m.location_name}` : ''}
                </Text>
              </View>
              <Text style={[styles.upcomingStatus, { backgroundColor: `${statusColor}18`, color: statusColor }]}>
                {m.status}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={styles.newMatchButton} onPress={openModal} activeOpacity={0.9}>
        <Ionicons name="add-circle" size={28} color={colors.textOnPrimary} />
        <Text style={styles.newMatchText}>New match</Text>
      </TouchableOpacity>

      <NewMatchModal
        visible={modalVisible}
        onClose={closeModal}
        onCreated={() => { loadUpcoming(); navigation.navigate('Home'); }}
        colors={colors}
        initialDate={selectedDayId}
      />

      <Modal visible={calendarExpanded} transparent animationType="fade">
        <Pressable style={styles.expandBackdrop} onPress={() => setCalendarExpanded(false)}>
          <View
            style={styles.expandCard}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.expandHeader}>
              <Text style={styles.expandTitle}>Pick a day</Text>
              <TouchableOpacity
                onPress={() => setCalendarExpanded(false)}
                hitSlop={12}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.expandMonthNav}>
              <TouchableOpacity onPress={goToPrevMonth} hitSlop={12}>
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.expandMonthLabel}>
                {MONTH_NAMES[calMonth]} {calYear}
              </Text>
              <TouchableOpacity onPress={goToNextMonth} hitSlop={12}>
                <Ionicons name="chevron-forward" size={22} color={colors.text} />
              </TouchableOpacity>
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
                  return (
                    <TouchableOpacity
                      key={cell.id}
                      style={styles.calendarCell}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedDayId(cell.id);
                        setCalendarExpanded(false);
                      }}
                    >
                      <View
                        style={[
                          styles.calendarCellInner,
                          cell.isToday && !isSelected && styles.calendarCellToday,
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
                      {matchDayIds.has(cell.id) && (
                        <View style={[styles.dayChipDot, { marginTop: 2 }, isSelected && { backgroundColor: colors.textOnPrimary }]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            {selectedDay && (
              <Text style={styles.expandHint}>
                You’re planning for{' '}
                <Text style={styles.expandHintStrong}>{selectedDay.weekday}</Text>. Tap "New match" to
                schedule.
              </Text>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

