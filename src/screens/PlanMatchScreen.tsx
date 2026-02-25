import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../constants/theme';

const SPORTS = ['Pickleball', 'Basketball', 'Tennis', 'Bowling', 'Boxing', 'Badminton', 'Ping Pong'];

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

export default function PlanMatchScreen() {
  const days = useMemo(() => buildUpcomingDays(), []);
  const [selectedDayId, setSelectedDayId] = useState<string>(days[0]?.id ?? '');
  const [modalVisible, setModalVisible] = useState(false);
  const [opponent, setOpponent] = useState('');
  const [sport, setSport] = useState<string>(SPORTS[0]);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const selectedDay = days.find((d) => d.id === selectedDayId);

  const openModal = () => setModalVisible(true);
  const closeModal = () => setModalVisible(false);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Plan a match</Text>
      <Text style={styles.subtitle}>
        Tap a day on the calendar, then create a match with a friend.
      </Text>

      <View style={styles.calendarCard}>
        <Text style={styles.calendarTitle}>Calendar</Text>
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
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {selectedDay && (
          <Text style={styles.calendarHint}>
            Planning for{' '}
            <Text style={styles.calendarHintStrong}>{selectedDay.weekday}</Text>{' '}
            (time selection coming soon).
          </Text>
        )}
      </View>

      <View style={styles.inlineRow}>
        <Text style={styles.nextTitle}>Upcoming (placeholder)</Text>
        <Text style={styles.nextSubtitle}>Synced matches will appear here.</Text>
      </View>

      <TouchableOpacity style={styles.newMatchButton} onPress={openModal} activeOpacity={0.9}>
        <Ionicons name="add-circle" size={28} color={colors.textOnPrimary} />
        <Text style={styles.newMatchText}>New match</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={closeModal}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New match</Text>
              <TouchableOpacity onPress={closeModal} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.label}>Invite friend</Text>
              <TextInput
                style={styles.input}
                placeholder="Username or contact (placeholder)"
                placeholderTextColor={colors.textSecondary}
                value={opponent}
                onChangeText={setOpponent}
              />

              <Text style={styles.label}>Sport</Text>
              <View style={styles.sportsRow}>
                {SPORTS.map((s) => {
                  const isSelected = s === sport;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.sportChip, isSelected && styles.sportChipSelected]}
                      onPress={() => setSport(s)}
                    >
                      <Text
                        style={[
                          styles.sportChipLabel,
                          isSelected && styles.sportChipLabelSelected,
                        ]}
                      >
                        {s}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Location (courts)</Text>
              <TextInput
                style={styles.input}
                placeholder="Court or gym name (placeholder)"
                placeholderTextColor={colors.textSecondary}
                value={location}
                onChangeText={setLocation}
              />

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="Ranked or casual, format, anything else…"
                placeholderTextColor={colors.textSecondary}
                value={notes}
                onChangeText={setNotes}
                multiline
              />

              <View style={styles.summaryRow}>
                <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.summaryText}>
                  Uses the day you selected above. Time picker & invites will be wired to the
                  backend next.
                </Text>
              </View>

              <TouchableOpacity style={styles.modalCta} onPress={closeModal}>
                <Text style={styles.modalCtaText}>Save match (placeholder)</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  daysRow: {
    gap: spacing.sm,
  },
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
  dayLabel: {
    ...typography.heading,
    color: colors.text,
  },
  dayTextSelected: {
    color: colors.textOnPrimary,
  },
  calendarHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  calendarHintStrong: {
    fontWeight: '600',
    color: colors.text,
  },
  inlineRow: {
    marginBottom: spacing.md,
  },
  nextTitle: {
    ...typography.heading,
    color: colors.text,
  },
  nextSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
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
  modalTitle: {
    ...typography.title,
    color: colors.text,
  },
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
  notesInput: {
    height: 96,
    textAlignVertical: 'top',
  },
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
  sportChipLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  sportChipLabelSelected: {
    color: colors.textOnPrimary,
  },
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
  modalCtaText: {
    ...typography.heading,
    color: colors.textOnPrimary,
  },
});

