import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { supabase, resolveAvatarUrl } from '../lib/supabase';
import { SPORTS, SPORTS_2V2, SPORTS_2V2_ONLY, SPORTS_3V3, SPORTS_NO_RANKED, sportLabel, SPORT_EMOJI } from '../constants/sports';
import { useLanguage } from '../i18n/LanguageContext';
import UserSearch from './UserSearch';
import type { SearchedUser } from './UserSearch';
import LocationPickerModal from './LocationPickerModal';
import type { PickedLocation } from './LocationPickerModal';


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
    wrapper: { flex: 1, backgroundColor: c.surface },
    card: {
      flex: 1,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: spacing.sm,
      paddingBottom: spacing.lg,
    },
    title: { ...typography.title, color: c.text, textAlign: 'center' },
    scrollContent: { paddingBottom: spacing.xl },
    label: { ...typography.label, color: c.textSecondary, marginBottom: spacing.sm },
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
      paddingVertical: spacing.sm,
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
    sportCard: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: borderRadius.md,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.background,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 3,
    },
    sportCardSel: { backgroundColor: c.primary, borderColor: c.primaryDark },
    sportEmoji: { fontSize: 22 },
    sportCardName: { ...typography.caption, fontSize: 11, color: c.textSecondary, fontWeight: '600' as const },
    sportCardNameSel: { color: c.textOnPrimary },
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
      marginTop: spacing.md,
      backgroundColor: c.primary,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      alignItems: 'center',
    },
    ctaDisabled: { opacity: 0.5 },
    ctaText: { ...typography.label, fontSize: 15, fontWeight: '600', color: c.textOnPrimary },
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
    inviteChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.background },
    inviteChipName: { ...typography.caption, color: c.text },
    sportDropdownBtn: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: c.background,
      marginBottom: spacing.xs,
    },
    sportDropdownValue: { ...typography.label, color: c.text, fontSize: 15, fontWeight: '700' as const },
    dropdownSportRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    dropdownSportRowSelected: { backgroundColor: c.primary + '18' },
    dropdownSportName: { ...typography.body, fontSize: 14, color: c.text, flex: 1 },
    dropdownSportNameSelected: { color: c.primary, fontWeight: '700' as const },
  });
}

