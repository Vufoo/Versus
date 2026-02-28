import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { SPORTS_2V2 } from '../constants/sports';

const SCREEN_H = Dimensions.get('window').height;

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
  colors: ThemeColors;
  match: {
    id: string;
    sport_name: string;
    match_type: string;
    status: string;
    location_name: string | null;
    notes: string | null;
    is_public?: boolean;
    match_format?: string;
    scheduled_at: string | null;
  } | null;
};

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrapper: { flex: 1, justifyContent: 'flex-end' },
    backdropHit: { flex: 1 },
    card: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl,
      maxHeight: SCREEN_H * 0.7,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
    title: { ...typography.title, color: c.text },
    scrollContent: { paddingBottom: spacing.xl },
    label: { ...typography.label, color: c.textSecondary, marginBottom: spacing.xs },
    matchTypeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    matchTypeChip: {
      flex: 1,
      minHeight: 48,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    matchTypeChipSel: { backgroundColor: c.primary, borderColor: c.primaryDark },
    matchTypeLbl: { ...typography.label, color: c.textSecondary },
    matchTypeLblSel: { color: c.textOnPrimary },
    input: {
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: c.background,
      color: c.text,
      marginBottom: spacing.md,
    },
    notesInput: { height: 80, textAlignVertical: 'top' },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    timeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: c.background,
    },
    timeText: { ...typography.body, fontSize: 14, color: c.text },
    cta: { marginTop: spacing.lg, backgroundColor: c.primary, paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
    ctaDisabled: { opacity: 0.5 },
    ctaText: { ...typography.heading, color: c.textOnPrimary },
    tpOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg },
    tpCard: { width: '100%', backgroundColor: c.surface, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: c.border },
    tpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    tpTitle: { ...typography.heading, color: c.text },
    tpRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
    tpCol: { alignItems: 'center' },
    tpValue: { ...typography.title, fontSize: 40, color: c.text, minWidth: 60, textAlign: 'center' },
    tpSmall: { ...typography.caption, color: c.textSecondary },
    tpArrow: { padding: spacing.sm },
    amPm: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.background },
    amPmActive: { backgroundColor: c.primary, borderColor: c.primaryDark },
    amPmText: { ...typography.label, color: c.textSecondary },
    amPmTextActive: { color: c.textOnPrimary },
    tpDone: { backgroundColor: c.primary, paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
    tpDoneText: { ...typography.heading, fontSize: 16, color: c.textOnPrimary },
  });
}

