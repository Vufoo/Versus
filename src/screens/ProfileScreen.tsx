import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
  Image,
  Share,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import { useLanguage } from '../i18n/LanguageContext';
import type { ThemeColors } from '../constants/theme';
import { supabase, resolveAvatarUrl } from '../lib/supabase';
import { normalizePhone, hashPhone } from '../lib/contacts';
import { SPORTS, sportLabel, SPORT_EMOJI } from '../constants/sports';
import GradientCard from '../components/GradientCard';

type ProfileTab = 'overview' | 'rankings';

function tierColor(tier: string | null): string {
  switch (tier) {
    case 'Beginner': return '#9E9E9E';
    case 'Bronze': return '#CD7F32';
    case 'Silver': return '#C0C0C0';
    case 'Gold': return '#FFD700';
    case 'Platinum': return '#00BCD4';
    case 'Diamond': return '#64B5F6';
    case 'Pro': return '#F44336';
    default: return '#9E9E9E';
  }
}

type MatchHistoryItem = {
  id: string;
  sport_name: string;
  match_type: string;
  status: string;
  created_at: string;
  scheduled_at: string | null;
  started_at: string | null;
  location_name: string | null;
  match_format?: string;
  is_public?: boolean;
  participants: { user_id: string; role: string; result: string; vp_delta?: number; username: string | null; full_name: string | null }[];
  games: { game_number: number; score_challenger: number; score_opponent: number }[];
};

const SCREEN_W = Dimensions.get('window').width;
const MAX_PREFERRED = 3;
const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

// Module-level cache — survives tab switches without re-fetching
type ProfileCache = {
  profile: { username: string | null; full_name: string | null; vp_total: number; preferred_sports: string[]; avatar_url: string | null; date_of_birth: string | null; gender: string | null; location: string | null; bio: string | null } | null;
  avatarUri: string | null;
  followingCount: number;
  followerCount: number;
  sportRatings: SportRating[];
  matchHistory: MatchHistoryItem[];
  phoneHashSet: boolean;
};
let _profileCache: ProfileCache | null = null;