export default function NewMatchModal({ visible, onClose, onCreated, colors, initialSport, initialMatchType, initialDate, initialLocation, preferredSports = [] }: Props) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [invitedUsers, setInvitedUsers] = useState<SearchedUser[]>([]);
  const [sport, setSport] = useState(initialSport ?? SPORTS[0]);
  const [matchType, setMatchType] = useState<'casual' | 'ranked' | 'practice'>(initialMatchType ?? 'casual');
  const [matchFormat, setMatchFormat] = useState<'1v1' | '2v2' | '3v3'>('1v1');
  const maxInvites = matchType === 'practice' ? 3 : matchFormat === '3v3' ? 5 : matchFormat === '2v2' ? 3 : 1;
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
  const [locationIsPublic, setLocationIsPublic] = useState(false);
  const [friends, setFriends] = useState<SearchedUser[]>([]);
  const [friendUserIds, setFriendUserIds] = useState<string[]>([]);

  type LocationSuggestion = { name: string; lat: number; lng: number };
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear pending location search timer on unmount
  useEffect(() => {
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, []);

  const [sportDropdownOpen, setSportDropdownOpen] = useState(false);

  const orderedSports = useMemo(() => {
    if (preferredSports.length === 0) return SPORTS;
    const prefSet = new Set(preferredSports);
    const rest = SPORTS.filter((s) => !prefSet.has(s));
    return [...preferredSports, ...rest] as readonly string[];
  }, [preferredSports]);

  useEffect(() => { if (initialSport) setSport(initialSport); }, [initialSport]);

  // Restore last chosen sport when opening (only if no explicit initialSport)
  useEffect(() => {
    if (!visible || initialSport) return;
    AsyncStorage.getItem('lastChosenSport').then((saved) => {
      if (saved && SPORTS.includes(saved as any)) setSport(saved);
    });
  }, [visible]);
  useEffect(() => { if (initialMatchType) setMatchType(initialMatchType as 'casual' | 'ranked' | 'practice'); }, [initialMatchType]);
  useEffect(() => { if (SPORTS_NO_RANKED.includes(sport) && matchType === 'ranked') setMatchType('casual'); }, [sport, matchType]);
  // Ranked is 1v1 only — auto-revert when format changes to 2v2/3v3
  useEffect(() => { if ((matchFormat === '2v2' || matchFormat === '3v3') && matchType === 'ranked') setMatchType('casual'); }, [matchFormat]);
  useEffect(() => {
    if (initialLocation) {
      setLocation(initialLocation.name);
      setLocationLat(initialLocation.latitude);
      setLocationLng(initialLocation.longitude);
    }
  }, [initialLocation?.latitude, initialLocation?.longitude]);
  const supports2v2 = SPORTS_2V2.includes(sport);
  const only2v2 = SPORTS_2V2_ONLY.includes(sport);
  const supports3v3 = SPORTS_3V3.includes(sport);
  useEffect(() => {
    if (supports3v3) setMatchFormat('2v2'); // volleyball defaults to 2v2
    else if (only2v2) setMatchFormat('2v2');
  }, [only2v2, supports3v3]);

  useEffect(() => {
    setInvitedUsers([]);
    if (matchType === 'practice') setMatchFormat('1v1');
  }, [matchType]);

  useEffect(() => {
    if (matchFormat === '1v1') setInvitedUsers(prev => prev.slice(0, 1));
  }, [matchFormat]);

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
      const { data: p } = await supabase.from('profiles').select('username, location_visibility').eq('user_id', user.id).maybeSingle();
      if (p?.username) setCurrentUsername(p.username);
      setLocationIsPublic((p as any)?.location_visibility === 'public');

      // Fetch both follow directions in parallel
      const [{ data: outRows }, { data: inRows }] = await Promise.all([
        supabase.from('follows').select('followed_id').eq('follower_id', user.id).eq('status', 'accepted'),
        supabase.from('follows').select('follower_id').eq('followed_id', user.id).eq('status', 'accepted'),
      ]);

      const followingIds = (outRows ?? []).map((r: any) => r.followed_id as string);
      const followerIds = (inRows ?? []).map((r: any) => r.follower_id as string);
      const allFriendIds = Array.from(new Set([...followingIds, ...followerIds].filter(Boolean)));
      setFriendUserIds(allFriendIds);

      // Build suggestions: sort by most recently invited, then alphabetically
      if (allFriendIds.length > 0) {
        const [{ data: profiles }, { data: recentMatches }] = await Promise.all([
          supabase.from('profiles').select('user_id, username, full_name, avatar_url').in('user_id', allFriendIds),
          supabase.from('matches')
            .select('invited_opponent_id, invited_teammate_id, invited_opponent_2_id, invited_teammate_2_id, invited_opponent_3_id, created_at')
            .eq('created_by', user.id)
            .order('created_at', { ascending: false })
            .limit(50),
        ]);

        // Build map of userId -> most recent invite timestamp
        const lastInvited = new Map<string, string>();
        for (const m of (recentMatches ?? []) as any[]) {
          const slots = [m.invited_opponent_id, m.invited_teammate_id, m.invited_opponent_2_id, m.invited_teammate_2_id, m.invited_opponent_3_id];
          for (const id of slots) {
            if (id && !lastInvited.has(id)) lastInvited.set(id, m.created_at);
          }
        }

        if (profiles) {
          const resolved = await Promise.all(
            (profiles as SearchedUser[]).map(async (u) => ({
              ...u,
              avatar_url: (await resolveAvatarUrl(u.avatar_url)) ?? u.avatar_url,
            })),
          );
          resolved.sort((a, b) => {
            const aDate = lastInvited.get(a.user_id);
            const bDate = lastInvited.get(b.user_id);
            if (aDate && bDate) return aDate > bDate ? -1 : 1; // most recent first
            if (aDate) return -1; // a was invited, b was not
            if (bDate) return 1;  // b was invited, a was not
            // neither invited — alphabetical by display name
            const aName = (a.full_name ?? a.username ?? '').toLowerCase();
            const bName = (b.full_name ?? b.username ?? '').toLowerCase();
            return aName.localeCompare(bName);
          });
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
    if (saving) return;
    if (matchType === 'ranked' && invitedUsers.length === 0) {
      Alert.alert(t.newMatch.rankedRequiresOpponent, t.newMatch.rankedRequiresOpponentMsg);
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
          invited_opponent_id: invitedUsers[0]?.user_id ?? null,
          invited_teammate_id: invitedUsers[1]?.user_id ?? null,
          invited_opponent_2_id: invitedUsers[2]?.user_id ?? null,
          invited_teammate_2_id: invitedUsers[3]?.user_id ?? null,
          invited_opponent_3_id: invitedUsers[4]?.user_id ?? null,
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
      const slots = ['opponent', 'teammate', 'opponent_2', 'teammate_2', 'opponent_3'] as const;
      const formatTag = matchFormat === '3v3' ? ' 3v3' : matchFormat === '2v2' ? ' 2v2' : '';
      const inviteTitle = matchType === 'practice'
        ? `${currentUsername ?? 'Someone'} invited you to practice ${sportLabel(sport)}!`
        : `${currentUsername ?? 'Someone'} invited you to a ${matchTypeLabel}${formatTag} match!`;
      await Promise.all([
        ...invitedUsers.map((u, i) => supabase.from('notifications').insert({
          user_id: u.user_id,
          type: 'match_invite',
          title: inviteTitle,
          body: notifBody,
          data: { match_id: match.id, from_user_id: user.id, slot: slots[i] },
        })),
        supabase.from('match_participants').insert(participants),
      ]);

      reset();
      onClose();
      onCreated?.();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save match.');
    } finally { setSaving(false); }
  };

  const reset = () => {
    setInvitedUsers([]);
    setLocation('');
    setLocationLat(null);
    setLocationLng(null);
    setLocationSuggestions([]);
    setShowSuggestions(false);
    setNotes('');
    setMatchType((initialMatchType ?? 'casual') as 'casual' | 'ranked' | 'practice');
    setIsPublic(true);
    setMatchFormat('1v1');
    if (!initialSport) {
      AsyncStorage.getItem('lastChosenSport').then((saved) => {
        setSport(saved && SPORTS.includes(saved as any) ? saved : SPORTS[0]);
      });
    } else {
      setSport(initialSport);
    }
    setScheduleDate(initialDate ?? todayDateStr);
    setStartNow(!initialDate || initialDate === todayDateStr);
  };

  const getInitials = (u: SearchedUser) =>
    (u.full_name ?? u.username ?? '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Modal visible={visible} transparent={false} animationType="slide">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.wrapper, { paddingTop: insets.top }]}>
          <View style={styles.card}>
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.title}>{t.newMatch.title}</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={true}
            >
              <Text style={styles.label}>{t.newMatch.sport}</Text>
              <TouchableOpacity style={styles.sportDropdownBtn} onPress={() => setSportDropdownOpen(true)} activeOpacity={0.85}>
                <Text style={styles.sportDropdownValue}>{sportLabel(sport)}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              <Modal visible={sportDropdownOpen} transparent animationType="fade">
                <View style={styles.tpOverlay}>
                  <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setSportDropdownOpen(false)} />
                  <View style={[styles.tpCard, { padding: 0, maxHeight: 420 }]}>
                    <View style={[styles.tpHeader, { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm }]}>
                      <Text style={styles.tpTitle}>Select Sport</Text>
                      <TouchableOpacity onPress={() => setSportDropdownOpen(false)} hitSlop={12}>
                        <Ionicons name="close" size={22} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    <FlatList
                      data={orderedSports as string[]}
                      keyExtractor={(item) => item}
                      renderItem={({ item: s }) => {
                        const isSelected = s === sport;
                        return (
                          <TouchableOpacity
                            style={[styles.dropdownSportRow, isSelected && styles.dropdownSportRowSelected]}
                            onPress={() => { setSport(s); setSportDropdownOpen(false); AsyncStorage.setItem('lastChosenSport', s); }}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.dropdownSportName, isSelected && styles.dropdownSportNameSelected]}>{sportLabel(s)}</Text>
                            {isSelected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                          </TouchableOpacity>
                        );
                      }}
                      showsVerticalScrollIndicator={false}
                    />
                  </View>
                </View>
              </Modal>

              <Text style={[styles.label, { marginTop: spacing.md }]}>{t.newMatch.matchType}</Text>
              <View style={styles.matchTypeRow}>
                {(['casual', 'ranked', 'practice'] as const).map((mt) => {
                  const icon = mt === 'casual' ? 'people-outline' : mt === 'ranked' ? 'trophy-outline' : 'barbell-outline';
                  const sel = matchType === mt;
                  const rankedDisabledBySport = mt === 'ranked' && SPORTS_NO_RANKED.includes(sport);
                  const rankedDisabledByFormat = mt === 'ranked' && (matchFormat === '2v2' || matchFormat === '3v3');
                  const rankedDisabled = rankedDisabledBySport || rankedDisabledByFormat;
                  return (
                    <TouchableOpacity
                      key={mt}
                      style={[styles.matchTypeChip, sel && styles.matchTypeChipSel, rankedDisabled && { opacity: 0.45 }]}
                      onPress={() => {
                        if (rankedDisabled) {
                          if (rankedDisabledByFormat) {
                            Alert.alert('1v1 Only', 'Ranked matches are only available in 1v1 format.');
                          }
                          return;
                        }
                        if (mt === 'ranked' && !locationIsPublic) {
                          Alert.alert(
                            'Location Required',
                            'You must set your location to Public in Settings to create a ranked match.',
                            [{ text: 'OK' }],
                          );
                          return;
                        }
                        setMatchType(mt);
                      }}
                      activeOpacity={rankedDisabled ? 1 : 0.8}
                    >
                      <Ionicons name={icon as any} size={14} color={sel ? colors.textOnPrimary : colors.textSecondary} />
                      <Text style={[styles.matchTypeLbl, sel && styles.matchTypeLblSel]}>
                        {mt === 'casual' ? t.matchType.casual : mt === 'ranked' ? (rankedDisabled ? t.matchType.rankedSoon : t.matchType.ranked) : t.matchType.practice}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View key={`${matchType}-${matchFormat}`}>
                <Text style={[styles.label, { marginTop: spacing.sm }]}>
                  {matchType === 'practice'
                    ? 'Invite practice partners (optional, up to 3)'
                    : matchFormat === '3v3'
                      ? 'Invite players (up to 5) — teams chosen when they accept'
                      : matchFormat === '2v2'
                        ? 'Invite players (up to 3) — teams chosen when they accept'
                        : 'Invite opponent (optional)'}
                </Text>

                {invitedUsers.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    {invitedUsers.map(u => (
                      <View key={u.user_id} style={styles.inviteChip}>
                        {u.avatar_url ? (
                          <Image source={{ uri: u.avatar_url }} style={{ width: 20, height: 20, borderRadius: 10 }} />
                        ) : (
                          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textOnPrimary }}>{getInitials(u)}</Text>
                          </View>
                        )}
                        <Text style={styles.inviteChipName}>{u.full_name ?? u.username}</Text>
                        <TouchableOpacity onPress={() => setInvitedUsers(p => p.filter(x => x.user_id !== u.user_id))}>
                          <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {invitedUsers.length < maxInvites && (
                  <UserSearch
                    colors={colors}
                    excludeUserId={currentUserId ?? undefined}
                    excludeUserIds={invitedUsers.map(u => u.user_id)}
                    priorityUserIds={friendUserIds.length > 0 ? friendUserIds : undefined}
                    onSelect={u => setInvitedUsers(prev => [...prev, u])}
                    placeholder="Search by username or name..."
                    suggestions={friends.filter(f => !invitedUsers.some(u => u.user_id === f.user_id))}
                    suggestionsTitle={friends.length > 0 ? 'Friends' : undefined}
                  />
                )}
              </View>
              {/* {matchType === 'practice' && (
                <Text style={[styles.label, { marginBottom: spacing.md, fontStyle: 'italic' }]}>
                  Practice: track how long you train. No score or opponent required.
                </Text>
              )} */}

              <Text style={[styles.label, { marginTop: spacing.md }]}>{t.newMatch.visibility}</Text>
              <View style={styles.matchTypeRow}>
                <TouchableOpacity style={[styles.matchTypeChip, isPublic && styles.matchTypeChipSel]} onPress={() => setIsPublic(true)} activeOpacity={0.8}>
                  <Ionicons name="globe-outline" size={14} color={isPublic ? colors.textOnPrimary : colors.textSecondary} />
                  <Text style={[styles.matchTypeLbl, isPublic && styles.matchTypeLblSel]}>{t.common.public}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.matchTypeChip, !isPublic && styles.matchTypeChipSel]} onPress={() => setIsPublic(false)} activeOpacity={0.8}>
                  <Ionicons name="lock-closed-outline" size={14} color={!isPublic ? colors.textOnPrimary : colors.textSecondary} />
                  <Text style={[styles.matchTypeLbl, !isPublic && styles.matchTypeLblSel]}>{t.common.private}</Text>
                </TouchableOpacity>
              </View>

              {matchType !== 'practice' && !only2v2 && (
                <>
                  <Text style={styles.label}>{t.newMatch.format}</Text>
                  <View style={styles.matchTypeRow}>
                    {(supports3v3 ? ['2v2', '3v3'] : ['1v1', '2v2']).map((f) => (
                      <TouchableOpacity key={f} style={[styles.matchTypeChip, matchFormat === f && styles.matchTypeChipSel]} onPress={() => setMatchFormat(f as '1v1' | '2v2' | '3v3')} activeOpacity={0.8}>
                        <Text style={[styles.matchTypeLbl, matchFormat === f && styles.matchTypeLblSel]}>{f}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.label}>{t.newMatch.when}</Text>
              <View style={styles.matchTypeRow}>
                <TouchableOpacity
                  style={[styles.matchTypeChip, startNow && styles.matchTypeChipSel]}
                  onPress={() => setStartNow(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="flash" size={14} color={startNow ? colors.textOnPrimary : colors.textSecondary} />
                  <Text style={[styles.matchTypeLbl, startNow && styles.matchTypeLblSel]}>{t.newMatch.startNow}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.matchTypeChip, !startNow && styles.matchTypeChipSel]}
                  onPress={() => setStartNow(false)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={14} color={!startNow ? colors.textOnPrimary : colors.textSecondary} />
                  <Text style={[styles.matchTypeLbl, !startNow && styles.matchTypeLblSel]}>{t.newMatch.schedule}</Text>
                </TouchableOpacity>
              </View>

              {!startNow && (
                <>
                  <Text style={styles.label}>{t.newMatch.date}</Text>
                  <View style={styles.timeRow}>
                    <TouchableOpacity style={styles.timeBtn} onPress={() => setDatePicker(true)} activeOpacity={0.8}>
                      <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                      <Text style={styles.timeText}>{formatScheduleDate()}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.label}>{t.newMatch.time}</Text>
                  <View style={styles.timeRow}>
                    <TouchableOpacity style={styles.timeBtn} onPress={() => setTimePicker(true)} activeOpacity={0.8}>
                      <Ionicons name="time-outline" size={18} color={colors.primary} />
                      <Text style={styles.timeText}>{formatTime()}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <Text style={styles.label}>{t.newMatch.location}</Text>
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

              <Text style={styles.label}>{t.newMatch.notes}</Text>
              <TextInput style={[styles.input, styles.notesInput]} placeholder={t.newMatch.notesPlaceholder} placeholderTextColor={colors.textSecondary} value={notes} onChangeText={setNotes} multiline />

              <View style={styles.summaryRow}>
                <Ionicons name={startNow ? 'flash' : 'calendar-outline'} size={18} color={colors.textSecondary} />
                <Text style={styles.summaryText}>
                  {startNow
                    ? 'Match starts immediately.'
                    : `Scheduled for ${formatScheduleDate()} at ${formatTime()}.`}
                  {invitedUsers.length > 0
                    ? ` ${invitedUsers.map(u => u.username ?? u.full_name).join(', ')} will be notified.`
                    : ''}
                </Text>
              </View>

              <TouchableOpacity style={[styles.cta, saving && styles.ctaDisabled]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.ctaText}>{startNow ? 'Start Match' : invitedUsers.length > 0 ? 'Send invite' : 'Create match'}</Text>}
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