export default function EditMatchModal({ visible, onClose, onSaved, colors, match }: Props) {
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [matchFormat, setMatchFormat] = useState<'1v1' | '2v2'>('1v1');
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [timePicker, setTimePicker] = useState(false);
  const [timeHour, setTimeHour] = useState(12);
  const [timeMinute, setTimeMinute] = useState(0);
  const [timeAmPm, setTimeAmPm] = useState<'AM' | 'PM'>('PM');
  const [saving, setSaving] = useState(false);

  const supports2v2 = match ? SPORTS_2V2.includes(match.sport_name) : false;
  const canEditFormat = match && match.status !== 'in_progress' && match.status !== 'completed';

  useEffect(() => {
    if (match) {
      setLocation(match.location_name ?? '');
      setNotes(match.notes ?? '');
      setIsPublic(match.is_public !== false);
      setMatchFormat((match.match_format as '1v1' | '2v2') || '1v1');
      setScheduledAt(match.scheduled_at);
      if (match.scheduled_at) {
        const d = new Date(match.scheduled_at);
        let h = d.getHours();
        const m = d.getMinutes();
        setTimeMinute(m);
        if (h === 0) {
          setTimeHour(12);
          setTimeAmPm('AM');
        } else if (h < 12) {
          setTimeHour(h);
          setTimeAmPm('AM');
        } else {
          setTimeHour(h === 12 ? 12 : h - 12);
          setTimeAmPm('PM');
        }
      }
    }
  }, [match]);

  const formatTime = () => `${timeHour}:${timeMinute.toString().padStart(2, '0')} ${timeAmPm}`;

  const handleSave = async () => {
    if (!match) return;
    setSaving(true);
    try {
      let newScheduledAt: string | null = scheduledAt;
      if (scheduledAt) {
        const dateStr = scheduledAt.slice(0, 10);
        let h = timeHour;
        if (timeAmPm === 'PM' && h !== 12) h += 12;
        if (timeAmPm === 'AM' && h === 12) h = 0;
        const d = new Date(dateStr + 'T00:00:00');
        d.setHours(h, timeMinute, 0, 0);
        newScheduledAt = d.toISOString();
      }

      const updates: Record<string, unknown> = {
        location_name: location.trim() || null,
        notes: notes.trim() || null,
        is_public: isPublic,
        scheduled_at: newScheduledAt,
      };
      if (canEditFormat) updates.match_format = matchFormat;

      await supabase.from('matches').update(updates).eq('id', match.id);
      onClose();
      onSaved?.();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (!match) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.wrapper}>
          <TouchableOpacity style={styles.backdropHit} activeOpacity={1} onPress={onClose} />
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>Edit match</Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Visibility</Text>
              <View style={styles.matchTypeRow}>
                <TouchableOpacity style={[styles.matchTypeChip, isPublic && styles.matchTypeChipSel]} onPress={() => setIsPublic(true)} activeOpacity={0.8}>
                  <Ionicons name="globe-outline" size={16} color={isPublic ? colors.textOnPrimary : colors.textSecondary} style={{ marginBottom: 2 }} />
                  <Text style={[styles.matchTypeLbl, isPublic && styles.matchTypeLblSel]}>Public</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.matchTypeChip, !isPublic && styles.matchTypeChipSel]} onPress={() => setIsPublic(false)} activeOpacity={0.8}>
                  <Ionicons name="lock-closed-outline" size={16} color={!isPublic ? colors.textOnPrimary : colors.textSecondary} style={{ marginBottom: 2 }} />
                  <Text style={[styles.matchTypeLbl, !isPublic && styles.matchTypeLblSel]}>Private</Text>
                </TouchableOpacity>
              </View>

              {canEditFormat && supports2v2 && (
                <>
                  <Text style={styles.label}>Format</Text>
                  <View style={styles.matchTypeRow}>
                    <TouchableOpacity style={[styles.matchTypeChip, matchFormat === '1v1' && styles.matchTypeChipSel]} onPress={() => setMatchFormat('1v1')} activeOpacity={0.8}>
                      <Text style={[styles.matchTypeLbl, matchFormat === '1v1' && styles.matchTypeLblSel]}>1v1</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.matchTypeChip, matchFormat === '2v2' && styles.matchTypeChipSel]} onPress={() => setMatchFormat('2v2')} activeOpacity={0.8}>
                      <Text style={[styles.matchTypeLbl, matchFormat === '2v2' && styles.matchTypeLblSel]}>2v2</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {scheduledAt && match.status !== 'in_progress' && match.status !== 'completed' && (
                <>
                  <Text style={styles.label}>Scheduled time</Text>
                  <View style={styles.timeRow}>
                    <TouchableOpacity style={styles.timeBtn} onPress={() => setTimePicker(true)} activeOpacity={0.8}>
                      <Ionicons name="time-outline" size={18} color={colors.primary} />
                      <Text style={styles.timeText}>{formatTime()}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <Text style={styles.label}>Location</Text>
              <TextInput style={styles.input} placeholder="Court or gym name" placeholderTextColor={colors.textSecondary} value={location} onChangeText={setLocation} />

              <Text style={styles.label}>Notes</Text>
              <TextInput style={[styles.input, styles.notesInput]} placeholder="Format, rules, anything else..." placeholderTextColor={colors.textSecondary} value={notes} onChangeText={setNotes} multiline />

              <TouchableOpacity style={[styles.cta, saving && styles.ctaDisabled]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.ctaText}>Save changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>

        <Modal visible={timePicker} transparent animationType="fade">
          <View style={styles.tpOverlay}>
            <View style={styles.tpCard}>
              <View style={styles.tpHeader}>
                <Text style={styles.tpTitle}>Pick a time</Text>
                <TouchableOpacity onPress={() => setTimePicker(false)} hitSlop={12}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.tpRow}>
                <View style={styles.tpCol}>
                  <TouchableOpacity style={styles.tpArrow} onPress={() => setTimeHour((h) => (h >= 12 ? 1 : h + 1))}>
                    <Ionicons name="chevron-up" size={28} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.tpValue}>{timeHour}</Text>
                  <TouchableOpacity style={styles.tpArrow} onPress={() => setTimeHour((h) => (h <= 1 ? 12 : h - 1))}>
                    <Ionicons name="chevron-down" size={28} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.tpSmall}>Hour</Text>
                </View>
                <Text style={[styles.tpValue, { marginTop: -20 }]}>:</Text>
                <View style={styles.tpCol}>
                  <TouchableOpacity style={styles.tpArrow} onPress={() => setTimeMinute((m) => (m >= 55 ? 0 : m + 5))}>
                    <Ionicons name="chevron-up" size={28} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.tpValue}>{timeMinute.toString().padStart(2, '0')}</Text>
                  <TouchableOpacity style={styles.tpArrow} onPress={() => setTimeMinute((m) => (m <= 0 ? 55 : m - 5))}>
                    <Ionicons name="chevron-down" size={28} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.tpSmall}>Min</Text>
                </View>
                <View style={[styles.tpCol, { marginLeft: spacing.md, gap: spacing.sm }]}>
                  <TouchableOpacity style={[styles.amPm, timeAmPm === 'AM' && styles.amPmActive]} onPress={() => setTimeAmPm('AM')}>
                    <Text style={[styles.amPmText, timeAmPm === 'AM' && styles.amPmTextActive]}>AM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.amPm, timeAmPm === 'PM' && styles.amPmActive]} onPress={() => setTimeAmPm('PM')}>
                    <Text style={[styles.amPmText, timeAmPm === 'PM' && styles.amPmTextActive]}>PM</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity style={styles.tpDone} onPress={() => setTimePicker(false)} activeOpacity={0.9}>
                <Text style={styles.tpDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}
