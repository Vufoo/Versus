import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { supabase, resolveAvatarUrl } from '../lib/supabase';
import { SPORTS, SPORTS_2V2, sportLabel } from '../constants/sports';
import UserSearch from './UserSearch';
import type { SearchedUser } from './UserSearch';
import LocationPickerModal from './LocationPickerModal';
import type { PickedLocation } from './LocationPickerModal';

const SCREEN_H = Dimensions.get('window').height;

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
  colors: ThemeColors;
  initialSport?: string;
  initialMatchType?: 'casual' | 'ranked' | 'practice';
  initialDate?: string;
  initialLocation?: { latitude: number; longitude: number; name: string } | null;
  preferredSports?: string[];
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
      height: 36,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.background,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
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
    suggestionsList: {
      borderWidth: 1,
      borderColor: c.border,
      borderTopWidth: 0,
      borderBottomLeftRadius: borderRadius.md,
      borderBottomRightRadius: borderRadius.md,
      backgroundColor: c.cardBg,
      overflow: 'hidden',
      marginBottom: spacing.md,
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
    },
    suggestionText: {
      ...typography.body,
      fontSize: 13,
      color: c.text,
      flex: 1,
    },
  });
}

export default function NewMatchModal({ visible, onClose, onCreated, colors, initialSport, initialMatchType, initialDate, initialLocation, preferredSports = [] }: Props) {
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [opponent, setOpponent] = useState<SearchedUser | null>(null);
  const [practicePartner1, setPracticePartner1] = useState<SearchedUser | null>(null);
  const [practicePartner2, setPracticePartner2] = useState<SearchedUser | null>(null);
  const [practicePartner3, setPracticePartner3] = useState<SearchedUser | null>(null);
  const [sport, setSport] = useState(initialSport ?? SPORTS[0]);
  const [matchType, setMatchType] = useState<'casual' | 'ranked' | 'practice'>(initialMatchType ?? 'casual');
  const [matchFormat, setMatchFormat] = useState<'1v1' | '2v2'>('1v1');
  const [teammate, setTeammate] = useState<SearchedUser | null>(null);
  const [opponent2, setOpponent2] = useState<SearchedUser | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [location, setLocation] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationPicker, setLocationPicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const todayDateStr = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
  }, []);
  const [scheduleDate, setScheduleDate] = useState<string>(initialDate ?? todayDateStr);
  const [startNow, setStartNow] = useState<boolean>(!initialDate || initialDate === todayDateStr);
  const [datePicker, setDatePicker] = useState(false);
  const [dpYear, setDpYear] = useState(initialDate ? parseInt(initialDate.slice(0,4)) : new Date().getFullYear());
  const [dpMonth, setDpMonth] = useState(initialDate ? parseInt(initialDate.slice(5,7)) : new Date().getMonth()+1);
  const [dpDay, setDpDay] = useState(initialDate ? parseInt(initialDate.slice(8,10)) : new Date().getDate());

  const [timeHour, setTimeHour] = useState(5);
  const [timeMinute, setTimeMinute] = useState(0);
  const [timeAmPm, setTimeAmPm] = useState<'AM' | 'PM'>('PM');
  const [timePicker, setTimePicker] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [friends, setFriends] = useState<SearchedUser[]>([]);

  type LocationSuggestion = { name: string; lat: number; lng: number };
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const orderedSports = useMemo(() => {
    if (preferredSports.length === 0) return SPORTS;
    const prefSet = new Set(preferredSports);
    const preferred = SPORTS.filter((s) => prefSet.has(s));
    const rest = SPORTS.filter((s) => !prefSet.has(s));
    return [...preferred, ...rest] as readonly string[];
  }, [preferredSports]);

  useEffect(() => { if (initialSport) setSport(initialSport); }, [initialSport]);
  useEffect(() => { if (initialMatchType) setMatchType(initialMatchType as 'casual' | 'ranked' | 'practice'); }, [initialMatchType]);
  useEffect(() => {
    if (initialLocation) {
      setLocation(initialLocation.name);
      setLocationLat(initialLocation.latitude);
      setLocationLng(initialLocation.longitude);
    }
  }, [initialLocation?.latitude, initialLocation?.longitude]);
  const supports2v2 = SPORTS_2V2.includes(sport);
  useEffect(() => {
    if (!supports2v2) {
      setMatchFormat('1v1');
      setTeammate(null);
      setOpponent2(null);
    }
  }, [supports2v2]);

  useEffect(() => {
    if (initialDate) {
      setScheduleDate(initialDate);
      setDpYear(parseInt(initialDate.slice(0,4)));
      setDpMonth(parseInt(initialDate.slice(5,7)));
      setDpDay(parseInt(initialDate.slice(8,10)));
      const today = new Date();
      const todayId = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      if (initialDate !== todayId) setStartNow(false);
    }
  }, [initialDate]);

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
        .eq('status', 'accepted')
        .limit(4);
      if (fRows && fRows.length > 0) {
        const ids = fRows.map((r: any) => r.followed_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, full_name, avatar_url')
          .in('user_id', ids);
        if (profiles) {
          const resolved = await Promise.all(
            (profiles as SearchedUser[]).map(async (u) => ({
              ...u,
              avatar_url: await resolveAvatarUrl(u.avatar_url) ?? u.avatar_url,
            })),
          );
          setFriends(resolved);
        }
      }
    })();
  }, []);

  const formatTime = () => `${timeHour}:${timeMinute.toString().padStart(2, '0')} ${timeAmPm}`;

  const formatScheduleDate = () => {
    const d = new Date(scheduleDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };
  const daysInPickerMonth = new Date(dpYear, dpMonth, 0).getDate();

  const handleLocationChange = (text: string) => {
    setLocation(text);
    if (!text.trim()) {
      setLocationLat(null);
      setLocationLng(null);
      setLocationSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (text.trim().length < 2) return;
    searchTimerRef.current = setTimeout(async () => {
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5&addressdetails=1`,
          { headers: { 'Accept-Language': 'en', 'User-Agent': 'VersusApp/1.0' } },
        );
        const results = await resp.json();
        const suggestions: LocationSuggestion[] = results.map((r: any) => ({
          name: r.display_name.split(',').slice(0, 3).join(',').trim(),
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
        }));
        setLocationSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
      } catch {
        setLocationSuggestions([]);
        setShowSuggestions(false);
      }
    }, 400);
  };

  const selectSuggestion = (s: LocationSuggestion) => {
    setLocation(s.name);
    setLocationLat(s.lat);
    setLocationLng(s.lng);
    setLocationSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSave = async () => {
    if (matchType === 'ranked' && !opponent) {
      Alert.alert('Ranked match requires opponent', 'Please invite at least one opponent to create a ranked match.');
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
        const d = new Date(scheduleDate + 'T00:00:00');
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
          location_lat: locationLat,
          location_lng: locationLng,
          notes: notes.trim() || null,
          is_public: isPublic,
          match_format: matchType === 'practice' ? '1v1' : matchFormat,
          invited_opponent_id: matchType === 'practice' ? (practicePartner1?.user_id ?? null) : (opponent?.user_id ?? null),
          invited_teammate_id: matchType === 'practice' ? (practicePartner2?.user_id ?? null) : (matchFormat === '2v2' ? (teammate?.user_id ?? null) : null),
          invited_opponent_2_id: matchType === 'practice' ? (practicePartner3?.user_id ?? null) : (matchFormat === '2v2' ? (opponent2?.user_id ?? null) : null),
        })
        .select('id')
        .single();
      if (err) throw err;

      const participants: { match_id: string; user_id: string; role: 'challenger' | 'opponent'; ready?: boolean }[] = [
        { match_id: match.id, user_id: user.id, role: 'challenger', ...(matchType === 'ranked' ? { ready: true } : {}) },
      ];
      const notifBody = startNow
        ? `${sportLabel(sport)} ${matchType} match starting now!`
        : `${sportLabel(sport)} ${matchType} match on ${formatScheduleDate()} at ${formatTime()}`;
      const matchTypeLabel = matchType.charAt(0).toUpperCase() + matchType.slice(1);
      if (matchType === 'practice') {
        const practiceTitle = `${currentUsername ?? 'Someone'} invited you to practice ${sportLabel(sport)}!`;
        for (const partner of [practicePartner1, practicePartner2, practicePartner3]) {
          if (partner) {
            await supabase.from('notifications').insert({
              user_id: partner.user_id,
              type: 'match_invite',
              title: practiceTitle,
              body: notifBody,
              data: { match_id: match.id, from_user_id: user.id, slot: 'opponent' },
            });
          }
        }
      } else if (opponent) {
        const formatTag = matchFormat === '2v2' ? ' 2v2' : '';
        await supabase.from('notifications').insert({
          user_id: opponent.user_id,
          type: 'match_invite',
          title: `${currentUsername ?? 'Someone'} challenged you to a ${matchTypeLabel}${formatTag} match!`,
          body: notifBody,
          data: { match_id: match.id, from_user_id: user.id, slot: 'opponent' },
        });
        if (matchFormat === '2v2') {
          if (teammate) {
            await supabase.from('notifications').insert({
              user_id: teammate.user_id,
              type: 'match_invite',
              title: `${currentUsername ?? 'Someone'} invited you as their teammate in a ${matchTypeLabel} 2v2 match!`,
              body: notifBody,
              data: { match_id: match.id, from_user_id: user.id, slot: 'teammate' },
            });
          }
          if (opponent2) {
            await supabase.from('notifications').insert({
              user_id: opponent2.user_id,
              type: 'match_invite',
              title: `${currentUsername ?? 'Someone'} challenged you to a ${matchTypeLabel} 2v2 match!`,
              body: notifBody,
              data: { match_id: match.id, from_user_id: user.id, slot: 'opponent_2' },
            });
          }
        }
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
    setPracticePartner1(null);
    setPracticePartner2(null);
    setPracticePartner3(null);
    setLocation('');
    setLocationLat(null);
    setLocationLng(null);
    setLocationSuggestions([]);
    setShowSuggestions(false);
    setNotes('');
    setMatchType((initialMatchType ?? 'casual') as 'casual' | 'ranked' | 'practice');
    setIsPublic(true);
    setMatchFormat('1v1');
    setSport(initialSport ?? SPORTS[0]);
    setScheduleDate(initialDate ?? todayDateStr);
    setStartNow(!initialDate || initialDate === todayDateStr);
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
              <Text style={styles.title}>New Match</Text>
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
              {matchType === 'practice' ? (
                <>
                  <Text style={styles.label}>Invite practice partners (optional, up to 3)</Text>
                  {(() => {
                    const renderPartnerSlot = (
                      partner: SearchedUser | null,
                      setPartner: (u: SearchedUser | null) => void,
                      label: string,
                      excludeIds: (string | undefined)[],
                    ) => (
                      <View key={label} style={{ marginBottom: spacing.sm }}>
                        <Text style={[styles.label, { marginBottom: spacing.xs }]}>{label}</Text>
                        {partner ? (
                          <View style={styles.selectedOpp}>
                            {partner.avatar_url ? (
                              <Image source={{ uri: partner.avatar_url }} style={styles.oppAvatarImg} />
                            ) : (
                              <View style={styles.oppAvatar}><Text style={styles.oppInitials}>{getInitials(partner)}</Text></View>
                            )}
                            <Text style={styles.oppName}>{partner.full_name ?? partner.username}{partner.username ? ` (@${partner.username})` : ''}</Text>
                            <TouchableOpacity style={styles.oppRemove} onPress={() => setPartner(null)} hitSlop={8}>
                              <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <UserSearch
                            colors={colors}
                            excludeUserId={currentUserId ?? undefined}
                            onSelect={setPartner}
                            placeholder="Search by username or name..."
                            suggestions={friends.filter((f) => !excludeIds.includes(f.user_id))}
                            suggestionsTitle={friends.length > 0 ? 'Friends' : undefined}
                          />
                        )}
                      </View>
                    );
                    return (
                      <>
                        {renderPartnerSlot(practicePartner1, setPracticePartner1, 'Player 1', [practicePartner2?.user_id, practicePartner3?.user_id])}
                        {practicePartner1 && renderPartnerSlot(practicePartner2, setPracticePartner2, 'Player 2', [practicePartner1.user_id, practicePartner3?.user_id])}
                        {practicePartner2 && renderPartnerSlot(practicePartner3, setPracticePartner3, 'Player 3', [practicePartner1?.user_id, practicePartner2.user_id])}
                      </>
                    );
                  })()}
                </>
              ) : (
                <>
                  {matchFormat === '2v2' ? (
                    <>
                      <Text style={styles.label}>Teammate (optional for casual, required for ranked)</Text>
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
                        <UserSearch
                          colors={colors}
                          excludeUserId={currentUserId ?? undefined}
                          excludeUserIds={[opponent?.user_id, opponent2?.user_id].filter((id): id is string => !!id)}
                          onSelect={setTeammate}
                          placeholder="Search by username or name..."
                          suggestions={friends.filter((f) => f.user_id !== opponent?.user_id && f.user_id !== opponent2?.user_id)}
                          suggestionsTitle={friends.length > 0 ? 'Friends' : undefined}
                        />
                      )}
                      <Text style={[styles.label, { marginTop: spacing.sm }]}>Opponent 1 (optional for casual, required for ranked)</Text>
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
                        <UserSearch
                          colors={colors}
                          excludeUserId={currentUserId ?? undefined}
                          excludeUserIds={[teammate?.user_id, opponent2?.user_id].filter((id): id is string => !!id)}
                          onSelect={setOpponent}
                          placeholder="Search by username or name..."
                          suggestions={friends.filter((f) => f.user_id !== teammate?.user_id && f.user_id !== opponent2?.user_id)}
                          suggestionsTitle={friends.length > 0 ? 'Friends' : undefined}
                        />
                      )}
                      {opponent && (
                        <>
                          <Text style={[styles.label, { marginTop: spacing.sm }]}>Opponent 2</Text>
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
                            <UserSearch
                              colors={colors}
                              excludeUserId={currentUserId ?? undefined}
                              excludeUserIds={[teammate?.user_id, opponent?.user_id].filter((id): id is string => !!id)}
                              onSelect={setOpponent2}
                              placeholder="Search by username or name..."
                              suggestions={friends.filter((f) => f.user_id !== teammate?.user_id && f.user_id !== opponent?.user_id)}
                              suggestionsTitle={friends.length > 0 ? 'Friends' : undefined}
                            />
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <Text style={styles.label}>Invite opponent (optional for casual, required for ranked)</Text>
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
                </>
              )}

              <Text style={[styles.label, { marginTop: spacing.md }]}>Match type</Text>
              <View style={styles.matchTypeRow}>
                {(['casual', 'ranked', 'practice'] as const).map((t) => (
                  <TouchableOpacity key={t} style={[styles.matchTypeChip, matchType === t && styles.matchTypeChipSel]} onPress={() => setMatchType(t)} activeOpacity={0.8}>
                    <Text style={[styles.matchTypeLbl, matchType === t && styles.matchTypeLblSel]}>{t === 'casual' ? 'Casual' : t === 'ranked' ? 'Ranked' : 'Practice'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {matchType === 'practice' && (
                <Text style={[styles.label, { marginBottom: spacing.md, fontStyle: 'italic' }]}>
                  Practice: track how long you train. No score or opponent required.
                </Text>
              )}

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

              <Text style={styles.label}>Sport</Text>
              <View style={styles.sportsRow}>
                {orderedSports.map((s) => (
                  <TouchableOpacity key={s} style={[styles.sportChip, s === sport && styles.sportChipSel]} onPress={() => setSport(s)} activeOpacity={0.8}>
                    <Text style={[styles.sportChipLbl, s === sport && styles.sportChipLblSel]}>{sportLabel(s)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {supports2v2 && matchType !== 'practice' && (
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

              <Text style={styles.label}>When</Text>
              <View style={styles.matchTypeRow}>
                <TouchableOpacity
                  style={[styles.matchTypeChip, startNow && styles.matchTypeChipSel]}
                  onPress={() => setStartNow(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="flash" size={16} color={startNow ? colors.textOnPrimary : colors.textSecondary} />
                  <Text style={[styles.matchTypeLbl, startNow && styles.matchTypeLblSel]}>Start now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.matchTypeChip, !startNow && styles.matchTypeChipSel]}
                  onPress={() => setStartNow(false)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={16} color={!startNow ? colors.textOnPrimary : colors.textSecondary} />
                  <Text style={[styles.matchTypeLbl, !startNow && styles.matchTypeLblSel]}>Schedule</Text>
                </TouchableOpacity>
              </View>

              {!startNow && (
                <>
                  <Text style={styles.label}>Date</Text>
                  <View style={styles.timeRow}>
                    <TouchableOpacity style={styles.timeBtn} onPress={() => setDatePicker(true)} activeOpacity={0.8}>
                      <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                      <Text style={styles.timeText}>{formatScheduleDate()}</Text>
                    </TouchableOpacity>
                  </View>
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
              <TextInput
                style={[styles.input, { marginBottom: showSuggestions ? 0 : spacing.md }]}
                placeholder="Search for a place..."
                placeholderTextColor={colors.textSecondary}
                value={location}
                onChangeText={handleLocationChange}
                onBlur={() => { setTimeout(() => setShowSuggestions(false), 150); }}
                onFocus={() => { if (locationSuggestions.length > 0) setShowSuggestions(true); }}
              />
              {showSuggestions && locationSuggestions.length > 0 && (
                <View style={styles.suggestionsList}>
                  {locationSuggestions.map((s, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.suggestionItem, i < locationSuggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                      onPress={() => selectSuggestion(s)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                      <Text style={styles.suggestionText} numberOfLines={2}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
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
              <TextInput style={[styles.input, styles.notesInput]} placeholder="Format, rules, anything else..." placeholderTextColor={colors.textSecondary} value={notes} onChangeText={setNotes} multiline />

              <View style={styles.summaryRow}>
                <Ionicons name={startNow ? 'flash' : 'calendar-outline'} size={18} color={colors.textSecondary} />
                <Text style={styles.summaryText}>
                  {startNow
                    ? 'Match starts immediately.'
                    : `Scheduled for ${formatScheduleDate()} at ${formatTime()}.`}
                  {matchFormat === '2v2' && (teammate || opponent || opponent2)
                    ? ` ${[teammate, opponent, opponent2].filter(Boolean).map((u) => u!.username ?? u!.full_name).join(', ')} will be notified.`
                    : opponent ? ` ${opponent.full_name ?? opponent.username} will be notified.` : ''}
                </Text>
              </View>

              <TouchableOpacity style={[styles.cta, saving && styles.ctaDisabled]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.ctaText}>{startNow ? 'Start match' : (opponent || teammate || opponent2) ? 'Send invite' : 'Create match'}</Text>}
              </TouchableOpacity>
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

        {/* Date picker sub-modal */}
        <Modal visible={datePicker} transparent animationType="fade">
          <View style={styles.tpOverlay}>
            <View style={styles.tpCard}>
              <View style={styles.tpHeader}>
                <Text style={styles.tpTitle}>Pick a date</Text>
                <TouchableOpacity onPress={() => setDatePicker(false)} hitSlop={12}><Ionicons name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
              </View>
              <View style={styles.tpRow}>
                <View style={styles.tpCol}>
                  <TouchableOpacity style={styles.tpArrow} onPress={() => setDpMonth((m) => m >= 12 ? 1 : m + 1)}><Ionicons name="chevron-up" size={28} color={colors.text} /></TouchableOpacity>
                  <Text style={[styles.tpValue, { fontSize: 22, minWidth: 100 }]}>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dpMonth - 1]}</Text>
                  <TouchableOpacity style={styles.tpArrow} onPress={() => setDpMonth((m) => m <= 1 ? 12 : m - 1)}><Ionicons name="chevron-down" size={28} color={colors.text} /></TouchableOpacity>
                  <Text style={styles.tpSmall}>Month</Text>
                </View>
                <View style={styles.tpCol}>
                  <TouchableOpacity style={styles.tpArrow} onPress={() => setDpDay((d) => d >= daysInPickerMonth ? 1 : d + 1)}><Ionicons name="chevron-up" size={28} color={colors.text} /></TouchableOpacity>
                  <Text style={styles.tpValue}>{dpDay}</Text>
                  <TouchableOpacity style={styles.tpArrow} onPress={() => setDpDay((d) => d <= 1 ? daysInPickerMonth : d - 1)}><Ionicons name="chevron-down" size={28} color={colors.text} /></TouchableOpacity>
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
                setScheduleDate(`${dpYear}-${pad(dpMonth)}-${pad(dpDay)}`);
                setDatePicker(false);
              }} activeOpacity={0.9}>
                <Text style={styles.tpDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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
