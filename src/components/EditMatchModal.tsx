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
import { SPORTS_2V2, SPORTS_2V2_ONLY } from '../constants/sports';
import LocationPickerModal from './LocationPickerModal';
import type { PickedLocation } from './LocationPickerModal';

const SCREEN_H = Dimensions.get('window').height;

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
  colors: ThemeColors;
  currentUserId?: string | null;
  match: {
    id: string;
    sport_name: string;
    match_type: string;
    status: string;
    location_name: string | null;
    location_lat?: number | null;
    location_lng?: number | null;
    notes: string | null;
    is_public?: boolean;
    match_format?: string;
    scheduled_at: string | null;
    created_by?: string | null;
    participants?: Array<{ user_id: string; role: string; username: string | null; full_name: string | null }>;
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
      height: 36,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.background,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 5,
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
    cta: {
      marginTop: spacing.lg,
      backgroundColor: c.primary,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      alignItems: 'center',
    },
    ctaDisabled: { opacity: 0.5 },
    ctaText: { ...typography.label, fontSize: 15, fontWeight: '600', color: c.textOnPrimary },
    deleteCta: {
      marginTop: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#E53935',
    },
    deleteCtaText: { ...typography.label, fontSize: 14, color: '#E53935' },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.background },
    chipSel: { backgroundColor: c.primary, borderColor: c.primaryDark },
    chipText: { ...typography.caption, color: c.text },
    chipTextSel: { color: c.textOnPrimary },
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

