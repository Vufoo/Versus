import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { SPORTS, sportLabel, SPORTS_2V2 } from '../constants/sports';
import UserSearch from './UserSearch';
import type { SearchedUser } from './UserSearch';

const SCREEN_H = Dimensions.get('window').height;

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
  colors: ThemeColors;
  initialSport?: string;
  initialMatchType?: 'casual' | 'ranked';
  initialDate?: string;
};

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrapper: { flex: 1, justifyContent: 'flex-end' },
    backdropHit: { flex: 1 },
    card: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl,
      maxHeight: SCREEN_H * 0.85,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    title: { ...typography.title, color: c.text },
    scrollContent: { paddingBottom: spacing.xl },
    label: { ...typography.label, color: c.textSecondary, marginBottom: spacing.xs },
    selectedOpp: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: c.background,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: c.primary,
      padding: spacing.sm,
      marginBottom: spacing.md,
    },
    oppAvatar: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
    },
    oppAvatarImg: { width: 32, height: 32, borderRadius: 16 },
    oppInitials: { fontSize: 12, fontWeight: '700', color: c.textOnPrimary },
    oppName: { ...typography.body, fontSize: 14, color: c.text, flex: 1 },
    oppRemove: { padding: spacing.xs },
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
    sportsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    sportChip: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm - 2,
      borderRadius: borderRadius.full, borderWidth: 1, borderColor: c.border, backgroundColor: c.background,
    },
    sportChipSel: { backgroundColor: c.primary, borderColor: c.primaryDark },
    sportChipLbl: { ...typography.label, color: c.textSecondary },
    sportChipLblSel: { color: c.textOnPrimary },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    timeBtn: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderRadius: borderRadius.md, borderWidth: 1, borderColor: c.primary, backgroundColor: c.background,
    },
    timeText: { ...typography.body, fontSize: 14, color: c.text },
    input: {
      borderRadius: borderRadius.md, borderWidth: 1, borderColor: c.border,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      backgroundColor: c.background, color: c.text, marginBottom: spacing.md,
    },
    notesInput: { height: 80, textAlignVertical: 'top' },
    summaryRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginTop: spacing.sm },
    summaryText: { ...typography.caption, color: c.textSecondary, flex: 1 },
    cta: {
      marginTop: spacing.lg, backgroundColor: c.primary,
      paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center',
    },
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
    amPm: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderRadius: borderRadius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.background,
    },
    amPmActive: { backgroundColor: c.primary, borderColor: c.primaryDark },
    amPmText: { ...typography.label, color: c.textSecondary },
    amPmTextActive: { color: c.textOnPrimary },
    tpDone: { backgroundColor: c.primary, paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
    tpDoneText: { ...typography.heading, fontSize: 16, color: c.textOnPrimary },
  });
}

