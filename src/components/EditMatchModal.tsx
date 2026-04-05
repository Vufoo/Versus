import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { supabase, resolveAvatarUrl } from '../lib/supabase';
import { SPORTS_2V2, SPORTS_2V2_ONLY, SPORT_SCORING } from '../constants/sports';
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
    started_at?: string | null;
    ended_at?: string | null;
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
    label: { ...typography.label, color: c.textSecondary, marginBottom: spacing.sm },
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

type ParsedGame = { game_number: number; score_challenger: number; score_opponent: number };


export default function EditMatchModal({ visible, onClose, onSaved, colors, match, currentUserId }: Props) {
  const { t } = useLanguage();
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
  const [durationHours, setDurationHours] = useState('0');
  const [durationMinutes, setDurationMinutes] = useState('0');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editTeams, setEditTeams] = useState(false);
  const [teamRoles, setTeamRoles] = useState<Record<string, 'challenger' | 'opponent'>>({});

  const isCreator = !!(currentUserId && match?.created_by === currentUserId);
  const isParticipant = !!(currentUserId && match?.participants?.some(p => p.user_id === currentUserId));
  const is2v2 = match?.match_format === '2v2';
  const isRanked = match?.match_type?.toLowerCase() === 'ranked';
  const isCasual = match?.match_type?.toLowerCase() === 'casual';
  const isPractice = match?.match_type?.toLowerCase() === 'practice';

  const [winnerRole, setWinnerRole] = useState<'challenger' | 'opponent' | 'draw'>('draw');
  const [editGames, setEditGames] = useState<Array<{ score_challenger: string; score_opponent: string }>>([{ score_challenger: '', score_opponent: '' }]);
  const [participantAvatars, setParticipantAvatars] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const ids = (match?.participants ?? []).map(p => p.user_id);
    if (!ids.length) return;
    supabase.from('profiles').select('user_id, avatar_url').in('user_id', ids).then(async ({ data }) => {
      if (!data) return;
      const map: Record<string, string | null> = {};
      await Promise.all((data as any[]).map(async (p) => {
        map[p.user_id] = p.avatar_url ? (await resolveAvatarUrl(p.avatar_url)) ?? null : null;
      }));
      setParticipantAvatars(map);
    });
  }, [match?.id]);
  // Casual / practice: all participants can edit. Ranked: creator only.
  const canEdit = isCreator || (!isRanked && isParticipant);
  // Ranked non-creator participants can edit limited fields (location, notes, visibility).
  const canEditLimited = !isCreator && isRanked && isParticipant;

  const supports2v2 = match ? SPORTS_2V2.includes(match.sport_name) : false;
  const only2v2 = match ? SPORTS_2V2_ONLY.includes(match.sport_name) : false;
  const sportRules = match ? SPORT_SCORING[match.sport_name] : undefined;
  const isGolfSport = sportRules !== 'set' && !!(sportRules as { holeLimit?: number })?.holeLimit;
  const holeLimit = isGolfSport ? (sportRules as { holeLimit: number }).holeLimit : 18;
  const isLowerWinsSport = sportRules !== 'set' && !!(sportRules as { lowerWins?: boolean })?.lowerWins;

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

      if (match.status === 'completed' && match.started_at && match.ended_at) {
        const totalSecs = Math.max(0, Math.floor((new Date(match.ended_at).getTime() - new Date(match.started_at).getTime()) / 1000));
        setDurationHours(String(Math.floor(totalSecs / 3600)));
        setDurationMinutes(String(Math.floor((totalSecs % 3600) / 60)));
      } else {
        setDurationHours('0');
        setDurationMinutes('0');
      }
      // Practice: also load duration via ended_at - started_at (already handled above);
      // if started_at is null, defaults to 0h 0min which is fine.
      const roles: Record<string, 'challenger' | 'opponent'> = {};
      for (const p of match.participants ?? []) {
        if (p.role === 'challenger' || p.role === 'opponent') roles[p.user_id] = p.role;
      }
      setTeamRoles(roles);

      if (match.match_type?.toLowerCase() === 'casual') {
        let cancelled = false;
        Promise.all([
          supabase.from('match_participants').select('role, result, score').eq('match_id', match.id),
          supabase.from('match_games').select('game_number, score_challenger, score_opponent').eq('match_id', match.id).order('game_number'),
        ]).then(([{ data: pData }, { data: gData }]) => {
          if (cancelled) return;
          if (pData) {
            const chal = (pData as any[]).find(p => p.role === 'challenger');
            const opp = (pData as any[]).find(p => p.role === 'opponent');
            if (chal?.result === 'win') setWinnerRole('challenger');
            else if (opp?.result === 'win') setWinnerRole('opponent');
            else setWinnerRole('draw');
          }
          if (gData && (gData as any[]).length > 0) {
            const rows = (gData as any[]).slice(0, isGolfSport ? holeLimit : 11);
            setEditGames(rows.map((g: any) => ({
              score_challenger: (g.score_challenger ?? 0) > 0 || (g.score_opponent ?? 0) > 0 ? String(g.score_challenger ?? 0) : '',
              score_opponent: (g.score_challenger ?? 0) > 0 || (g.score_opponent ?? 0) > 0 ? String(g.score_opponent ?? 0) : '',
            })));
          } else {
            setEditGames([{ score_challenger: '', score_opponent: '' }]);
          }
        });
        return () => { cancelled = true; };
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
  // Depend only on match.id (not the whole object) — the match prop is an inline object
  // recreated on every HomeScreen render (polling), so using [match] would reset local
  // edits (score, games, winner) every few seconds while the user is typing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id]);

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

      if (match.status === 'completed' && (match.started_at || isPractice)) {
        const h = Math.max(0, parseInt(durationHours, 10) || 0);
        const m = Math.max(0, Math.min(59, parseInt(durationMinutes, 10) || 0));
        const newDurationMs = (h * 3600 + m * 60) * 1000;
        if (newDurationMs > 0) {
          if (match.started_at) {
            // Non-practice (or practice with started_at): anchor end_at on started_at
            updates.ended_at = new Date(new Date(match.started_at).getTime() + newDurationMs).toISOString();
          } else {
            // Practice without started_at: anchor on ended_at or now, derive started_at
            const anchor = match.ended_at ? new Date(match.ended_at).getTime() : Date.now();
            updates.started_at = new Date(anchor - newDurationMs).toISOString();
            updates.ended_at = new Date(anchor).toISOString();
          }
          updates.paused_at = null;
        }
      }

      await supabase.from('matches').update(updates).eq('id', match.id);

      let savedGames: ParsedGame[] = [];
      if (isCasual && match.status === 'completed') {
        const challResult = winnerRole === 'challenger' ? 'win' : winnerRole === 'opponent' ? 'loss' : 'draw';
        const oppResult = winnerRole === 'opponent' ? 'win' : winnerRole === 'challenger' ? 'loss' : 'draw';
        const challengers = (match.participants ?? []).filter(p => p.role === 'challenger');
        const opponents = (match.participants ?? []).filter(p => p.role === 'opponent');
        // Build per-game rows from the per-game UI inputs
        savedGames = editGames
          .map((g, i) => ({
            game_number: i + 1,
            score_challenger: parseInt(g.score_challenger, 10) || 0,
            score_opponent: parseInt(g.score_opponent, 10) || 0,
          }))
          .filter(g => g.score_challenger > 0 || g.score_opponent > 0);
        const challTotal = savedGames.reduce((a, g) => a + g.score_challenger, 0);
        const oppTotal = savedGames.reduce((a, g) => a + g.score_opponent, 0);
        await Promise.all([
          ...challengers.map(p => supabase.from('match_participants').update({ result: challResult, score: challTotal > 0 ? String(challTotal) : null }).eq('match_id', match.id).eq('user_id', p.user_id)),
          ...opponents.map(p => supabase.from('match_participants').update({ result: oppResult, score: oppTotal > 0 ? String(oppTotal) : null }).eq('match_id', match.id).eq('user_id', p.user_id)),
          ...(savedGames.length > 0 ? [
            supabase.from('match_games').delete().eq('match_id', match.id).then(() =>
              supabase.from('match_games').insert(savedGames.map(g => ({ match_id: match.id, ...g })))
            ),
          ] : [
            supabase.from('match_games').delete().eq('match_id', match.id),
          ]),
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

  const canLeave = !isCreator && isParticipant && (() => {
    if (!match) return false;
    const s = match.status;
    if (isRanked) return s === 'pending' || s === 'confirmed';
    return s === 'pending' || s === 'confirmed' || s === 'paused';
  })();

  const handleLeave = async () => {
    if (!match || !currentUserId) return;
    if (!canLeave) {
      Alert.alert('Cannot leave', match.status === 'completed' ? 'This match is already finished.' : 'You cannot leave this match at this stage.');
      return;
    }
    Alert.alert('Leave match', 'Are you sure you want to leave this match?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        setDeleting(true);
        try {
          const { error: delErr } = await supabase.from('match_participants').delete()
            .eq('match_id', match.id).eq('user_id', currentUserId);
          if (delErr) throw delErr;
          // Always touch matches to ensure all users' realtime subscriptions fire
          const matchUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (match.status === 'confirmed') matchUpdate.status = 'pending';
          await supabase.from('matches').update(matchUpdate).eq('id', match.id);
          // Remove any pending match invite notification for this user
          await supabase.from('notifications').delete()
            .eq('user_id', currentUserId).eq('type', 'match_invite')
            .filter('data->>match_id', 'eq', match.id);
          // Notify creator
          if (match.created_by && match.created_by !== currentUserId) {
            const { data: myProfile } = await supabase.from('profiles').select('username, full_name').eq('user_id', currentUserId).maybeSingle();
            const displayName = (myProfile as any)?.full_name ?? (myProfile as any)?.username ?? 'Your opponent';
            const notifBody = match.status === 'paused'
              ? 'They left while the match was paused.'
              : 'They left before the match started.';
            await supabase.from('notifications').insert({
              user_id: match.created_by,
              type: 'match_declined',
              title: `${displayName} left your match`,
              body: notifBody,
              data: { match_id: match.id, from_user_id: currentUserId },
            });
          }
          onSaved?.(); onClose();
        } catch (e: any) {
          Alert.alert('Error', e?.message ?? 'Could not leave match.');
        } finally { setDeleting(false); }
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
              <Text style={styles.title}>{canEdit || canEditLimited ? t.editMatch.title : t.editMatch.options}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
              {canEditLimited && (
                <>
                  <Text style={styles.label}>{t.newMatch.visibility}</Text>
                  <View style={styles.matchTypeRow}>
                    <TouchableOpacity style={[styles.matchTypeChip, isPublic && styles.matchTypeChipSel]} onPress={() => setIsPublic(true)} activeOpacity={0.8}>
                      <Ionicons name="globe-outline" size={16} color={isPublic ? colors.textOnPrimary : colors.textSecondary} />
                      <Text style={[styles.matchTypeLbl, isPublic && styles.matchTypeLblSel]}>{t.common.public}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.matchTypeChip, !isPublic && styles.matchTypeChipSel]} onPress={() => setIsPublic(false)} activeOpacity={0.8}>
                      <Ionicons name="lock-closed-outline" size={16} color={!isPublic ? colors.textOnPrimary : colors.textSecondary} />
                      <Text style={[styles.matchTypeLbl, !isPublic && styles.matchTypeLblSel]}>{t.common.private}</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>{t.newMatch.location}</Text>
                  <TextInput style={styles.input} placeholder={t.editMatch.courtOrGym} placeholderTextColor={colors.textSecondary} value={location} onChangeText={(v) => { setLocation(v); if (!v.trim()) { setLocationLat(null); setLocationLng(null); } }} />
                  <TouchableOpacity
                    style={[styles.timeBtn, { marginBottom: spacing.md }]}
                    onPress={() => setLocationPicker(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="map-outline" size={18} color={colors.primary} />
                    <Text style={styles.timeText}>
                      {locationLat != null ? t.editMatch.changePin : t.editMatch.pickOnMap}
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.label}>{t.newMatch.notes}</Text>
                  <TextInput style={[styles.input, styles.notesInput]} placeholder={t.editMatch.notesAndComments} placeholderTextColor={colors.textSecondary} value={notes} onChangeText={setNotes} multiline />

                  <TouchableOpacity
                    style={[styles.cta, saving && styles.ctaDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color={colors.textOnPrimary} />
                    ) : (
                      <Text style={styles.ctaText}>{t.editMatch.saveChanges}</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {canEdit && (
                <>
                  {isCasual && match.status === 'completed' && (() => {
                    const challName = (match.participants ?? []).find(p => p.role === 'challenger')?.full_name
                      ?? (match.participants ?? []).find(p => p.role === 'challenger')?.username
                      ?? 'Challenger';
                    const oppName = (match.participants ?? []).find(p => p.role === 'opponent')?.full_name
                      ?? (match.participants ?? []).find(p => p.role === 'opponent')?.username
                      ?? 'Opponent';
                    return (
                      <>
                        {(() => {
                          const challUserId = (match.participants ?? []).find(p => p.role === 'challenger')?.user_id;
                          const oppUserId = (match.participants ?? []).find(p => p.role === 'opponent')?.user_id;
                          const challAvatar = challUserId ? participantAvatars[challUserId] : null;
                          const oppAvatar = oppUserId ? participantAvatars[oppUserId] : null;
                          const challInitials = challName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
                          const oppInitials = oppName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
                          const renderAvatar = (uri: string | null, initials: string, size: number, sel?: boolean) => (
                            uri
                              ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
                              : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: sel !== undefined ? (sel ? 'rgba(255,255,255,0.25)' : colors.primary + '25') : colors.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
                                  <Text style={{ fontSize: size * 0.42, fontWeight: '700', color: sel !== undefined ? (sel ? colors.textOnPrimary : colors.primary) : colors.primary }}>{initials}</Text>
                                </View>
                          );
                          return (
                            <>
                        <Text style={styles.label}>Winner</Text>
                        <View style={styles.matchTypeRow}>
                          {(['challenger', 'opponent', 'draw'] as const).map((opt) => {
                            const chipName = opt === 'draw' ? 'Draw' : opt === 'challenger' ? challName : oppName;
                            const sel = winnerRole === opt;
                            return (
                              <TouchableOpacity key={opt} style={[styles.matchTypeChip, sel && styles.matchTypeChipSel]} onPress={() => setWinnerRole(opt)} activeOpacity={0.8}>
                                {opt === 'draw'
                                  ? <Ionicons name="remove-circle-outline" size={14} color={sel ? colors.textOnPrimary : colors.textSecondary} />
                                  : renderAvatar(opt === 'challenger' ? challAvatar : oppAvatar, opt === 'challenger' ? challInitials : oppInitials, 16, sel)
                                }
                                <Text style={[styles.matchTypeLbl, sel && styles.matchTypeLblSel]} numberOfLines={1}>{chipName}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <Text style={styles.label}>{isGolfSport ? 'Holes' : 'Score'}</Text>
                        {/* Per-game score header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
                          <View style={{ width: 22 + spacing.xs }} />
                          <View style={{ width: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                            {renderAvatar(challAvatar, challInitials, 18)}
                            <Text style={[styles.label, { marginBottom: 0, flexShrink: 1 }]} numberOfLines={1}>{challName}</Text>
                          </View>
                          <View style={{ width: 32 }} />
                          <View style={{ width: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                            {renderAvatar(oppAvatar, oppInitials, 18)}
                            <Text style={[styles.label, { marginBottom: 0, flexShrink: 1 }]} numberOfLines={1}>{oppName}</Text>
                          </View>
                          <View style={{ width: 22 + spacing.xs }} />
                        </View>
                        {editGames.map((game, idx) => (
                          <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs }}>
                            <Text style={[styles.label, { width: 22 + spacing.xs, color: colors.textSecondary, marginBottom: 0 }]}>
                              {isGolfSport ? `H${idx + 1}` : `G${idx + 1}`}
                            </Text>
                            <TextInput
                              style={[styles.input, { width: 90, marginBottom: 0, textAlign: 'center' }]}
                              placeholder={isGolfSport ? 'Strokes' : '0'}
                              placeholderTextColor={colors.textSecondary}
                              value={game.score_challenger}
                              onChangeText={v => setEditGames(gs => gs.map((g, i) => i === idx ? { ...g, score_challenger: v.replace(/[^0-9]/g, '') } : g))}
                              keyboardType="numeric"
                            />
                            <View style={{ width: 32, alignItems: 'center' }}>
                              <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 13 }}>–</Text>
                            </View>
                            <TextInput
                              style={[styles.input, { width: 90, marginBottom: 0, textAlign: 'center' }]}
                              placeholder={isGolfSport ? 'Strokes' : '0'}
                              placeholderTextColor={colors.textSecondary}
                              value={game.score_opponent}
                              onChangeText={v => setEditGames(gs => gs.map((g, i) => i === idx ? { ...g, score_opponent: v.replace(/[^0-9]/g, '') } : g))}
                              keyboardType="numeric"
                            />
                            <View style={{ width: 22 + spacing.xs, alignItems: 'center' }}>
                              <TouchableOpacity onPress={() => setEditGames(gs => gs.filter((_, i) => i !== idx))} hitSlop={8}>
                                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                        {isLowerWinsSport && (
                          <Text style={{ ...typography.caption, fontSize: 10, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xs }}>
                            Lower score wins
                          </Text>
                        )}
                        {editGames.length < (isGolfSport ? holeLimit : 11) && (
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: colors.primary, borderRadius: borderRadius.sm, alignSelf: 'center', marginTop: spacing.sm, marginBottom: spacing.md }}
                            onPress={() => setEditGames(gs => [...gs, { score_challenger: '', score_opponent: '' }])}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="add" size={12} color={colors.primary} />
                            <Text style={[styles.label, { color: colors.primary, marginBottom: 0, fontSize: 11 }]}>{isGolfSport ? 'Add hole' : 'Add game'}</Text>
                          </TouchableOpacity>
                        )}
                            </>
                          );
                        })()}
                      </>
                    );
                  })()}

                  <Text style={styles.label}>{t.newMatch.visibility}</Text>
                  <View style={styles.matchTypeRow}>
                    <TouchableOpacity style={[styles.matchTypeChip, isPublic && styles.matchTypeChipSel]} onPress={() => setIsPublic(true)} activeOpacity={0.8}>
                      <Ionicons name="globe-outline" size={16} color={isPublic ? colors.textOnPrimary : colors.textSecondary} />
                      <Text style={[styles.matchTypeLbl, isPublic && styles.matchTypeLblSel]}>{t.common.public}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.matchTypeChip, !isPublic && styles.matchTypeChipSel]} onPress={() => setIsPublic(false)} activeOpacity={0.8}>
                      <Ionicons name="lock-closed-outline" size={16} color={!isPublic ? colors.textOnPrimary : colors.textSecondary} />
                      <Text style={[styles.matchTypeLbl, !isPublic && styles.matchTypeLblSel]}>{t.common.private}</Text>
                    </TouchableOpacity>
                  </View>


                  {scheduledAt && match.status !== 'in_progress' && match.status !== 'completed' && (
                    <>
                      <Text style={styles.label}>{t.editMatch.scheduledDateTime}</Text>
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

                  {match.status === 'completed' && (match.started_at || isPractice) && (
                    <>
                      <Text style={styles.label}>{isPractice ? 'Time practiced' : 'Duration'}</Text>
                      <View style={[styles.timeRow, { marginBottom: spacing.md }]}>
                        <View style={[styles.timeBtn, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                          <TextInput
                            style={{ flex: 1, color: colors.text, fontSize: 15, textAlign: 'center', minWidth: 36 }}
                            keyboardType="number-pad"
                            value={durationHours}
                            onChangeText={v => setDurationHours(v.replace(/[^0-9]/g, ''))}
                            maxLength={2}
                          />
                          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>h</Text>
                        </View>
                        <View style={[styles.timeBtn, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                          <TextInput
                            style={{ flex: 1, color: colors.text, fontSize: 15, textAlign: 'center', minWidth: 36 }}
                            keyboardType="number-pad"
                            value={durationMinutes}
                            onChangeText={v => {
                              const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
                              setDurationMinutes(isNaN(n) ? '0' : String(Math.min(59, n)));
                            }}
                            maxLength={2}
                          />
                          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>min</Text>
                        </View>
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

                {canLeave && (
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