type SportRating = {
  sport: string;
  rank_tier: string | null;
  vp: number;
  wins: number;
  losses: number;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: spacing.xxl },

    /* ---- Page header ---- */
    pageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingBottom: 9,
      backgroundColor: colors.cardBg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 0,
    },
    pageTitle: { ...typography.heading, color: colors.text },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    headerActionBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* ---- Profile header card ---- */
    headerCard: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      alignItems: 'center',
    },
    avatarWrapper: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    avatarImage: { width: 80, height: 80, borderRadius: 40 },
    avatarInitials: { ...typography.heading, fontSize: 30, color: colors.textOnPrimary },
    cameraBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.surface,
    },
    userName: { ...typography.heading, color: colors.text },
    userHandle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
    socialRow: { flexDirection: 'row', gap: spacing.xl },
    socialItem: { alignItems: 'center' },
    socialValue: { ...typography.heading, fontSize: 18, color: colors.text },
    socialLabel: { ...typography.caption, color: colors.textSecondary },
    /* ---- Tab bar ---- */
    tabRow: {
      flexDirection: 'row',
      backgroundColor: colors.cardBg,
      marginBottom: 0,
    },
    tab: { flex: 1, paddingVertical: spacing.xs + 2, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: colors.primary },
    tabText: { ...typography.label, color: colors.textSecondary },
    tabTextActive: { color: colors.primary },

    /* ---- Ranks overview grid ---- */
    ranksSection: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
      marginBottom: 0,
    },
    ranksSectionTitle: { ...typography.heading, color: colors.text, marginBottom: spacing.lg },
    ranksGrid: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    rankCard: {
      flex: 1,
      minWidth: 0,
      backgroundColor: colors.cardBg,
      borderRadius: borderRadius.md,
      paddingVertical: 6,
      paddingHorizontal: spacing.xs,
      borderWidth: 1,
      borderColor: colors.primary + '30',
      alignItems: 'center',
      gap: 1,
    },
    rankCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    rankCardEmoji: { fontSize: 12 },
    rankCardSport: { ...typography.label, fontSize: 11, color: colors.text, flexShrink: 1 },
    rankCardTier: { ...typography.caption, color: colors.primary, fontWeight: '700', fontSize: 10 },
    rankCardBottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 3,
      paddingTop: 3,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignSelf: 'stretch',
      justifyContent: 'center',
      gap: 3,
    },
    rankCardVp: { ...typography.heading, fontSize: 12, color: colors.primary },
    rankCardVpLabel: { ...typography.caption, color: colors.textSecondary, fontSize: 9 },
    rankCardStat: { alignItems: 'center', flexDirection: 'row', gap: 2 },
    rankCardStatValue: { ...typography.label, fontSize: 11, color: colors.text },
    rankCardStatLabel: { ...typography.caption, fontSize: 9, color: colors.textSecondary },
    rankCardDot: { width: 2, height: 2, borderRadius: 1, backgroundColor: colors.border },
    dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    dotActive: { backgroundColor: colors.primary },

    /* ---- Cards ---- */
    card: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
      marginBottom: 0,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    cardTitle: { ...typography.heading, color: colors.text, marginBottom: spacing.sm },
    cardSubtitle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.lg },
    placeholder: { ...typography.caption, color: colors.textSecondary },
    sportsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    sportsGridRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
    sportChip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm - 2,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    sportChipSelected: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
    sportChipLabel: { ...typography.label, color: colors.text },
    sportChipLabelSelected: { color: colors.textOnPrimary },
    savingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
    savingText: { ...typography.caption, color: colors.textSecondary },

    /* ---- Rankings ---- */
    rankPage: { width: SCREEN_W },
    rankPageInner: {
      width: SCREEN_W,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rankEmoji: { fontSize: 48, marginBottom: spacing.sm },
    rankSport: { ...typography.heading, color: colors.text, marginBottom: spacing.xs },
    rankTier: { ...typography.body, color: colors.primary, marginBottom: spacing.md },
    rankStatRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: spacing.md },
    rankStat: { flex: 1, alignItems: 'center' },
    rankStatValue: { ...typography.heading, fontSize: 20, color: colors.text },
    rankStatLabel: { ...typography.caption, color: colors.textSecondary },
    rankHint: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
    rankDotsRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.md, marginBottom: spacing.md },

    /* ---- Settings modal ---- */
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl,
      maxHeight: '85%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    modalTitle: { ...typography.heading, color: colors.text },
    settingSection: { marginBottom: spacing.lg },
    settingSectionTitle: {
      ...typography.label,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    settingRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
    settingLabel: { ...typography.body, color: colors.text },
    settingValue: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    themeChips: { flexDirection: 'row', gap: spacing.sm },
    themeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    themeChipSelected: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
    themeChipText: { ...typography.caption, color: colors.textSecondary },
    themeChipTextSelected: { color: colors.textOnPrimary },
    signOutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.error,
      marginTop: spacing.md,
    },
    signOutText: { ...typography.body, fontWeight: '600', color: colors.error },
    sectionHeader: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.xs,
    },
    sectionSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    matchHistoryList: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 0,
    },
    matchHistoryHeader: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    matchHistoryItem: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    matchHistoryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    matchHistoryEmoji: { fontSize: 20 },
    matchHistoryLeft: { flex: 1, minWidth: 0 },
    matchHistorySport: { ...typography.label, fontSize: 13, color: colors.text },
    matchHistoryMeta: { ...typography.caption, fontSize: 11, color: colors.textSecondary, marginTop: 1 },
    matchHistoryRight: { alignItems: 'flex-end' },
    matchHistoryResult: { ...typography.label, fontSize: 13, fontWeight: '700' },
    matchHistoryVp: { ...typography.caption, fontSize: 10, color: colors.textSecondary, marginTop: 1 },

    /* ---- Edit profile ---- */
    editBtn: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    editLabel: {
      ...typography.label,
      color: colors.text,
      marginBottom: spacing.xs,
      marginTop: spacing.md,
    },
    editInput: {
      ...typography.body,
      color: colors.text,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    genderRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    genderChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm - 2,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    genderChipSelected: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
    genderChipText: { ...typography.label, color: colors.textSecondary },
    genderChipTextSelected: { color: colors.textOnPrimary },
    saveEditBtn: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.lg,
      marginBottom: spacing.md,
    },
    saveEditBtnText: { ...typography.body, fontWeight: '600', color: colors.textOnPrimary },
  });
}

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [vpIdx, setVpIdx] = useState(0);
  const [rankIdx, setRankIdx] = useState(0);

  const [profile, setProfile] = useState<{
    username: string | null;
    full_name: string | null;
    vp_total: number;
    preferred_sports: string[];
    avatar_url: string | null;
    date_of_birth: string | null;
    gender: string | null;
    location: string | null;
    bio: string | null;
  } | null>(_profileCache?.profile ?? null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [phoneHashSet, setPhoneHashSet] = useState(_profileCache?.phoneHashSet ?? false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [followingCount, setFollowingCount] = useState(_profileCache?.followingCount ?? 0);
  const [followerCount, setFollowerCount] = useState(_profileCache?.followerCount ?? 0);
  const [loadingProfile, setLoadingProfile] = useState(_profileCache === null);
  const [sportRatings, setSportRatings] = useState<SportRating[]>(_profileCache?.sportRatings ?? []);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(_profileCache?.avatarUri ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryItem[]>(_profileCache?.matchHistory ?? []);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);


  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to change your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    const asset = result.assets[0];
    setUploadingAvatar(true);

    try {
      if (!currentUserId) throw new Error('Not signed in');

      const mimeType = asset.mimeType ?? 'image/jpeg';
      const ext = mimeType.split('/')[1] ?? 'jpeg';
      const filePath = `${currentUserId}/avatar.${ext}`;

      if (!asset.base64) throw new Error('Image data unavailable');
      const binaryString = atob(asset.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, bytes, { contentType: mimeType, upsert: true });

      if (uploadErr) { if (__DEV__) console.error('Avatar upload error:', uploadErr); Alert.alert('Upload failed', uploadErr.message); return; }

      const { error: updateErr } = await supabase.from('profiles').update({ avatar_url: filePath }).eq('user_id', currentUserId);
      if (updateErr) { if (__DEV__) console.error('Avatar URL save error:', updateErr); Alert.alert('Save failed', updateErr.message); return; }

      const signedUrl = await resolveAvatarUrl(filePath);
      if (signedUrl) setAvatarUri(signedUrl);
      if (profile) setProfile({ ...profile, avatar_url: filePath });
    } catch (e: any) {
      if (__DEV__) console.error('Avatar upload error:', e);
      Alert.alert('Upload failed', e?.message ?? 'Something went wrong.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const loadProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email ?? null);
      setCurrentUserId(user.id);

      // All independent queries in parallel
      const [profileRes, fingRes, fersRes, ratingsRes, participantRes] = await Promise.all([
        supabase.from('profiles').select('username, full_name, vp_total, preferred_sports, avatar_url, date_of_birth, gender, location, bio, phone_hash').eq('user_id', user.id).maybeSingle(),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id).eq('status', 'accepted'),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', user.id).eq('status', 'accepted'),
        supabase.from('user_sport_ratings').select('vp, rank_tier, wins, losses, sports!inner(name)').eq('user_id', user.id),
        supabase.from('match_participants').select('match_id').eq('user_id', user.id),
      ]);

      const p = profileRes.data;
      setProfile({
        username: p?.username ?? null,
        full_name: p?.full_name ?? null,
        vp_total: p?.vp_total ?? 0,
        preferred_sports: p?.preferred_sports ?? [],
        avatar_url: p?.avatar_url ?? null,
        date_of_birth: p?.date_of_birth ?? null,
        gender: p?.gender ?? null,
        location: p?.location ?? null,
        bio: p?.bio ?? null,
      });
      setPhoneHashSet(!!(p as any)?.phone_hash);
      setFollowingCount(fingRes.count ?? 0);
      setFollowerCount(fersRes.count ?? 0);
      if (ratingsRes.data) {
        setSportRatings((ratingsRes.data as any[]).map((r) => ({
          sport: r.sports?.name ?? '?',
          rank_tier: r.rank_tier,
          vp: r.vp, wins: r.wins, losses: r.losses,
        })));
      }

      const matchIds = (participantRes.data ?? []).map((r: any) => r.match_id as string);

      // Resolve avatar and fetch match history in parallel — match history filtered at DB level
      const [resolvedAvatar, feedRes] = await Promise.all([
        resolveAvatarUrl(p?.avatar_url ?? null),
        matchIds.length > 0
          ? supabase.from('match_feed').select('id, sport_name, match_type, status, created_at, scheduled_at, started_at, location_name, match_format, is_public, participants, games').in('id', matchIds).order('created_at', { ascending: false }).limit(30)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const resolvedAvatarFinal = resolvedAvatar ?? null;
      const matchHistoryFinal = (feedRes.data ?? []) as MatchHistoryItem[];
      const profileFinal = {
        username: p?.username ?? null, full_name: p?.full_name ?? null, vp_total: p?.vp_total ?? 0,
        preferred_sports: p?.preferred_sports ?? [], avatar_url: p?.avatar_url ?? null,
        date_of_birth: p?.date_of_birth ?? null, gender: p?.gender ?? null,
        location: p?.location ?? null, bio: p?.bio ?? null,
      };
      const ratingsFinal: SportRating[] = ratingsRes.data
        ? (ratingsRes.data as any[]).map((r) => ({ sport: r.sports?.name ?? '?', rank_tier: r.rank_tier, vp: r.vp, wins: r.wins, losses: r.losses }))
        : [];

      _profileCache = {
        profile: profileFinal,
        avatarUri: resolvedAvatarFinal,
        followingCount: fingRes.count ?? 0,
        followerCount: fersRes.count ?? 0,
        sportRatings: ratingsFinal,
        matchHistory: matchHistoryFinal,
        phoneHashSet: !!(p as any)?.phone_hash,
      };

      if (resolvedAvatar) setAvatarUri(resolvedAvatar);
      setMatchHistory(matchHistoryFinal);
    } catch { /* swallow */ } finally { setLoadingProfile(false); }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const onRefreshProfile = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, [loadProfile]);

  useEffect(() => {
    if (!currentUserId) return;
    const refreshCounts = async () => {
      const { count: fing } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', currentUserId).eq('status', 'accepted');
      const { count: fers } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', currentUserId).eq('status', 'accepted');
      setFollowingCount(fing ?? 0);
      setFollowerCount(fers ?? 0);
    };
    const channel = supabase
      .channel(`profile-follows-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `follower_id=eq.${currentUserId}` },
        refreshCounts,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `followed_id=eq.${currentUserId}` },
        refreshCounts,
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  const initials = (profile?.full_name ?? profile?.username ?? 'U')
    .split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const perSportVp = useMemo(() => {
    const map = new Map(sportRatings.map((r) => [r.sport, r]));
    return SPORTS.map((s) => ({ sport: s, vp: map.get(s)?.vp ?? 0 }));
  }, [sportRatings]);

  const rankingsData = useMemo(() => {
    const map = new Map(sportRatings.map((r) => [r.sport, r]));
    return SPORTS.map((s) => {
      const r = map.get(s);
      return { sport: s, rank_tier: r?.rank_tier ?? null, vp: r?.vp ?? 0, wins: r?.wins ?? 0, losses: r?.losses ?? 0 };
    });
  }, [sportRatings]);

  const top3Rankings = useMemo(() => {
    const preferred = profile?.preferred_sports ?? [];
    const result: typeof rankingsData = [];

    // 1. Preferred sports in user-selected order
    for (const sp of preferred) {
      if (result.length >= 3) break;
      const r = rankingsData.find((rd) => rd.sport === sp);
      result.push(r ?? { sport: sp, rank_tier: null, vp: 0, wins: 0, losses: 0 });
    }

    // 2. Sports with activity (by VP) not already included
    if (result.length < 3) {
      const used = new Set(result.map((r) => r.sport));
      const withStats = [...rankingsData.filter((r) => (r.vp > 0 || r.rank_tier || r.wins > 0 || r.losses > 0) && !used.has(r.sport))]
        .sort((a, b) => b.vp - a.vp);
      for (const r of withStats) {
        if (result.length >= 3) break;
        result.push(r);
      }
    }

    // 3. Fill remaining with any sports in default order
    if (result.length < 3) {
      const used = new Set(result.map((r) => r.sport));
      for (const s of SPORTS) {
        if (result.length >= 3) break;
        if (!used.has(s)) {
          const r = rankingsData.find((rd) => rd.sport === s);
          result.push(r ?? { sport: s, rank_tier: null, vp: 0, wins: 0, losses: 0 });
        }
      }
    }

    return result;
  }, [rankingsData, profile?.preferred_sports]);

  const shareProfile = async () => {
    const name = profile?.full_name || profile?.username || 'a Versus player';
    const handle = profile?.username ? `@${profile.username}` : '';
    const vp = profile?.vp_total ?? 0;
    const sports = (profile?.preferred_sports ?? []).join(', ');
    const message = [
      `Check out ${name}${handle ? ` (${handle})` : ''} on Versus!`,
      vp > 0 ? `${vp} Total VP` : null,
      sports ? `Plays: ${sports}` : null,
      'https://versus.app/profile' + (profile?.username ? `/${profile.username}` : ''),
    ].filter(Boolean).join('\n');

    try {
      await Share.share({ message, title: `${name} on Versus` });
    } catch { /* user cancelled */ }
  };

  const togglePreferred = async (sport: string) => {
    if (!profile || !currentUserId) return;
    const current = [...(profile.preferred_sports ?? [])];
    const idx = current.indexOf(sport);
    if (idx >= 0) current.splice(idx, 1);
    else { if (current.length >= MAX_PREFERRED) return; current.push(sport); }

    setProfile({ ...profile, preferred_sports: current });
    setSavingPrefs(true);
    try {
      const { error: updateErr } = await supabase.from('profiles').update({ preferred_sports: current }).eq('user_id', currentUserId);
      if (updateErr) { if (__DEV__) console.error('Preferred sports save error:', updateErr); Alert.alert('Save failed', updateErr.message ?? 'Could not update.'); }
    } catch (e) { if (__DEV__) console.error('Preferred sports save error:', e); }
    finally { setSavingPrefs(false); }
  };

  const openEditModal = () => {
    setEditName(profile?.full_name ?? '');
    setEditDob(profile?.date_of_birth ?? '');
    setEditGender(profile?.gender ?? '');
    const locParts = (profile?.location ?? '').split(', ');
    setEditCity(locParts[0] ?? '');
    setEditState(locParts.slice(1).join(', '));
    setEditBio(profile?.bio ?? '');
    setEditPhone(''); // never pre-fill — one-way hash
    setShowEditModal(true);
  };

  const saveProfileEdits = async () => {
    if (!currentUserId) return;
    setSavingEdit(true);
    try {
      const updates: Record<string, any> = {
        full_name: editName.trim() || null,
        date_of_birth: editDob.trim() || null,
        gender: editGender.trim() || null,
        location: [editCity.trim(), editState.trim()].filter(Boolean).join(', ') || null,
        bio: editBio.trim() || null,
      };

      const phoneInput = editPhone.trim();
      if (phoneInput === '') {
        // blank → clear the hash
        updates.phone_hash = null;
      } else {
        const normalized = normalizePhone(phoneInput);
        if (!normalized) {
          Alert.alert('Invalid phone', 'Enter a 10-digit US number (e.g. 5551234567).');
          setSavingEdit(false);
          return;
        }
        updates.phone_hash = await hashPhone(normalized);
      }

      const { error } = await supabase.from('profiles').update(updates).eq('user_id', currentUserId);
      if (error) { Alert.alert('Save failed', error.message); return; }
      setPhoneHashSet(updates.phone_hash !== null);
      setProfile((prev) => prev ? { ...prev, ...updates } : prev);
      setShowEditModal(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong.');
    } finally {
      setSavingEdit(false);
    }
  };


  return (
    <View style={styles.container}>
      <View style={[styles.pageHeader, { paddingTop: insets.top }]}>
        {navigation.canGoBack() ? (
          <TouchableOpacity style={styles.backBtn} activeOpacity={0.8} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 34 }} />
        )}
<View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionBtn} activeOpacity={0.8} onPress={shareProfile}>
            <Ionicons name="share-outline" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionBtn} activeOpacity={0.8} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings-outline" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshProfile} tintColor={colors.text} colors={[colors.primary]} progressBackgroundColor={colors.cardBg} />}>
        {/* Profile header */}
        <GradientCard style={styles.headerCard}>
          {!loadingProfile && (
            <TouchableOpacity style={styles.editBtn} onPress={openEditModal} activeOpacity={0.8}>
              <Ionicons name="pencil" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          {loadingProfile ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <TouchableOpacity style={styles.avatarWrapper} onPress={pickAvatar} activeOpacity={0.8} disabled={uploadingAvatar}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                )}
                {uploadingAvatar ? (
                  <View style={styles.cameraBadge}>
                    <ActivityIndicator size="small" color={colors.textOnPrimary} />
                  </View>
                ) : (
                  <View style={styles.cameraBadge}>
                    <Ionicons name="camera" size={14} color={colors.textOnPrimary} />
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.userName}>{profile?.full_name || profile?.username || 'Your name'}</Text>
              <Text style={[styles.userHandle, profile?.location ? { marginBottom: 2 } : null]}>@{profile?.username || 'username'}</Text>
              {profile?.location ? (
                <Text style={styles.userHandle}>{profile.location}</Text>
              ) : null}
              {profile?.bio ? (
                <Text style={[styles.userHandle, { marginTop: 6, marginHorizontal: spacing.md, textAlign: 'center', color: colors.text }]}>{profile.bio}</Text>
              ) : null}
              <View style={styles.socialRow}>
                <View style={styles.socialItem}>
                  <Text style={styles.socialValue}>{profile?.vp_total ?? 0}</Text>
                  <Text style={styles.socialLabel}>{t.profile.totalVP}</Text>
                </View>
                <TouchableOpacity
                  style={styles.socialItem}
                  onPress={() => currentUserId && navigation.navigate('FollowList', { userId: currentUserId, initialTab: 'following' })}
                  activeOpacity={0.8}
                >
                  <Text style={styles.socialValue}>{followingCount}</Text>
                  <Text style={styles.socialLabel}>{t.profile.following}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.socialItem}
                  onPress={() => currentUserId && navigation.navigate('FollowList', { userId: currentUserId, initialTab: 'followers' })}
                  activeOpacity={0.8}
                >
                  <Text style={styles.socialValue}>{followerCount}</Text>
                  <Text style={styles.socialLabel}>{t.profile.followers}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </GradientCard>

        {/* Tab switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, tab === 'overview' && styles.tabActive]} onPress={() => setTab('overview')} activeOpacity={0.8}>
            <Text style={[styles.tabText, tab === 'overview' && styles.tabTextActive]}>{t.profile.overview}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'rankings' && styles.tabActive]} onPress={() => setTab('rankings')} activeOpacity={0.8}>
            <Text style={[styles.tabText, tab === 'rankings' && styles.tabTextActive]}>{t.profile.rankings}</Text>
          </TouchableOpacity>
        </View>

        {/* Overview */}
        {tab === 'overview' && (
          <>
            <GradientCard style={styles.ranksSection}>
              <Text style={styles.ranksSectionTitle}>{t.profile.sportRanks}</Text>
              <View style={styles.ranksGrid}>
              {top3Rankings.map((item) => (
                <View key={item.sport} style={styles.rankCard}>
                  <View style={styles.rankCardHeader}>
                    <Text style={styles.rankCardEmoji}>{SPORT_EMOJI[item.sport] ?? '🏆'}</Text>
                    <Text style={styles.rankCardSport} numberOfLines={1}>{item.sport}</Text>
                  </View>
                  <Text style={[styles.rankCardTier, { color: tierColor(item.rank_tier) }]}>
                    {item.rank_tier ?? t.common.unranked}
                  </Text>
                  <View style={styles.rankCardBottomRow}>
                    <View style={styles.rankCardStat}>
                      <Text style={styles.rankCardStatValue}>{item.wins}</Text>
                      <Text style={styles.rankCardStatLabel}>W</Text>
                    </View>
                    <View style={styles.rankCardDot} />
                    <View style={styles.rankCardStat}>
                      <Text style={styles.rankCardVp}>{item.vp}</Text>
                      <Text style={styles.rankCardVpLabel}>VP</Text>
                    </View>
                    <View style={styles.rankCardDot} />
                    <View style={styles.rankCardStat}>
                      <Text style={styles.rankCardStatValue}>{item.losses}</Text>
                      <Text style={styles.rankCardStatLabel}>L</Text>
                    </View>
                  </View>
                </View>
              ))}
              </View>
            </GradientCard>

            <GradientCard style={styles.card}>
              <Text style={styles.cardTitle}>{t.profile.preferredSports}</Text>
              <Text style={styles.cardSubtitle}>Select up to {MAX_PREFERRED} sports you play the most.</Text>
              <View style={styles.sportsGrid}>
                {SPORTS.map((sp) => {
                  const sel = (profile?.preferred_sports ?? []).includes(sp);
                  const atMax = !sel && (profile?.preferred_sports ?? []).length >= MAX_PREFERRED;
                  return (
                    <TouchableOpacity key={sp} style={[styles.sportChip, sel && styles.sportChipSelected, atMax && { opacity: 0.4 }]} onPress={() => togglePreferred(sp)} disabled={atMax} activeOpacity={0.8}>
                      <Text style={[styles.sportChipLabel, sel && styles.sportChipLabelSelected]}>{sportLabel(sp)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {savingPrefs && (
                <View style={styles.savingRow}>
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                  <Text style={styles.savingText}>Saving…</Text>
                </View>
              )}
            </GradientCard>

            {matchHistory.length === 0 ? (
              <GradientCard style={styles.card}>
                <Text style={[styles.cardTitle, { marginBottom: spacing.md }]}>{t.profile.matchHistory}</Text>
                <Text style={styles.placeholder}>Recent wins, losses, and casual games will appear here.</Text>
              </GradientCard>
            ) : (
              <GradientCard style={styles.matchHistoryList}>
                <View style={styles.matchHistoryHeader}>
                  <Text style={[styles.ranksSectionTitle, { marginBottom: 0 }]}>{t.profile.matchHistory}</Text>
                </View>
                {matchHistory.map((m, idx) => {
                  const myPart = (m.participants ?? []).find((p: { user_id?: string }) => String(p?.user_id) === String(currentUserId));
                  const others = (m.participants ?? []).filter((p: { user_id?: string }) => String(p?.user_id) !== String(currentUserId));
                  const opponentNames = others.map((p: { full_name?: string | null; username?: string | null }) => p?.full_name || p?.username || 'Opponent').join(', ');
                  const isPractice = m.match_type === 'practice';
                  const statusFallback = m.status === 'in_progress' ? 'In Progress' : (m.status as string).charAt(0).toUpperCase() + (m.status as string).slice(1);
                  const result = isPractice ? 'Practice' : myPart?.result === 'win' ? 'Win' : myPart?.result === 'loss' ? 'Loss' : myPart?.result === 'draw' ? 'Draw' : m.status === 'completed' ? '—' : statusFallback;
                  const games = (m.games ?? []).filter((g: { score_challenger: number; score_opponent: number }) => g.score_challenger > 0 || g.score_opponent > 0);
                  const scoreStr = games.length > 0
                    ? games.map((g: { score_challenger: number; score_opponent: number }) => `${g.score_challenger}-${g.score_opponent}`).join(', ')
                    : null;
                  const dateStr = new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const vpDelta = myPart?.vp_delta ?? 0;
                  const vpStr = vpDelta !== 0 ? (vpDelta > 0 ? `+${vpDelta}` : `${vpDelta}`) + ' VP' : null;
                  const matchTypeLabel = String(m.match_type).charAt(0).toUpperCase() + String(m.match_type).slice(1);
                  const resultColor = result === 'Win' ? colors.primary : result === 'Loss' ? '#E53935' : colors.textSecondary;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={styles.matchHistoryItem}
                      onPress={() => navigation.navigate('Home', { scrollToMatchId: m.id })}
                      activeOpacity={0.8}
                    >
                      <View style={styles.matchHistoryRow}>
                        <Text style={styles.matchHistoryEmoji}>{SPORT_EMOJI[m.sport_name] ?? '🏆'}</Text>
                        <View style={styles.matchHistoryLeft}>
                          <Text style={styles.matchHistorySport} numberOfLines={1}>vs {opponentNames || '—'}</Text>
                          <Text style={styles.matchHistoryMeta} numberOfLines={1}>
                            {m.sport_name} • {matchTypeLabel} • {dateStr}{scoreStr ? ` • ${scoreStr}` : ''}
                          </Text>
                        </View>
                        <View style={styles.matchHistoryRight}>
                          <Text style={[styles.matchHistoryResult, { color: resultColor }]}>{result}</Text>
                          {vpStr ? <Text style={styles.matchHistoryVp}>{vpStr}</Text> : null}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </GradientCard>
            )}
          </>
        )}

        {/* Rankings */}
        {tab === 'rankings' && (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => setRankIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
              scrollEventThrottle={16}
              snapToInterval={SCREEN_W}
              snapToAlignment="center"
              decelerationRate="fast"
              nestedScrollEnabled
            >
              {rankingsData.map((item) => (
                <View key={item.sport} style={styles.rankPage}>
                  <GradientCard style={styles.rankPageInner}>
                    <Text style={styles.rankEmoji}>{SPORT_EMOJI[item.sport] ?? '🏆'}</Text>
                    <Text style={styles.rankSport}>{item.sport}</Text>
                    <Text style={[styles.rankTier, { color: tierColor(item.rank_tier) }]}>{item.rank_tier ?? 'Unranked'}</Text>
                    <View style={styles.rankStatRow}>
                      <View style={styles.rankStat}><Text style={styles.rankStatValue}>{item.wins}</Text><Text style={styles.rankStatLabel}>{t.common.wins}</Text></View>
                      <View style={styles.rankStat}><Text style={[styles.rankStatValue, { color: '#2563EB' }]}>{item.vp}</Text><Text style={styles.rankStatLabel}>VP</Text></View>
                      <View style={styles.rankStat}><Text style={styles.rankStatValue}>{item.losses}</Text><Text style={styles.rankStatLabel}>{t.common.losses}</Text></View>
                    </View>
                    <Text style={styles.rankHint}>Play ranked matches in {item.sport} to earn VP and climb the ranks.</Text>
                  </GradientCard>
                </View>
              ))}
            </ScrollView>
            <View style={styles.rankDotsRow}>
              {rankingsData.map((item, i) => (
                <View key={item.sport} style={[styles.dot, i === rankIdx && styles.dotActive]} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowEditModal(false)}>
            <TouchableOpacity style={styles.modalCard} activeOpacity={1} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t.profile.editProfile}</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)} activeOpacity={0.8}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.editLabel}>{t.profile.name}</Text>
                <TextInput
                  style={styles.editInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Full name"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="words"
                />

                <Text style={styles.editLabel}>{t.profile.birthday}</Text>
                <TextInput
                  style={styles.editInput}
                  value={editDob}
                  onChangeText={setEditDob}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />

                <Text style={styles.editLabel}>{t.profile.gender}</Text>
                <View style={styles.genderRow}>
                  {GENDER_OPTIONS.map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.genderChip, editGender === g && styles.genderChipSelected]}
                      onPress={() => setEditGender(editGender === g ? '' : g)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.genderChipText, editGender === g && styles.genderChipTextSelected]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.editLabel}>{t.profile.city} <Text style={{ fontWeight: '400', color: colors.textSecondary }}></Text></Text>
                <TextInput
                  style={styles.editInput}
                  value={editCity}
                  onChangeText={setEditCity}
                  placeholder="e.g. San Francisco"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="words"
                />

                <Text style={styles.editLabel}>{t.profile.state} <Text style={{ fontWeight: '400', color: colors.textSecondary }}></Text></Text>
                <TextInput
                  style={styles.editInput}
                  value={editState}
                  onChangeText={setEditState}
                  placeholder="e.g. CA"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                  maxLength={50}
                />

                <Text style={styles.editLabel}>{t.profile.bio}</Text>
                <TextInput
                  style={[styles.editInput, { height: 80, paddingTop: 10, textAlignVertical: 'top' }]}
                  value={editBio}
                  onChangeText={setEditBio}
                  placeholder="Tell people about yourself..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  maxLength={200}
                />

                <Text style={styles.editLabel}>
                  Phone number{' '}
                  <Text style={{ fontWeight: '400', color: colors.textSecondary }}>
                    {phoneHashSet ? '(Connected)' : '(optional)'}
                  </Text>
                </Text>
                <TextInput
                  style={styles.editInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder={phoneHashSet ? 'Enter new number to update, or leave blank to clear' : '10-digit US number (e.g. 5551234567)'}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="phone-pad"
                  maxLength={15}
                />

                <TouchableOpacity
                  style={[styles.saveEditBtn, savingEdit && { opacity: 0.6 }]}
                  onPress={saveProfileEdits}
                  disabled={savingEdit}
                  activeOpacity={0.8}
                >
                  {savingEdit ? (
                    <ActivityIndicator size="small" color={colors.textOnPrimary} />
                  ) : (
                    <Text style={styles.saveEditBtnText}>{t.common.save}</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