export default function NewMatchModal({ visible, onClose, onCreated, colors, initialSport, initialMatchType, initialDate }: Props) {
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [opponent, setOpponent] = useState<SearchedUser | null>(null);
  const [teammate, setTeammate] = useState<SearchedUser | null>(null);
  const [opponent2, setOpponent2] = useState<SearchedUser | null>(null);
  const [sport, setSport] = useState(initialSport ?? SPORTS[0]);
  const [matchType, setMatchType] = useState<'casual' | 'ranked'>(initialMatchType ?? 'casual');
  const [matchFormat, setMatchFormat] = useState<'1v1' | '2v2'>('1v1');
  const [isPublic, setIsPublic] = useState(true);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [startNow, setStartNow] = useState(true);

  const [timeHour, setTimeHour] = useState(5);
  const [timeMinute, setTimeMinute] = useState(0);
  const [timeAmPm, setTimeAmPm] = useState<'AM' | 'PM'>('PM');
  const [timePicker, setTimePicker] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [friends, setFriends] = useState<SearchedUser[]>([]);

  useEffect(() => { if (initialSport) setSport(initialSport); }, [initialSport]);
  useEffect(() => { if (initialMatchType) setMatchType(initialMatchType); }, [initialMatchType]);
  const supports2v2 = SPORTS_2V2.includes(sport);
  useEffect(() => { if (!supports2v2) setMatchFormat('1v1'); }, [supports2v2]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: p } = await supabase.from('profiles').select('username').eq('user_id', user.id).maybeSingle();
      if (p?.username) setCurrentUsername(p.username);

      const { data: fRows } = await supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', user.id)
        .eq('status', 'accepted');
      if (fRows && fRows.length > 0) {
        const ids = fRows.map((r: any) => r.followed_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, full_name, avatar_url')
          .in('user_id', ids);
        if (profiles) setFriends(profiles as SearchedUser[]);
      }
    })();
  }, []);

  const formatTime = () => `${timeHour}:${timeMinute.toString().padStart(2, '0')} ${timeAmPm}`;

  const dateId = initialDate ?? new Date().toISOString().slice(0, 10);

  const handleSave = async () => {
    if (matchType === 'ranked' && !opponent) {
      Alert.alert('Ranked match requires opponent', 'Please invite at least one opponent to create a ranked match.');
      return;
    }
    if (matchFormat === '2v2' && (!teammate || !opponent || !opponent2)) {
      Alert.alert('2v2 requires full teams', 'Please invite a teammate and two opponents for 2v2.');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('Not signed in'); return; }

      const { data: sportRow } = await supabase.from('sports').select('id').eq('name', sport).maybeSingle();
      if (!sportRow) { Alert.alert('Sport not found'); return; }

      let scheduledAt: string;
      let matchStatus: string;
      if (startNow) {
        scheduledAt = new Date().toISOString();
        matchStatus = 'pending';
      } else {
        const d = new Date(dateId + 'T00:00:00');
        let h = timeHour;
        if (timeAmPm === 'PM' && h !== 12) h += 12;
        if (timeAmPm === 'AM' && h === 12) h = 0;
        d.setHours(h, timeMinute, 0, 0);
        scheduledAt = d.toISOString();
        matchStatus = 'pending';
      }

      const { data: match, error: err } = await supabase
        .from('matches')
        .insert({
          sport_id: sportRow.id,
          created_by: user.id,
          match_type: matchType,
          status: matchStatus,
          scheduled_at: scheduledAt,
          location_name: location.trim() || null,
          notes: notes.trim() || null,
          is_public: isPublic,
          match_format: matchFormat,
          invited_opponent_id: opponent?.user_id ?? null,
          invited_teammate_id: matchFormat === '2v2' ? teammate?.user_id ?? null : null,
          invited_opponent_2_id: matchFormat === '2v2' ? opponent2?.user_id ?? null : null,
        })
        .select('id')
        .single();
      if (err) throw err;

      const participants: { match_id: string; user_id: string; role: 'challenger' | 'opponent'; ready?: boolean }[] = [
        { match_id: match.id, user_id: user.id, role: 'challenger', ...(matchType === 'ranked' ? { ready: true } : {}) },
      ];
      const notifBody = startNow
        ? `${sportLabel(sport)} ${matchType} ${matchFormat} match starting now!`
        : `${sportLabel(sport)} ${matchType} match on ${new Date(dateId).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${formatTime()}`;
      const matchTypeLabel = matchType.charAt(0).toUpperCase() + matchType.slice(1);
      if (opponent) {
        await supabase.from('notifications').insert({
          user_id: opponent.user_id,
          type: 'match_invite',
          title: `${currentUsername ?? 'Someone'} challenged you to a ${matchTypeLabel} match!`,
          body: notifBody,
          data: { match_id: match.id, from_user_id: user.id, slot: matchFormat === '2v2' ? 'opponent' : 'opponent' },
        });
      }
      if (matchFormat === '2v2' && teammate) {
        await supabase.from('notifications').insert({
          user_id: teammate.user_id,
          type: 'match_invite',
          title: `${currentUsername ?? 'Someone'} invited you as teammate for a ${matchTypeLabel} match!`,
          body: notifBody,
          data: { match_id: match.id, from_user_id: user.id, slot: 'teammate' },
        });
      }
      if (matchFormat === '2v2' && opponent2) {
        await supabase.from('notifications').insert({
          user_id: opponent2.user_id,
          type: 'match_invite',
          title: `${currentUsername ?? 'Someone'} challenged you to a ${matchTypeLabel} match!`,
          body: notifBody,
          data: { match_id: match.id, from_user_id: user.id, slot: 'opponent_2' },
        });
      }
      await supabase.from('match_participants').insert(participants);

      reset();
      onClose();
      onCreated?.();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save match.');
    } finally { setSaving(false); }
  };

  const reset = () => {
    setOpponent(null);
    setTeammate(null);
    setOpponent2(null);
    setLocation('');
    setNotes('');
    setMatchType(initialMatchType ?? 'casual');
    setIsPublic(true);
    setMatchFormat('1v1');
    setSport(initialSport ?? SPORTS[0]);
    setStartNow(true);
  };

  const getInitials = (u: SearchedUser) =>
    (u.full_name ?? u.username ?? '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.wrapper}>
          {/* Tappable backdrop area above the card */}
          <TouchableOpacity style={styles.backdropHit} activeOpacity={1} onPress={onClose} />

          {/* Card sits outside the backdrop — no Pressable wrapping it */}
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>New match</Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              bounces={true}
            >
              <Text style={styles.label}>Invite opponent (optional for casual, required for ranked)</Text>
              {matchFormat === '2v2' ? (
                <>
                  <Text style={[styles.label, { marginTop: spacing.sm }]}>Teammate</Text>
                  {teammate ? (
                    <View style={styles.selectedOpp}>
                      {teammate.avatar_url ? (
                        <Image source={{ uri: teammate.avatar_url }} style={styles.oppAvatarImg} />
                      ) : (
                        <View style={styles.oppAvatar}><Text style={styles.oppInitials}>{getInitials(teammate)}</Text></View>
                      )}
                      <Text style={styles.oppName}>{teammate.full_name ?? teammate.username}{teammate.username ? ` (@${teammate.username})` : ''}</Text>
                      <TouchableOpacity style={styles.oppRemove} onPress={() => setTeammate(null)} hitSlop={8}>
                        <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <UserSearch colors={colors} excludeUserId={currentUserId ?? undefined} onSelect={setTeammate} placeholder="Search teammate..." suggestions={friends} suggestionsTitle={friends.length > 0 ? 'Friends' : undefined} />
                  )}
                  <Text style={[styles.label, { marginTop: spacing.md }]}>Opponent 1</Text>
                  {opponent ? (
                    <View style={styles.selectedOpp}>
                      {opponent.avatar_url ? (
                        <Image source={{ uri: opponent.avatar_url }} style={styles.oppAvatarImg} />
                      ) : (
                        <View style={styles.oppAvatar}><Text style={styles.oppInitials}>{getInitials(opponent)}</Text></View>
                      )}
                      <Text style={styles.oppName}>{opponent.full_name ?? opponent.username}{opponent.username ? ` (@${opponent.username})` : ''}</Text>
                      <TouchableOpacity style={styles.oppRemove} onPress={() => setOpponent(null)} hitSlop={8}>
                        <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <UserSearch colors={colors} excludeUserId={currentUserId ?? undefined} onSelect={setOpponent} placeholder="Search opponent 1..." suggestions={friends} suggestionsTitle={friends.length > 0 ? 'Friends' : undefined} />
                  )}
                  <Text style={[styles.label, { marginTop: spacing.md }]}>Opponent 2</Text>
                  {opponent2 ? (
                    <View style={styles.selectedOpp}>
                      {opponent2.avatar_url ? (
                        <Image source={{ uri: opponent2.avatar_url }} style={styles.oppAvatarImg} />
                      ) : (
                        <View style={styles.oppAvatar}><Text style={styles.oppInitials}>{getInitials(opponent2)}</Text></View>
                      )}
                      <Text style={styles.oppName}>{opponent2.full_name ?? opponent2.username}{opponent2.username ? ` (@${opponent2.username})` : ''}</Text>
                      <TouchableOpacity style={styles.oppRemove} onPress={() => setOpponent2(null)} hitSlop={8}>
                        <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <UserSearch colors={colors} excludeUserId={currentUserId ?? undefined} onSelect={setOpponent2} placeholder="Search opponent 2..." suggestions={friends} suggestionsTitle={friends.length > 0 ? 'Friends' : undefined} />
                  )}
                </>
              ) : (
                <>
                  {opponent ? (
                    <View style={styles.selectedOpp}>
                      {opponent.avatar_url ? (
                        <Image source={{ uri: opponent.avatar_url }} style={styles.oppAvatarImg} />
                      ) : (
                        <View style={styles.oppAvatar}><Text style={styles.oppInitials}>{getInitials(opponent)}</Text></View>
                      )}
                      <Text style={styles.oppName}>{opponent.full_name ?? opponent.username}{opponent.username ? ` (@${opponent.username})` : ''}</Text>
                      <TouchableOpacity style={styles.oppRemove} onPress={() => setOpponent(null)} hitSlop={8}>
                        <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <UserSearch colors={colors} excludeUserId={currentUserId ?? undefined} onSelect={setOpponent} placeholder="Search by username or name..." suggestions={friends} suggestionsTitle={friends.length > 0 ? 'Friends' : undefined} />
                  )}
                </>
              )}

              <Text style={[styles.label, { marginTop: spacing.md }]}>Match type</Text>
              <View style={styles.matchTypeRow}>
                {(['casual', 'ranked'] as const).map((t) => (
                  <TouchableOpacity key={t} style={[styles.matchTypeChip, matchType === t && styles.matchTypeChipSel]} onPress={() => setMatchType(t)} activeOpacity={0.8}>
                    <Text style={[styles.matchTypeLbl, matchType === t && styles.matchTypeLblSel]}>{t === 'casual' ? 'Casual' : 'Ranked'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { marginTop: spacing.md }]}>Visibility</Text>
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

              <Text style={styles.label}>Sport</Text>
              <View style={styles.sportsRow}>
                {SPORTS.map((s) => (
                  <TouchableOpacity key={s} style={[styles.sportChip, s === sport && styles.sportChipSel]} onPress={() => setSport(s)} activeOpacity={0.8}>
                    <Text style={[styles.sportChipLbl, s === sport && styles.sportChipLblSel]}>{sportLabel(s)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {supports2v2 && (
                <>
                  <Text style={[styles.label, { marginTop: spacing.md }]}>Format</Text>
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

              <Text style={[styles.label, { marginTop: spacing.md }]}>When</Text>
              <View style={styles.matchTypeRow}>
                <TouchableOpacity
                  style={[styles.matchTypeChip, startNow && styles.matchTypeChipSel]}
                  onPress={() => setStartNow(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="flash" size={16} color={startNow ? colors.textOnPrimary : colors.textSecondary} style={{ marginBottom: 2 }} />
                  <Text style={[styles.matchTypeLbl, startNow && styles.matchTypeLblSel]}>Start now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.matchTypeChip, !startNow && styles.matchTypeChipSel]}
                  onPress={() => setStartNow(false)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={16} color={!startNow ? colors.textOnPrimary : colors.textSecondary} style={{ marginBottom: 2 }} />
                  <Text style={[styles.matchTypeLbl, !startNow && styles.matchTypeLblSel]}>Schedule</Text>
                </TouchableOpacity>
              </View>

              {!startNow && (
                <>
                  <Text style={styles.label}>Time</Text>
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

              <View style={styles.summaryRow}>
                <Ionicons name={startNow ? 'flash' : 'calendar-outline'} size={18} color={colors.textSecondary} />
                <Text style={styles.summaryText}>
                  {startNow
                    ? 'Match starts immediately.'
                    : `Scheduled for ${new Date(dateId).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${formatTime()}.`}
                  {opponent ? ` ${opponent.full_name ?? opponent.username} will be notified.` : ''}
                </Text>
              </View>

              <TouchableOpacity style={[styles.cta, saving && styles.ctaDisabled]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.ctaText}>{startNow ? 'Start match' : opponent ? 'Send invite' : 'Create match'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>

        {/* Time picker sub-modal */}
        <Modal visible={timePicker} transparent animationType="fade">
          <View style={styles.tpOverlay}>
            <View style={styles.tpCard}>
              <View style={styles.tpHeader}>
                <Text style={styles.tpTitle}>Pick a time</Text>
                <TouchableOpacity onPress={() => setTimePicker(false)} hitSlop={12}><Ionicons name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
              </View>
              <View style={styles.tpRow}>
                <View style={styles.tpCol}>
                  <TouchableOpacity style={styles.tpArrow} onPress={() => setTimeHour((h) => h >= 12 ? 1 : h + 1)}><Ionicons name="chevron-up" size={28} color={colors.text} /></TouchableOpacity>
                  <Text style={styles.tpValue}>{timeHour}</Text>
                  <TouchableOpacity style={styles.tpArrow} onPress={() => setTimeHour((h) => h <= 1 ? 12 : h - 1)}><Ionicons name="chevron-down" size={28} color={colors.text} /></TouchableOpacity>
                  <Text style={styles.tpSmall}>Hour</Text>
                </View>
                <Text style={[styles.tpValue, { marginTop: -20 }]}>:</Text>
                <View style={styles.tpCol}>
                  <TouchableOpacity style={styles.tpArrow} onPress={() => setTimeMinute((m) => m >= 55 ? 0 : m + 5)}><Ionicons name="chevron-up" size={28} color={colors.text} /></TouchableOpacity>
                  <Text style={styles.tpValue}>{timeMinute.toString().padStart(2, '0')}</Text>
                  <TouchableOpacity style={styles.tpArrow} onPress={() => setTimeMinute((m) => m <= 0 ? 55 : m - 5)}><Ionicons name="chevron-down" size={28} color={colors.text} /></TouchableOpacity>
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