export default function EditMatchModal({ visible, onClose, onSaved, colors, match, currentUserId }: Props) {
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [location, setLocation] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationPicker, setLocationPicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [matchFormat, setMatchFormat] = useState<'1v1' | '2v2'>('1v1');
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [timePicker, setTimePicker] = useState(false);
  const [datePicker, setDatePicker] = useState(false);
  const [dpYear, setDpYear] = useState(new Date().getFullYear());
  const [dpMonth, setDpMonth] = useState(new Date().getMonth() + 1);
  const [dpDay, setDpDay] = useState(new Date().getDate());
  const [dpDateStr, setDpDateStr] = useState<string | null>(null);
  const [timeHour, setTimeHour] = useState(12);
  const [timeMinute, setTimeMinute] = useState(0);
  const [timeAmPm, setTimeAmPm] = useState<'AM' | 'PM'>('PM');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editTeams, setEditTeams] = useState(false);
  const [teamRoles, setTeamRoles] = useState<Record<string, 'challenger' | 'opponent'>>({});

  const isCreator = !!(currentUserId && match?.created_by === currentUserId);
  const isParticipant = !!(currentUserId && match?.participants?.some(p => p.user_id === currentUserId));
  const is2v2 = match?.match_format === '2v2';
  const isRanked = match?.match_type?.toLowerCase() === 'ranked';
  const isCasual = match?.match_type?.toLowerCase() === 'casual';

  const [winnerRole, setWinnerRole] = useState<'challenger' | 'opponent' | 'draw'>('draw');
  const [challengerScore, setChallengerScore] = useState('');
  const [opponentScore, setOpponentScore] = useState('');
  // Casual / practice: all participants can edit. Ranked: creator only.
  const canEdit = isCreator || (!isRanked && isParticipant);

  const supports2v2 = match ? SPORTS_2V2.includes(match.sport_name) : false;
  const only2v2 = match ? SPORTS_2V2_ONLY.includes(match.sport_name) : false;
  const canEditFormat = match && match.status !== 'in_progress' && match.status !== 'completed';

  useEffect(() => {
    if (match) {
      setLocation(match.location_name ?? '');
      setLocationLat(match.location_lat ?? null);
      setLocationLng(match.location_lng ?? null);
      setNotes(match.notes ?? '');
      setIsPublic(match.is_public !== false);
      setMatchFormat((match.match_format as '1v1' | '2v2') || '1v1');
      setScheduledAt(match.scheduled_at);
      setEditTeams(false);
      const roles: Record<string, 'challenger' | 'opponent'> = {};
      for (const p of match.participants ?? []) {
        if (p.role === 'challenger' || p.role === 'opponent') roles[p.user_id] = p.role;
      }
      setTeamRoles(roles);

      if (match.match_type?.toLowerCase() === 'casual') {
        supabase.from('match_participants').select('role, result, score').eq('match_id', match.id)
          .then(({ data }) => {
            if (!data) return;
            const chal = (data as any[]).find(p => p.role === 'challenger');
            const opp = (data as any[]).find(p => p.role === 'opponent');
            if (chal?.result === 'win') setWinnerRole('challenger');
            else if (opp?.result === 'win') setWinnerRole('opponent');
            else setWinnerRole('draw');
            setChallengerScore(chal?.score ?? '');
            setOpponentScore(opp?.score ?? '');
          });
      }
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
        const dateStr = match.scheduled_at.slice(0, 10);
        setDpDateStr(dateStr);
        setDpYear(parseInt(dateStr.slice(0, 4)));
        setDpMonth(parseInt(dateStr.slice(5, 7)));
        setDpDay(parseInt(dateStr.slice(8, 10)));
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
        const dateStr = dpDateStr ?? scheduledAt.slice(0, 10);
        let h = timeHour;
        if (timeAmPm === 'PM' && h !== 12) h += 12;
        if (timeAmPm === 'AM' && h === 12) h = 0;
        const d = new Date(dateStr + 'T00:00:00');
        d.setHours(h, timeMinute, 0, 0);
        newScheduledAt = d.toISOString();
      }

      const updates: Record<string, unknown> = {
        location_name: location.trim() || null,
        location_lat: locationLat,
        location_lng: locationLng,
        notes: notes.trim() || null,
        is_public: isPublic,
        scheduled_at: newScheduledAt,
      };
      if (canEditFormat) updates.match_format = matchFormat;

      await supabase.from('matches').update(updates).eq('id', match.id);

      if (isCasual) {
        const challResult = winnerRole === 'challenger' ? 'win' : winnerRole === 'opponent' ? 'loss' : 'draw';
        const oppResult = winnerRole === 'opponent' ? 'win' : winnerRole === 'challenger' ? 'loss' : 'draw';
        const challengers = (match.participants ?? []).filter(p => p.role === 'challenger');
        const opponents = (match.participants ?? []).filter(p => p.role === 'opponent');
        await Promise.all([
          ...challengers.map(p => supabase.from('match_participants').update({ result: challResult, score: challengerScore.trim() || null }).eq('match_id', match.id).eq('user_id', p.user_id)),
          ...opponents.map(p => supabase.from('match_participants').update({ result: oppResult, score: opponentScore.trim() || null }).eq('match_id', match.id).eq('user_id', p.user_id)),
        ]);
      }

      onClose();
      onSaved?.();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!match || !currentUserId || deleting) return;

    if (isRanked) {
      // Ranked: request delete — requires all participants to confirm
      const doRankedRequest = async () => {
        setDeleting(true);
        try {
          await supabase.from('match_participants')
            .update({ delete_requested: true })
            .eq('match_id', match.id)
            .eq('user_id', currentUserId);
          const { data: dbParticipants } = await supabase
            .from('match_participants')
            .select('user_id, delete_requested')
            .eq('match_id', match.id);
          const allConfirmed = dbParticipants != null &&
            dbParticipants.length >= 2 &&
            (dbParticipants as any[]).every((p) => p.delete_requested === true);
          if (allConfirmed) {
            await supabase.from('notifications').delete().eq('type', 'match_invite').filter('data->>match_id', 'eq', match.id);
            const { data, error } = await supabase.rpc('delete_match_as_participant', { p_match_id: match.id });
            if (error) throw error;
            if (!data?.ok) throw new Error(data?.error ?? 'Could not delete match.');
            onClose(); onSaved?.();
          } else {
            Alert.alert('Delete requested', 'Your delete request has been submitted. The match will be deleted once all players confirm.');
            onClose();
          }
        } catch (e: any) {
          Alert.alert('Error', e?.message ?? 'Could not request delete.');
        } finally { setDeleting(false); }
      };
      const msg = 'Both players must confirm to permanently delete this ranked match and reverse any rating changes.';
      if (Platform.OS === 'web') {
        if (window.confirm(msg)) doRankedRequest();
      } else {
        Alert.alert('Delete ranked match?', msg, [
          { text: 'Keep', style: 'cancel' },
          { text: 'Request delete', style: 'destructive', onPress: doRankedRequest },
        ]);
      }
    } else {
      // Casual / practice: creator can delete alone
      const doDelete = async () => {
        setDeleting(true);
        try {
          await supabase.from('notifications').delete().eq('type', 'match_invite').filter('data->>match_id', 'eq', match.id);
          const { data, error } = await supabase.rpc('delete_match_as_participant', { p_match_id: match.id });
          if (error) throw error;
          if (!data?.ok) throw new Error(data?.error ?? 'Could not delete match.');
          onClose(); onSaved?.();
        } catch (e: any) {
          Alert.alert('Delete failed', e?.message ?? 'Could not delete match.');
        } finally { setDeleting(false); }
      };
      if (Platform.OS === 'web') {
        if (window.confirm('Are you sure you want to permanently delete this match?')) doDelete();
      } else {
        Alert.alert('Delete match', 'Are you sure you want to permanently delete this match?', [
          { text: 'Keep', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]);
      }
    }
  };

  const handleLeave = async () => {
    if (!match || !currentUserId) return;
    Alert.alert('Leave match', 'Are you sure you want to leave this match?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        setDeleting(true);
        try {
          await supabase.from('match_participants').delete()
            .eq('match_id', match.id).eq('user_id', currentUserId);
          // If this user was the invited opponent, clear that field so others can be invited
          await supabase.from('matches').update({ invited_opponent_id: null })
            .eq('id', match.id).eq('invited_opponent_id', currentUserId);
          if (match.status === 'confirmed') {
            await supabase.from('matches').update({ status: 'pending' }).eq('id', match.id);
          }
          // Remove any pending match invite notification for this user
          await supabase.from('notifications').delete()
            .eq('user_id', currentUserId).eq('type', 'match_invite')
            .filter('data->>match_id', 'eq', match.id);
          onSaved?.(); onClose();
        } catch { /* swallow */ } finally { setDeleting(false); }
      }},
    ]);
  };

  const saveTeams = async () => {
    if (!match) return;
    setSaving(true);
    try {
      await Promise.all(Object.entries(teamRoles).map(([uid, role]) =>
        supabase.from('match_participants').update({ role }).eq('match_id', match.id).eq('user_id', uid)
      ));
      setEditTeams(false); onSaved?.();
    } catch { /* swallow */ } finally { setSaving(false); }
  };

  if (!match) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.wrapper}>
          <TouchableOpacity style={styles.backdropHit} activeOpacity={1} onPress={onClose} />
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>{canEdit ? 'Edit match' : 'Match options'}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
              {canEdit && (
                <>
                  <Text style={styles.label}>Visibility</Text>
                  <View style={styles.matchTypeRow}>
                    <TouchableOpacity style={[styles.matchTypeChip, isPublic && styles.matchTypeChipSel]} onPress={() => setIsPublic(true)} activeOpacity={0.8}>
                      <Ionicons name="globe-outline" size={16} color={isPublic ? colors.textOnPrimary : colors.textSecondary} />
                      <Text style={[styles.matchTypeLbl, isPublic && styles.matchTypeLblSel]}>Public</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.matchTypeChip, !isPublic && styles.matchTypeChipSel]} onPress={() => setIsPublic(false)} activeOpacity={0.8}>
                      <Ionicons name="lock-closed-outline" size={16} color={!isPublic ? colors.textOnPrimary : colors.textSecondary} />
                      <Text style={[styles.matchTypeLbl, !isPublic && styles.matchTypeLblSel]}>Private</Text>
                    </TouchableOpacity>
                  </View>

                  {canEditFormat && supports2v2 && !only2v2 && (
                    <>
                      <Text style={styles.label}>Format</Text>
                      <View style={styles.matchTypeRow}>
                        {(['1v1', '2v2'] as const).map((f) => (
                          <TouchableOpacity key={f} style={[styles.matchTypeChip, matchFormat === f && styles.matchTypeChipSel]} onPress={() => setMatchFormat(f)} activeOpacity={0.8}>
                            <Text style={[styles.matchTypeLbl, matchFormat === f && styles.matchTypeLblSel]}>{f}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  {scheduledAt && match.status !== 'in_progress' && match.status !== 'completed' && (
                    <>
                      <Text style={styles.label}>Scheduled date & time</Text>
                      <View style={styles.timeRow}>
                        <TouchableOpacity style={styles.timeBtn} onPress={() => setDatePicker(true)} activeOpacity={0.8}>
                          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                          <Text style={styles.timeText}>{dpDateStr ? new Date(dpDateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.timeBtn} onPress={() => setTimePicker(true)} activeOpacity={0.8}>
                          <Ionicons name="time-outline" size={18} color={colors.primary} />
                          <Text style={styles.timeText}>{formatTime()}</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  <Text style={styles.label}>Location</Text>
                  <TextInput style={styles.input} placeholder="Court or gym name" placeholderTextColor={colors.textSecondary} value={location} onChangeText={(t) => { setLocation(t); if (!t.trim()) { setLocationLat(null); setLocationLng(null); } }} />
                  <TouchableOpacity
                    style={[styles.timeBtn, { marginBottom: spacing.md }]}
                    onPress={() => setLocationPicker(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="map-outline" size={18} color={colors.primary} />
                    <Text style={styles.timeText}>
                      {locationLat != null ? 'Change pin on map' : 'Pick on map'}
                    </Text>
                  </TouchableOpacity>

                  {isCasual && (() => {
                    const challName = (match.participants ?? []).find(p => p.role === 'challenger')?.full_name
                      ?? (match.participants ?? []).find(p => p.role === 'challenger')?.username
                      ?? 'Challenger';
                    const oppName = (match.participants ?? []).find(p => p.role === 'opponent')?.full_name
                      ?? (match.participants ?? []).find(p => p.role === 'opponent')?.username
                      ?? 'Opponent';
                    return (
                      <>
                        <Text style={styles.label}>Winner</Text>
                        <View style={styles.matchTypeRow}>
                          {(['challenger', 'opponent', 'draw'] as const).map((opt) => {
                            const label = opt === 'draw' ? 'Draw' : opt === 'challenger' ? challName : oppName;
                            const icon = opt === 'draw' ? 'remove-circle-outline' : 'trophy-outline';
                            const sel = winnerRole === opt;
                            return (
                              <TouchableOpacity key={opt} style={[styles.matchTypeChip, sel && styles.matchTypeChipSel]} onPress={() => setWinnerRole(opt)} activeOpacity={0.8}>
                                <Ionicons name={icon as any} size={14} color={sel ? colors.textOnPrimary : colors.textSecondary} />
                                <Text style={[styles.matchTypeLbl, sel && styles.matchTypeLblSel]} numberOfLines={1}>{label}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <Text style={styles.label}>Score</Text>
                        <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md, alignItems: 'flex-end' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { textAlign: 'center', marginBottom: 4 }]} numberOfLines={1}>{challName}</Text>
                            <TextInput
                              style={[styles.input, { marginBottom: 0, textAlign: 'center' }]}
                              placeholder="e.g. 21-15"
                              placeholderTextColor={colors.textSecondary}
                              value={challengerScore}
                              onChangeText={setChallengerScore}
                            />
                          </View>
                          <Text style={{ color: colors.textSecondary, fontWeight: '700', paddingBottom: spacing.sm, fontSize: 13 }}>vs</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { textAlign: 'center', marginBottom: 4 }]} numberOfLines={1}>{oppName}</Text>
                            <TextInput
                              style={[styles.input, { marginBottom: 0, textAlign: 'center' }]}
                              placeholder="e.g. 15-21"
                              placeholderTextColor={colors.textSecondary}
                              value={opponentScore}
                              onChangeText={setOpponentScore}
                            />
                          </View>
                        </View>
                      </>
                    );
                  })()}

                  <Text style={styles.label}>Notes</Text>
                  <TextInput style={[styles.input, styles.notesInput]} placeholder="Notes and comments..." placeholderTextColor={colors.textSecondary} value={notes} onChangeText={setNotes} multiline />

                  <TouchableOpacity
                    style={[styles.cta, saving && styles.ctaDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color={colors.textOnPrimary} />
                    ) : (
                      <Text style={styles.ctaText}>Save changes</Text>
                    )}
                  </TouchableOpacity>

                  {is2v2 && (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.cta,
                          {
                            marginTop: spacing.sm,
                            backgroundColor: colors.surface,
                            borderWidth: 1,
                            borderColor: colors.border,
                          },
                        ]}
                        onPress={() => setEditTeams((e) => !e)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.ctaText, { color: colors.text }]}>
                          {editTeams ? 'Cancel editing teams' : 'Edit teams'}
                        </Text>
                      </TouchableOpacity>
                      {editTeams && (
                        <View style={{ marginTop: spacing.md }}>
                          {(match?.participants ?? []).map(p => (
                            <View key={p.user_id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <Text style={{ color: colors.text }}>{p.full_name ?? p.username}</Text>
                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity style={[styles.chip, teamRoles[p.user_id] === 'challenger' && styles.chipSel]} onPress={() => setTeamRoles(r => ({ ...r, [p.user_id]: 'challenger' }))}>
                                  <Text style={[styles.chipText, teamRoles[p.user_id] === 'challenger' && styles.chipTextSel]}>Team A</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.chip, teamRoles[p.user_id] === 'opponent' && styles.chipSel]} onPress={() => setTeamRoles(r => ({ ...r, [p.user_id]: 'opponent' }))}>
                                  <Text style={[styles.chipText, teamRoles[p.user_id] === 'opponent' && styles.chipTextSel]}>Team B</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))}
                          <TouchableOpacity
                            style={[styles.cta, { marginTop: spacing.md }, saving && styles.ctaDisabled]}
                            onPress={saveTeams}
                            disabled={saving}
                          >
                            {saving ? (
                              <ActivityIndicator color={colors.textOnPrimary} />
                            ) : (
                              <Text style={styles.ctaText}>Save teams</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}
                </>
              )}

              <View style={{ marginTop: spacing.lg, gap: spacing.xs }}>
                {isCreator && (
                  <TouchableOpacity
                    style={[styles.deleteCta, deleting && styles.ctaDisabled]}
                    onPress={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <ActivityIndicator color="#E53935" />
                    ) : (
                      <Text style={styles.deleteCtaText}>{isRanked ? 'Request delete' : 'Delete match'}</Text>
                    )}
                  </TouchableOpacity>
                )}

                {!isCreator && isParticipant && (
                  <TouchableOpacity
                    style={[styles.deleteCta, deleting && styles.ctaDisabled]}
                    onPress={handleLeave}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <ActivityIndicator color="#E53935" />
                    ) : (
                      <Text style={styles.deleteCtaText}>Leave match</Text>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={{ paddingVertical: spacing.xs, alignItems: 'center' }}
                  onPress={() =>
                    Alert.alert(
                      'Match Reported',
                      'Thank you for your report. Our team will review it shortly.',
                    )
                  }
                  activeOpacity={0.8}
                >
                  <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                    Report match
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>

        <LocationPickerModal
          visible={locationPicker}
          onClose={() => setLocationPicker(false)}
          onConfirm={(loc: PickedLocation) => {
            setLocation(loc.name || location);
            setLocationLat(loc.latitude);
            setLocationLng(loc.longitude);
            setLocationPicker(false);
          }}
          colors={colors}
          initial={locationLat != null && locationLng != null ? { latitude: locationLat, longitude: locationLng, name: location } : null}
        />

        <Modal visible={datePicker} transparent animationType="fade">
          <View style={styles.tpOverlay}>
            <View style={styles.tpCard}>
              <View style={styles.tpHeader}>
                <Text style={styles.tpTitle}>Pick a date</Text>
                <TouchableOpacity onPress={() => setDatePicker(false)} hitSlop={12}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.tpRow}>
                <View style={styles.tpCol}>
                  <TouchableOpacity style={styles.tpArrow} onPress={() => setDpMonth((m) => m >= 12 ? 1 : m + 1)}><Ionicons name="chevron-up" size={28} color={colors.text} /></TouchableOpacity>
                  <Text style={[styles.tpValue, { fontSize: 22, minWidth: 100 }]}>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dpMonth - 1]}</Text>
                  <TouchableOpacity style={styles.tpArrow} onPress={() => setDpMonth((m) => m <= 1 ? 12 : m - 1)}><Ionicons name="chevron-down" size={28} color={colors.text} /></TouchableOpacity>
                  <Text style={styles.tpSmall}>Month</Text>
                </View>
                <View style={styles.tpCol}>
                  <TouchableOpacity style={styles.tpArrow} onPress={() => setDpDay((d) => { const max = new Date(dpYear, dpMonth, 0).getDate(); return d >= max ? 1 : d + 1; })}><Ionicons name="chevron-up" size={28} color={colors.text} /></TouchableOpacity>
                  <Text style={styles.tpValue}>{dpDay}</Text>
                  <TouchableOpacity style={styles.tpArrow} onPress={() => setDpDay((d) => { const max = new Date(dpYear, dpMonth, 0).getDate(); return d <= 1 ? max : d - 1; })}><Ionicons name="chevron-down" size={28} color={colors.text} /></TouchableOpacity>
                  <Text style={styles.tpSmall}>Day</Text>
                </View>
                <View style={styles.tpCol}>
                  <TouchableOpacity style={styles.tpArrow} onPress={() => setDpYear((y) => y + 1)}><Ionicons name="chevron-up" size={28} color={colors.text} /></TouchableOpacity>
                  <Text style={styles.tpValue}>{dpYear}</Text>
                  <TouchableOpacity style={styles.tpArrow} onPress={() => setDpYear((y) => Math.max(new Date().getFullYear(), y - 1))}><Ionicons name="chevron-down" size={28} color={colors.text} /></TouchableOpacity>
                  <Text style={styles.tpSmall}>Year</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.tpDone} onPress={() => {
                const pad = (n: number) => String(n).padStart(2, '0');
                setDpDateStr(`${dpYear}-${pad(dpMonth)}-${pad(dpDay)}`);
                setDatePicker(false);
              }} activeOpacity={0.9}>
                <Text style={styles.tpDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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
