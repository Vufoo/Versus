import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { SPORTS, sportLabel } from '../constants/sports';
import UserSearch from './UserSearch';
import type { SearchedUser } from './UserSearch';

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
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    card: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl,
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    title: { ...typography.title, color: c.text },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: spacing.lg },
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
      flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md,
      borderWidth: 1, borderColor: c.border, backgroundColor: c.background, alignItems: 'center',
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
    tpBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg },
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
  const [sport, setSport] = useState(initialSport ?? SPORTS[0]);
  const [matchType, setMatchType] = useState<'casual' | 'ranked'>(initialMatchType ?? 'casual');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [timeHour, setTimeHour] = useState(5);
  const [timeMinute, setTimeMinute] = useState(0);
  const [timeAmPm, setTimeAmPm] = useState<'AM' | 'PM'>('PM');
  const [timePicker, setTimePicker] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [friends, setFriends] = useState<SearchedUser[]>([]);

  useEffect(() => { if (initialSport) setSport(initialSport); }, [initialSport]);
  useEffect(() => { if (initialMatchType) setMatchType(initialMatchType); }, [initialMatchType]);

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
        .eq('follower_id', user.id);
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
    if (!opponent) { Alert.alert('Invite someone', 'Search and select an opponent.'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('Not signed in'); return; }

      const { data: sportRow } = await supabase.from('sports').select('id').eq('name', sport).maybeSingle();
      if (!sportRow) { Alert.alert('Sport not found'); return; }

      const d = new Date(dateId + 'T00:00:00');
      let h = timeHour;
      if (timeAmPm === 'PM' && h !== 12) h += 12;
      if (timeAmPm === 'AM' && h === 12) h = 0;
      d.setHours(h, timeMinute, 0, 0);

      const { data: match, error: err } = await supabase
        .from('matches')
        .insert({
          sport_id: sportRow.id,
          created_by: user.id,
          match_type: matchType,
          status: 'pending' as const,
          scheduled_at: d.toISOString(),
          location_name: location.trim() || null,
          notes: notes.trim() || null,
        })
        .select('id')
        .single();
      if (err) throw err;

      await supabase.from('match_participants').insert([
        { match_id: match.id, user_id: user.id, role: 'challenger' as const },
        { match_id: match.id, user_id: opponent.user_id, role: 'opponent' as const },
      ]);

      const dateLabel = new Date(dateId).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      await supabase.from('notifications').insert({
        user_id: opponent.user_id,
        type: 'match_invite',
        title: `${currentUsername ?? 'Someone'} challenged you!`,
        body: `${sportLabel(sport)} ${matchType} match on ${dateLabel} at ${formatTime()}`,
        data: { match_id: match.id, from_user_id: user.id },
      });

      reset();
      onClose();
      onCreated?.();
      Alert.alert('Match created', `Invite sent to ${opponent.full_name ?? opponent.username}!`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save match.');
    } finally { setSaving(false); }
  };

  const reset = () => {
    setOpponent(null);
    setLocation('');
    setNotes('');
    setMatchType(initialMatchType ?? 'casual');
    setSport(initialSport ?? SPORTS[0]);
  };

  const getInitials = (u: SearchedUser) =>
    (u.full_name ?? u.username ?? '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>New match</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Invite opponent</Text>
            {opponent ? (
              <View style={styles.selectedOpp}>
                {opponent.avatar_url ? (
                  <Image source={{ uri: opponent.avatar_url }} style={styles.oppAvatarImg} />
                ) : (
                  <View style={styles.oppAvatar}><Text style={styles.oppInitials}>{getInitials(opponent)}</Text></View>
                )}
                <Text style={styles.oppName}>
                  {opponent.full_name ?? opponent.username}{opponent.username ? ` (@${opponent.username})` : ''}
                </Text>
                <TouchableOpacity style={styles.oppRemove} onPress={() => setOpponent(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <UserSearch
                colors={colors}
                excludeUserId={currentUserId ?? undefined}
                onSelect={setOpponent}
                placeholder="Search by username or name..."
                suggestions={friends}
                suggestionsTitle={friends.length > 0 ? 'Friends' : undefined}
              />
            )}

            <Text style={[styles.label, { marginTop: spacing.md }]}>Match type</Text>
            <View style={styles.matchTypeRow}>
              {(['casual', 'ranked'] as const).map((t) => (
                <TouchableOpacity key={t} style={[styles.matchTypeChip, matchType === t && styles.matchTypeChipSel]} onPress={() => setMatchType(t)} activeOpacity={0.8}>
                  <Text style={[styles.matchTypeLbl, matchType === t && styles.matchTypeLblSel]}>{t === 'casual' ? 'Casual' : 'Ranked'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Sport</Text>
            <View style={styles.sportsRow}>
              {SPORTS.map((s) => (
                <TouchableOpacity key={s} style={[styles.sportChip, s === sport && styles.sportChipSel]} onPress={() => setSport(s)}>
                  <Text style={[styles.sportChipLbl, s === sport && styles.sportChipLblSel]}>{sportLabel(s)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Time</Text>
            <View style={styles.timeRow}>
              <TouchableOpacity style={styles.timeBtn} onPress={() => setTimePicker(true)} activeOpacity={0.8}>
                <Ionicons name="time-outline" size={18} color={colors.primary} />
                <Text style={styles.timeText}>{formatTime()}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Location</Text>
            <TextInput style={styles.input} placeholder="Court or gym name" placeholderTextColor={colors.textSecondary} value={location} onChangeText={setLocation} />

            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, styles.notesInput]} placeholder="Format, rules, anything else…" placeholderTextColor={colors.textSecondary} value={notes} onChangeText={setNotes} multiline />

            <View style={styles.summaryRow}>
              <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.summaryText}>
                Scheduled for {new Date(dateId).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {formatTime()}.
                {opponent ? ` ${opponent.full_name ?? opponent.username} will be notified.` : ''}
              </Text>
            </View>

            <TouchableOpacity style={[styles.cta, !opponent && styles.ctaDisabled]} onPress={handleSave} disabled={saving || !opponent}>
              {saving ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.ctaText}>Send invite</Text>}
            </TouchableOpacity>
          </ScrollView>

          <Modal visible={timePicker} transparent animationType="fade">
            <Pressable style={styles.tpBackdrop} onPress={() => setTimePicker(false)}>
              <Pressable style={styles.tpCard} onPress={(e) => e.stopPropagation()}>
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
              </Pressable>
            </Pressable>
          </Modal>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
