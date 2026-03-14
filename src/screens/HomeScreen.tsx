import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
  Share,
  Dimensions,
  Animated,
  Linking,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapPreview from '../components/MapPreview';
import { useIsFocused, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { TabParamList } from '../navigation/TabNavigator';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../constants/theme';
import { sportLabel, SPORT_EMOJI, SPORT_SCORING, validateGameScore } from '../constants/sports';
import { supabase } from '../lib/supabase';
import { sendMatchInvitePush } from '../lib/pushNotifications';
import { resolveAvatarUrl, resolveMatchImageUrl } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import UserSearch from '../components/UserSearch';
import type { SearchedUser } from '../components/UserSearch';
import EditMatchModal from '../components/EditMatchModal';
import LocationPickerModal from '../components/LocationPickerModal';
import type { PickedLocation } from '../components/LocationPickerModal';

type FeedMode = 'public' | 'my';

type Participant = {
  user_id: string;
  role: string;
  result: string;
  score: string | null;
  vp_delta: number;
  ready?: boolean;
  ready_at?: string | null;
  delete_requested?: boolean;
  finish_requested?: boolean;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type MatchGame = { game_number: number; score_challenger: number; score_opponent: number };
type MatchImage = { id: string; file_path: string; sort_order: number };

type FeedMatch = {
  id: string;
  created_at: string;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  updated_at?: string | null;
  match_type: string;
  status: string;
  is_public?: boolean;
  match_format?: string;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  notes: string | null;
  created_by: string;
  invited_opponent_id: string | null;
  invited_teammate_id: string | null;
  invited_opponent_2_id: string | null;
  sport_name: string;
  sport_slug: string;
  participants: Participant[];
  games: MatchGame[] | null;
  images: MatchImage[] | null;
  likes_count: number;
  comments_count: number;
};

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: { match_id?: string; from_user_id?: string; slot?: string };
  read: boolean;
  created_at: string;
};

function Avatar({
  initials,
  avatarUrl,
  size,
  colors,
  isWinner,
}: {
  initials: string;
  avatarUrl?: string | null;
  size: number;
  colors: ThemeColors;
  isWinner?: boolean;
}) {
  const avatarContent = avatarUrl ? (
    <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: isWinner ? colors.primary : colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: size * 0.38,
          fontWeight: '700',
          color: isWinner ? colors.textOnPrimary : colors.text,
        }}
      >
        {initials}
      </Text>
    </View>
  );

  if (isWinner) {
    const gold = '#F59E0B';
    return (
      <View style={{ alignItems: 'center', position: 'relative' }}>
        <View
          style={{
            borderWidth: 3,
            borderColor: gold,
            borderRadius: size / 2 + 4,
            padding: 4,
          }}
        >
          {avatarContent}
        </View>
        <View style={{ position: 'absolute', top: -6, left: 0, right: 0, alignItems: 'center' }}>
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: gold,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="trophy" size={12} color="#111827" />
          </View>
        </View>
      </View>
    );
  }
  return avatarContent;
}

function getInitials(p: Participant): string {
  return (p.full_name ?? p.username ?? '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getName(p: Participant): string {
  return p.full_name ?? p.username ?? 'Unknown';
}

function gameWinnerP1(
  g: { score_challenger: number; score_opponent: number },
  lowerWins: boolean,
): boolean {
  return lowerWins ? g.score_challenger < g.score_opponent : g.score_challenger > g.score_opponent;
}

function formatMatchScore(
  sportName: string,
  games: { score_challenger: number; score_opponent: number }[],
  p1Name: string,
  p2Name: string,
): { main: string; sub: string | null } {
  const filtered = games.filter((g) => g.score_challenger > 0 || g.score_opponent > 0);
  if (filtered.length === 0) return { main: '', sub: null };

  const rules = SPORT_SCORING[sportName];
  const isSetBased = rules === 'set';
  const lowerWins = rules !== 'set' && !!(rules as { lowerWins?: boolean }).lowerWins;

  // Tennis: sets won as main, set scores as sub
  if (isSetBased) {
    const setsP1 = filtered.filter((g) => g.score_challenger > g.score_opponent).length;
    const setsP2 = filtered.filter((g) => g.score_opponent > g.score_challenger).length;
    const setScores = filtered.map((g) => `${g.score_challenger}-${g.score_opponent}`).join(', ');
    return { main: `${setsP1} - ${setsP2}`, sub: setScores };
  }

  // Multi-game: games won as main, individual scores as sub
  if (filtered.length > 1) {
    const gamesP1 = filtered.filter((g) => gameWinnerP1(g, lowerWins)).length;
    const gamesP2 = filtered.filter((g) => gameWinnerP1({ score_challenger: g.score_opponent, score_opponent: g.score_challenger }, lowerWins)).length;
    const gameScores = filtered.map((g) => `${g.score_challenger}-${g.score_opponent}`).join(', ');
    return { main: `${gamesP1} - ${gamesP2}`, sub: gameScores };
  }

  // Single game: show actual score
  return { main: `${filtered[0].score_challenger} - ${filtered[0].score_opponent}`, sub: null };
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatDurationDigital(ms: number): string {
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatPracticeDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin}min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

type MatchComment = {
  id: string;
  match_id: string;
  user_id: string;
  body: string;
  created_at: string;
  username?: string | null;
  full_name?: string | null;
};

type Liker = { user_id: string; username: string | null; full_name: string | null };

function FeedCard({
  item,
  currentUserId,
  styles,
  colors,
  onRefresh,
  updateFeedItem,
  onRemoveItem,
  onInviteOpponent,
  onEditMatch,
  navigation,
  onNotifyUpdate,
}: {
  item: FeedMatch;
  currentUserId: string | null;
  styles: ReturnType<typeof createHomeStyles>;
  colors: ThemeColors;
  onRefresh: () => void;
  updateFeedItem: (matchId: string, updater: (item: FeedMatch) => FeedMatch) => void;
  onRemoveItem: (matchId: string) => void;
  onInviteOpponent?: (match: FeedMatch, slot?: 'opponent' | 'teammate' | 'opponent_2') => void;
  onEditMatch?: (match: FeedMatch) => void;
  navigation: { navigate: (screen: string, params?: object) => void };
  onNotifyUpdate?: () => void;
}) {
  const participantsParsed: Participant[] = (() => {
    const raw = item.participants ?? [];
    if (Array.isArray(raw)) return raw as Participant[];
    if (typeof raw === 'string') { try { return JSON.parse(raw) as Participant[]; } catch { return []; } }
    return [];
  })();
  const is2v2 = (item.match_format || '1v1') === '2v2';
  const team1 = participantsParsed.filter((p) => p.role === 'challenger');
  const team2 = participantsParsed.filter((p) => p.role === 'opponent');

  let p1: Participant | null = null;
  let p2: Participant | null = null;
  let teammate: Participant | null = null;
  let opponent2: Participant | null = null;

  if (is2v2) {
    // 2v2: pin p1 to the creator so avatar resolution (which uses find(not creator)) stays consistent
    // regardless of json_agg ordering in match_feed.
    p1 = team1.find((p) => p.user_id === item.created_by) ?? team1[0] ?? null;
    teammate = team1.find((p) => p.user_id !== item.created_by) ?? team1[1] ?? null;
    p2 = team2[0] ?? null;
    opponent2 = team2[1] ?? null;
  } else {
    // 1v1 / other formats: keep simple challenger vs opponent view.
    const challenger = team1[0] ?? null;
    const opponent = team2[0] ?? null;
    p1 = challenger ?? participantsParsed[0] ?? null;
    p2 =
      opponent ??
      participantsParsed.find((p) => !p1 || p.user_id !== p1.user_id) ??
      null;
    teammate = null;
    opponent2 = null;
  }

  const creator = participantsParsed.find((p) => p.user_id === item.created_by) ?? p1;

  const [creatorAvatarUrl, setCreatorAvatarUrl] = useState<string | null>(null);
  const [p1AvatarUrl, setP1AvatarUrl] = useState<string | null>(null);
  const [p2AvatarUrl, setP2AvatarUrl] = useState<string | null>(null);
  const [partner2AvatarUrl, setPartner2AvatarUrl] = useState<string | null>(null);
  const [partner3AvatarUrl, setPartner3AvatarUrl] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(item.likes_count);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [deleteImageId, setDeleteImageId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxImgId, setLightboxImgId] = useState<string | null>(null);
  const [deleteToast, setDeleteToast] = useState(false);
  const deleteToastAnim = useRef(new Animated.Value(0)).current;
  const gamesList = (item.games ?? []) as MatchGame[];
  const [localGames, setLocalGames] = useState<{ score_challenger: string; score_opponent: string }[]>(
    gamesList.length > 0 ? gamesList.map((g) => ({ score_challenger: String(g.score_challenger), score_opponent: String(g.score_opponent) })) : [{ score_challenger: '', score_opponent: '' }],
  );
  const [saving, setSaving] = useState(false);
  const [saveValidationError, setSaveValidationError] = useState<string | null>(null);
  const editingScoreRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localGamesRef = useRef(localGames);
  localGamesRef.current = localGames;
  const [startStopLoading, setStartStopLoading] = useState(false);
  const [readyLoading, setReadyLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [winnerPickerVisible, setWinnerPickerVisible] = useState(false);
  const [winnerSelection, setWinnerSelection] = useState<string | null>(null); // null = draw
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const cardAnim = useRef(new Animated.Value(1)).current;
  const animateAndRemove = useCallback(() => {
    Animated.timing(cardAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => onRemoveItem(item.id));
  }, [cardAnim, onRemoveItem, item.id]);

  // Clear auto-save timer on unmount to prevent state updates after removal
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  const [commentsVisible, setCommentsVisible] = useState(false);
  const [comments, setComments] = useState<MatchComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [commentPosting, setCommentPosting] = useState(false);
  const [commentsCount, setCommentsCount] = useState(item.comments_count);
  const [currentUserCommentProfile, setCurrentUserCommentProfile] = useState<{ username: string | null; full_name: string | null } | null>(null);

  useEffect(() => {
    if (!currentUserId) return;
    supabase.from('profiles').select('username, full_name').eq('user_id', currentUserId).maybeSingle()
      .then(({ data }) => { if (data) setCurrentUserCommentProfile(data as { username: string | null; full_name: string | null }); });
  }, [currentUserId]);

  const [likersModalVisible, setLikersModalVisible] = useState(false);
  const [likers, setLikers] = useState<Liker[]>([]);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [likersLoading, setLikersLoading] = useState(false);

  useEffect(() => {
    if (creator?.avatar_url) resolveAvatarUrl(creator.avatar_url).then(setCreatorAvatarUrl);
    if (p1?.avatar_url) resolveAvatarUrl(p1.avatar_url).then(setP1AvatarUrl);
    if (p2?.avatar_url) resolveAvatarUrl(p2.avatar_url).then(setP2AvatarUrl);
  }, [creator?.avatar_url, p1?.avatar_url, p2?.avatar_url]);

  useEffect(() => {
    const isPracticeMatch = String(item.match_type || '').toLowerCase() === 'practice';
    const is2v2Match = (item.match_format || '1v1') === '2v2';
    const parts = (Array.isArray(item.participants) ? item.participants : []) as Participant[];
    if (isPracticeMatch) {
      const partners = parts.filter((p) => p.role === 'opponent');
      if (partners[1]?.avatar_url) resolveAvatarUrl(partners[1].avatar_url).then(setPartner2AvatarUrl);
      if (partners[2]?.avatar_url) resolveAvatarUrl(partners[2].avatar_url).then(setPartner3AvatarUrl);
    } else if (is2v2Match) {
      const challengers = parts.filter((p) => p.role === 'challenger');
      const opponents = parts.filter((p) => p.role === 'opponent');
      const tm = challengers.find((p) => p.user_id !== item.created_by);
      const o2 = opponents[1];
      if (tm?.avatar_url) resolveAvatarUrl(tm.avatar_url).then(setPartner2AvatarUrl);
      if (o2?.avatar_url) resolveAvatarUrl(o2.avatar_url).then(setPartner3AvatarUrl);
    }
  }, [item.match_type, item.match_format, item.created_by, item.participants]);

  useEffect(() => {
    if (currentUserId) {
      supabase.from('match_likes').select('match_id').eq('match_id', item.id).eq('user_id', currentUserId).maybeSingle().then(({ data }) => setLiked(!!data));
    }
    setLikesCount(item.likes_count);
  }, [currentUserId, item.id, item.likes_count]);

  useEffect(() => {
    const imgs = (item.images ?? []) as MatchImage[];
    imgs.forEach((img) => {
      resolveMatchImageUrl(img.file_path).then((url) => {
        if (url) setImageUrls((prev) => ({ ...prev, [img.id]: url }));
      });
    });
  }, [item.images]);

  useEffect(() => {
    if (editingScoreRef.current) return;
    const gs = (item.games ?? []) as MatchGame[];
    setLocalGames(
      gs.length > 0 ? gs.map((g) => ({ score_challenger: String(g.score_challenger), score_opponent: String(g.score_opponent) })) : [{ score_challenger: '', score_opponent: '' }],
    );
  }, [item.id, item.games]);

  useEffect(() => {
    setCommentsCount(item.comments_count);
  }, [item.comments_count]);

  const loadComments = useCallback(async (silent = false) => {
    if (!silent) setCommentsLoading(true);
    try {
      const { data: rows } = await supabase
        .from('match_comments')
        .select('id, match_id, user_id, body, created_at')
        .eq('match_id', item.id)
        .order('created_at', { ascending: true });
      const list = (rows ?? []) as { id: string; match_id: string; user_id: string; body: string; created_at: string }[];
      if (list.length === 0) {
        setComments([]);
        setCommentsLoading(false);
        return;
      }
      const userIds = Array.from(new Set(list.map((c) => c.user_id)));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, full_name')
        .in('user_id', userIds);
      const profileMap = new Map((profiles ?? []).map((p: { user_id: string; username: string | null; full_name: string | null }) => [p.user_id, p]));
      const withProfiles: MatchComment[] = list.map((c) => ({
        ...c,
        username: profileMap.get(c.user_id)?.username ?? null,
        full_name: profileMap.get(c.user_id)?.full_name ?? null,
      }));
      setComments(withProfiles);
    } catch { /* swallow */ }
    finally { setCommentsLoading(false); }
  }, [item.id]);

  useEffect(() => {
    if (commentsVisible) loadComments();
  }, [commentsVisible, loadComments]);

  const loadLikers = useCallback(async () => {
    setLikersLoading(true);
    try {
      const { data: rows } = await supabase
        .from('match_likes')
        .select('user_id')
        .eq('match_id', item.id);
      const userIds = (rows ?? []).map((r: { user_id: string }) => r.user_id);
      if (userIds.length === 0) {
        setLikers([]);
        setLikersLoading(false);
        return;
      }
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, full_name')
        .in('user_id', userIds);
      setLikers((profiles ?? []) as Liker[]);
    } catch { /* swallow */ }
    finally { setLikersLoading(false); }
  }, [item.id]);

  useEffect(() => {
    if (likersModalVisible) loadLikers();
  }, [likersModalVisible, loadLikers]);

  const handlePostComment = async () => {
    const body = commentBody.trim();
    if (!currentUserId || !body || commentPosting) return;
    setCommentPosting(true);
    const tempComment: MatchComment = {
      id: `temp-${Date.now()}`,
      match_id: item.id,
      user_id: currentUserId,
      body,
      created_at: new Date().toISOString(),
      username: currentUserCommentProfile?.username ?? null,
      full_name: currentUserCommentProfile?.full_name ?? null,
    };
    setComments((prev) => [...prev, tempComment]);
    setCommentsCount((c) => c + 1);
    setCommentBody('');
    try {
      await supabase.from('match_comments').insert({ match_id: item.id, user_id: currentUserId, body });
      await loadComments(true);
    } catch { /* swallow */ }
    finally { setCommentPosting(false); }
  };

  const isInProgress = item.status === 'in_progress';
  const isPaused = item.status === 'paused';
  const isParticipant = currentUserId != null &&
    participantsParsed.some((p) => p?.user_id === currentUserId);
  const canControl = isParticipant;

  useEffect(() => {
    if (isInProgress && item.started_at) {
      const update = () => {
        const start = new Date(item.started_at!).getTime();
        setElapsedMs(Date.now() - start);
      };
      update();
      timerRef.current = setInterval(update, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [isInProgress, item.started_at]);

  const durationMs = item.ended_at && item.started_at
    ? new Date(item.ended_at).getTime() - new Date(item.started_at).getTime()
    : isInProgress ? elapsedMs
    : isPaused && item.started_at ? Date.now() - new Date(item.started_at).getTime()
    : 0;

  const isRanked = String(item.match_type || '').toLowerCase() === 'ranked';
  const isLocal = String(item.match_type || '').toLowerCase() === 'local';
  const isPractice = String(item.match_type || '').toLowerCase() === 'practice';
  const participants = participantsParsed;
  const practicePartners = isPractice ? participants.filter((p) => p.role === 'opponent').slice(0, 3) : [];
  const myParticipant = participants.find((p) => p?.user_id && String(p.user_id) === String(currentUserId));
  const requiredParticipants = (item.match_format || '1v1') === '2v2' ? 4 : 2;
  const READY_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes
  const isReady = (p: Participant) => {
    const rawReady = p?.ready === true || (typeof p?.ready === 'string' && String(p.ready).toLowerCase() === 'true');
    const autoReady = p?.user_id === item.created_by && p?.ready !== false;
    const ready = rawReady || autoReady;
    if (!ready) return false;
    if (isRanked && rawReady && p?.ready_at) {
      const elapsed = Date.now() - new Date(p.ready_at as string).getTime();
      if (elapsed >= READY_EXPIRY_MS) return false;
    }
    return true;
  };
  const readyCount = participants.filter((p) => isReady(p)).length;

  const handleReady = async () => {
    if (!currentUserId || readyLoading) return;
    setReadyLoading(true);
    try {
      const readyAt = new Date().toISOString();
      await supabase.from('match_participants').update({ ready: true, ready_at: readyAt }).eq('match_id', item.id).eq('user_id', currentUserId);
      updateFeedItem(item.id, (m) => ({
        ...m,
        participants: m.participants.map((p) => p.user_id === currentUserId ? { ...p, ready: true, ready_at: readyAt } : p),
      }));
    } catch { /* swallow */ }
    finally { setReadyLoading(false); }
  };

  const handleUnready = async () => {
    if (!currentUserId || readyLoading) return;
    setReadyLoading(true);
    try {
      await supabase.from('match_participants').update({ ready: false, ready_at: null }).eq('match_id', item.id).eq('user_id', currentUserId);
      updateFeedItem(item.id, (m) => ({
        ...m,
        participants: m.participants.map((p) => p.user_id === currentUserId ? { ...p, ready: false, ready_at: null } : p),
      }));
    } catch { /* swallow */ }
    finally { setReadyLoading(false); }
  };

  // Auto-unready after 2 minutes for ranked matches
  useEffect(() => {
    if (!isRanked || !myParticipant?.ready_at || !myParticipant?.ready) return;
    const elapsed = Date.now() - new Date(myParticipant.ready_at).getTime();
    const remaining = READY_EXPIRY_MS - elapsed;
    if (remaining <= 0) {
      handleUnready();
      return;
    }
    const t = setTimeout(() => { handleUnready(); }, remaining);
    return () => clearTimeout(t);
  }, [isRanked, myParticipant?.ready_at, myParticipant?.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusConfirmed = String(item.status || '').toLowerCase() === 'confirmed';
  // 2v2 ranked requires all 4 to explicitly ready up; 1v1 ranked can start once confirmed or both ready
  const canStartRanked = isRanked && participants.length >= requiredParticipants && (
    is2v2 ? readyCount >= requiredParticipants : (statusConfirmed || readyCount >= requiredParticipants)
  );
  const canStartCasual = !isRanked && !isLocal && !isPractice && participants.length >= requiredParticipants;
  const canStartLocal = isLocal && participants.length >= 1;
  const canStartPractice = isPractice && participants.length >= 1;
  const isScheduledFuture = !!(
    item.scheduled_at &&
    new Date(item.scheduled_at) > new Date() &&
    !item.started_at &&
    (item.status === 'pending' || item.status === 'confirmed')
  );
  const canStartMeetsCriteria = canStartRanked || canStartCasual || canStartLocal || canStartPractice;
  const canStart = canStartMeetsCriteria && !isScheduledFuture;

  const handleStart = async () => {
    if (!currentUserId || startStopLoading) return;
    if (!canStartMeetsCriteria) return;
    setStartStopLoading(true);
    try {
      const startedAt = new Date().toISOString();
      await supabase.from('matches').update({ status: 'in_progress', started_at: startedAt })
        .eq('id', item.id)
        .in('status', ['confirmed', 'pending', 'planned']);
      updateFeedItem(item.id, (m) => ({ ...m, status: 'in_progress', started_at: startedAt }));
      onNotifyUpdate?.();
    } catch { /* swallow */ }
    finally { setStartStopLoading(false); }
  };

  const handlePause = async () => {
    if (!currentUserId || startStopLoading) return;
    setStartStopLoading(true);
    try {
      const { data } = await supabase.from('matches').update({ status: 'paused' })
        .eq('id', item.id)
        .eq('status', 'in_progress')
        .select('id');
      if (data && data.length > 0) {
        updateFeedItem(item.id, (m) => ({ ...m, status: 'paused' }));
        onNotifyUpdate?.();
      }
    } catch { /* swallow */ }
    finally { setStartStopLoading(false); }
  };

  const handleResume = async () => {
    if (!currentUserId || startStopLoading) return;
    setStartStopLoading(true);
    try {
      const { data } = await supabase.from('matches').update({ status: 'in_progress' })
        .eq('id', item.id)
        .eq('status', 'paused')
        .select('id');
      if (data && data.length > 0) {
        updateFeedItem(item.id, (m) => ({ ...m, status: 'in_progress' }));
        onNotifyUpdate?.();
      }
    } catch { /* swallow */ }
    finally { setStartStopLoading(false); }
  };

  const finishWithWinner = async (winnerUserId: string | null) => {
    if (!currentUserId || startStopLoading) return;
    setStartStopLoading(true);
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('finish_match', {
        p_match_id: item.id,
        p_winner_user_id: winnerUserId,
        p_finished_by: currentUserId,
      });

      if (rpcError) throw rpcError;

      const result = rpcResult as { ok: boolean; error?: string };
      if (!result.ok) {
        Alert.alert('Cannot finish match', result.error ?? 'This match was already finished by another player.');
        onRefresh();
        return;
      }

      // Optimistic local update
      const participants = (item.participants ?? []) as Participant[];
      const is2v2 = (item.match_format || '1v1') === '2v2';
      const winnerParticipant = winnerUserId ? participants.find((p) => p.user_id === winnerUserId) : null;
      const winningRole = winnerParticipant?.role;
      const isRankedMatch = item.match_type === 'ranked';
      const getResult = (p: Participant): string => {
        if (winnerUserId === null) return 'draw';
        if (is2v2 && winningRole) return p.role === winningRole ? 'win' : 'loss';
        return winnerUserId === p.user_id ? 'win' : 'loss';
      };
      const endedAt = new Date().toISOString();
      updateFeedItem(item.id, (m) => ({
        ...m,
        status: 'completed',
        ended_at: endedAt,
        participants: m.participants.map((p) => {
          const res = getResult(p);
          return {
            ...p,
            result: res,
            vp_delta: res === 'win' ? (isRankedMatch ? 1 : 0) : res === 'loss' ? (isRankedMatch ? -1 : 0) : 0,
          };
        }),
      }));

      // Send notifications (non-critical, client-side)
      const { data: myProfile } = await supabase.from('profiles').select('username, full_name').eq('user_id', currentUserId).maybeSingle();
      const finisherName = myProfile?.full_name ?? myProfile?.username ?? 'Someone';
      const matchTypeLabel = item.match_type ? String(item.match_type).charAt(0).toUpperCase() + String(item.match_type).slice(1) : 'Match';
      const winnerName = winnerParticipant ? (winnerParticipant.full_name ?? winnerParticipant.username ?? 'Someone') : null;
      for (const p of participants) {
        if (p.user_id !== currentUserId) {
          let notifBody: string;
          if (winnerUserId === null) {
            notifBody = `${finisherName} marked the match as a draw.`;
          } else if (p.user_id === winnerUserId) {
            notifBody = `You won! ${finisherName} finished the match.`;
          } else {
            notifBody = `${winnerName} won the match!`;
          }
          await supabase.from('notifications').insert({
            user_id: p.user_id,
            type: 'match_finished',
            title: `${matchTypeLabel} match finished`,
            body: notifBody,
            data: { match_id: item.id, from_user_id: currentUserId },
          });
        }
      }
    } catch { /* swallow */ }
    finally { setStartStopLoading(false); }
  };

  const detectWinnerFromScores = (): string | null => {
    const rules = SPORT_SCORING[item.sport_name];
    const isSetBased = rules === 'set';
    const lowerWins = rules !== 'set' && !!(rules as { lowerWins?: boolean }).lowerWins;
    let gamesP1 = 0, gamesP2 = 0;
    for (const g of localGames) {
      const sc = parseInt(g.score_challenger, 10) || 0;
      const so = parseInt(g.score_opponent, 10) || 0;
      if (sc === 0 && so === 0) continue;
      const p1Wins = isSetBased || !lowerWins ? sc > so : sc < so;
      if (p1Wins) gamesP1++;
      else if (isSetBased || !lowerWins ? so > sc : so < sc) gamesP2++;
    }
    if (gamesP1 > gamesP2) return p1?.user_id ?? null;
    if (gamesP2 > gamesP1) return p2?.user_id ?? null;
    return null; // draw / tied
  };

  const handleRankedFinishRequest = async () => {
    if (!currentUserId || startStopLoading) return;
    setStartStopLoading(true);
    try {
      // Mark current user as requesting finish
      await supabase.from('match_participants')
        .update({ finish_requested: true })
        .eq('match_id', item.id)
        .eq('user_id', currentUserId);

      updateFeedItem(item.id, (m) => ({
        ...m,
        participants: m.participants.map((p) =>
          p.user_id === currentUserId ? { ...p, finish_requested: true } : p
        ),
      }));

      // Query DB for fresh state
      const { data: dbParticipants } = await supabase
        .from('match_participants')
        .select('user_id, role, finish_requested')
        .eq('match_id', item.id);

      // Check if required confirmations are met
      // 2v2: 1 from each team; 1v1: both players
      let canFinish = false;
      if (is2v2) {
        const challConfirmed = (dbParticipants ?? []).some((p: any) => p.role === 'challenger' && p.finish_requested);
        const oppConfirmed = (dbParticipants ?? []).some((p: any) => p.role === 'opponent' && p.finish_requested);
        canFinish = challConfirmed && oppConfirmed;
      } else {
        canFinish = (dbParticipants ?? []).length >= 2 &&
          (dbParticipants ?? []).every((p: any) => p.finish_requested);
      }

      if (canFinish) {
        // Determine winner from scores — ranked uses score-based winner, not user choice
        const winner = detectWinnerFromScores();
        const { data: rpcResult, error: rpcError } = await supabase.rpc('finish_match', {
          p_match_id: item.id,
          p_winner_user_id: winner,
          p_finished_by: currentUserId,
        });
        if (rpcError) throw rpcError;
        const result = rpcResult as { ok: boolean; error?: string };
        if (!result.ok) {
          Alert.alert('Cannot finish match', result.error ?? 'This match was already finished.');
          onRefresh();
          return;
        }
        // Local optimistic update
        const allParticipants = (item.participants ?? []) as Participant[];
        const winnerParticipant = winner ? allParticipants.find((p) => p.user_id === winner) : null;
        const winningRole = winnerParticipant?.role;
        const getRes = (p: Participant): string => {
          if (winner === null) return 'draw';
          if (is2v2 && winningRole) return p.role === winningRole ? 'win' : 'loss';
          return winner === p.user_id ? 'win' : 'loss';
        };
        updateFeedItem(item.id, (m) => ({
          ...m,
          status: 'completed',
          ended_at: new Date().toISOString(),
          participants: m.participants.map((p) => {
            const res = getRes(p);
            return { ...p, result: res, vp_delta: res === 'win' ? 1 : res === 'loss' ? -1 : 0 };
          }),
        }));
        // Notify other participants
        const { data: myProfile } = await supabase.from('profiles').select('username, full_name').eq('user_id', currentUserId).maybeSingle();
        const finisherName = myProfile?.full_name ?? myProfile?.username ?? 'Someone';
        const matchTypeLabel = 'Ranked';
        const winnerName = winnerParticipant ? (winnerParticipant.full_name ?? winnerParticipant.username ?? 'Someone') : null;
        for (const p of allParticipants) {
          if (p.user_id !== currentUserId) {
            let notifBody: string;
            if (winner === null) {
              notifBody = `${finisherName} marked the match as a draw.`;
            } else if (p.user_id === winner) {
              notifBody = `You won! ${finisherName} finished the match.`;
            } else {
              notifBody = `${winnerName} won the match!`;
            }
            await supabase.from('notifications').insert({
              user_id: p.user_id,
              type: 'match_finished',
              title: `${matchTypeLabel} match finished`,
              body: notifBody,
              data: { match_id: item.id, from_user_id: currentUserId },
            });
          }
        }
      } else {
        Alert.alert('Finish requested', 'Waiting for the other player(s) to confirm. The match will finish automatically once all required players confirm.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not request finish.');
    } finally {
      setStartStopLoading(false);
    }
  };

  const handleCancelFinishRequest = async () => {
    if (!currentUserId || startStopLoading) return;
    setStartStopLoading(true);
    try {
      await supabase.from('match_participants')
        .update({ finish_requested: false })
        .eq('match_id', item.id)
        .eq('user_id', currentUserId);
      updateFeedItem(item.id, (m) => ({
        ...m,
        participants: m.participants.map((p) =>
          p.user_id === currentUserId ? { ...p, finish_requested: false } : p
        ),
      }));
    } catch { /* swallow */ }
    finally { setStartStopLoading(false); }
  };

  const handleFinish = () => {
    if (!currentUserId || startStopLoading) return;
    const doFinish = () => {
      if (isPractice) {
        finishWithWinner(null);
        return;
      }
      if (isRanked) {
        // Ranked: mutual confirmation required; winner decided by score
        handleRankedFinishRequest();
        return;
      }
      // Casual/local: show winner picker
      setWinnerSelection(detectWinnerFromScores());
      setWinnerPickerVisible(true);
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to finish this match?')) doFinish();
    } else {
      Alert.alert('Finish match?', 'Are you sure you want to finish this match?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Finish', onPress: doFinish },
      ]);
    }
  };

  const selectWinner = (userId: string | null) => {
    setWinnerSelection(userId);
  };

  const confirmWinner = () => {
    setWinnerPickerVisible(false);
    finishWithWinner(winnerSelection);
  };

  const handleAddGame = () => {
    editingScoreRef.current = true;
    setLocalGames((prev) => [...prev, { score_challenger: '', score_opponent: '' }]);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveGames();
    }, 1500);
  };

  const amChallenger = myParticipant?.role === 'challenger';
  const amOpponent = myParticipant?.role === 'opponent';
  const canEditChallenger = !isRanked || amChallenger;
  const canEditOpponent = !isRanked || amOpponent;

  const handleScoreChange = (idx: number, field: 'score_challenger' | 'score_opponent', value: string) => {
    // Ranked: only allow editing your own column
    if (isRanked) {
      if (field === 'score_challenger' && !amChallenger) return;
      if (field === 'score_opponent' && !amOpponent) return;
    }
    editingScoreRef.current = true;
    setLocalGames((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveGames();
    }, 1500);
  };

  const performSaveGames = async () => {
    if (!currentUserId) return;
    setSaving(true);
    const games = localGamesRef.current;
    try {
      if (isRanked && myParticipant) {
        // Ranked: update only the current user's score column per game row.
        // Uses ensure-row-exists + column-specific update to avoid overwriting
        // the opponent's scores even under concurrent edits.
        for (let i = 0; i < games.length; i++) {
          const gameNum = i + 1;
          const myScore = amChallenger
            ? (parseInt(games[i].score_challenger, 10) || 0)
            : (parseInt(games[i].score_opponent, 10) || 0);

          // Step 1: ensure the game row exists without clobbering existing data
          await supabase.from('match_games').upsert(
            { match_id: item.id, game_number: gameNum, score_challenger: 0, score_opponent: 0 },
            { onConflict: 'match_id,game_number', ignoreDuplicates: true },
          );

          // Step 2: update only our column
          if (amChallenger) {
            await supabase.from('match_games')
              .update({ score_challenger: myScore })
              .eq('match_id', item.id).eq('game_number', gameNum);
          } else {
            await supabase.from('match_games')
              .update({ score_opponent: myScore })
              .eq('match_id', item.id).eq('game_number', gameNum);
          }
        }

        // Update own participant score total
        const myTotal = games.reduce(
          (a, g) => a + (amChallenger ? (parseInt(g.score_challenger, 10) || 0) : (parseInt(g.score_opponent, 10) || 0)),
          0,
        );
        await supabase.from('match_participants')
          .update({ score: String(myTotal) })
          .eq('match_id', item.id).eq('user_id', currentUserId);

        // Re-fetch games from DB to get both users' latest scores
        const { data: freshGames } = await supabase
          .from('match_games')
          .select('game_number, score_challenger, score_opponent')
          .eq('match_id', item.id)
          .order('game_number');
        const savedGames: MatchGame[] = (freshGames ?? []).map((g) => ({
          game_number: g.game_number,
          score_challenger: g.score_challenger,
          score_opponent: g.score_opponent,
        }));
        updateFeedItem(item.id, (m) => ({
          ...m,
          games: savedGames,
          participants: m.participants.map((p) =>
            p.user_id === currentUserId ? { ...p, score: String(myTotal) } : p,
          ),
        }));
      } else {
        // Casual: any participant can write all scores; last writer wins
        await supabase.from('match_games').delete().eq('match_id', item.id);
        const savedGames: MatchGame[] = [];
        for (let i = 0; i < games.length; i++) {
          const sc = parseInt(games[i].score_challenger, 10) || 0;
          const so = parseInt(games[i].score_opponent, 10) || 0;
          await supabase.from('match_games').insert({ match_id: item.id, game_number: i + 1, score_challenger: sc, score_opponent: so });
          savedGames.push({ game_number: i + 1, score_challenger: sc, score_opponent: so });
        }
        const totalP1 = games.reduce((a, g) => a + (parseInt(g.score_challenger, 10) || 0), 0);
        const totalP2 = games.reduce((a, g) => a + (parseInt(g.score_opponent, 10) || 0), 0);
        if (p1) await supabase.from('match_participants').update({ score: String(totalP1) }).eq('match_id', item.id).eq('user_id', p1.user_id);
        if (p2) await supabase.from('match_participants').update({ score: String(totalP2) }).eq('match_id', item.id).eq('user_id', p2.user_id);
        updateFeedItem(item.id, (m) => ({
          ...m,
          games: savedGames,
          participants: m.participants.map((p) => {
            if (p1 && p.user_id === p1.user_id) return { ...p, score: String(totalP1) };
            if (p2 && p.user_id === p2.user_id) return { ...p, score: String(totalP2) };
            return p;
          }),
        }));
      }
    } catch { /* swallow */ }
    finally {
      setSaving(false);
      editingScoreRef.current = false;
    }
  };

  const handleSaveAnyway = () => {
    setSaveValidationError(null);
    performSaveGames();
  };

  const handleSaveGames = async () => {
    if (!currentUserId || saving) return;
    const games = localGamesRef.current;
    const errors: string[] = [];
    for (let i = 0; i < games.length; i++) {
      const sc = parseInt(games[i].score_challenger, 10) || 0;
      const so = parseInt(games[i].score_opponent, 10) || 0;
      if (sc > 0 || so > 0) {
        const err = validateGameScore(item.sport_name, sc, so);
        if (err) errors.push(`Game ${i + 1}: ${err}`);
      }
    }
    if (errors.length > 0) {
      const msg = (errors.length === 1 ? errors[0] : errors.slice(0, 3).join('\n')) + (errors.length > 3 ? `\n...and ${errors.length - 3} more` : '');
      setSaveValidationError(msg);
    } else {
      setSaveValidationError(null);
      performSaveGames();
    }
  };

  const handleToggleLike = async () => {
    if (!currentUserId) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikesCount((c) => (wasLiked ? c - 1 : c + 1));
    try {
      if (wasLiked) {
        await supabase.from('match_likes').delete().eq('match_id', item.id).eq('user_id', currentUserId);
      } else {
        await supabase.from('match_likes').insert({ match_id: item.id, user_id: currentUserId });
      }
    } catch {
      setLiked(wasLiked);
      setLikesCount((c) => (wasLiked ? c + 1 : c - 1));
    }
  };

  const handleShare = async () => {
    const creatorName = creator ? getName(creator) : 'Someone';
    const msg = `${creatorName} played ${item.sport_name} on Versus${item.location_name ? ` at ${item.location_name}` : ''}. Check it out!`;
    try {
      await Share.share({ message: msg, title: 'Versus Match' });
    } catch { /* user cancelled */ }
  };

  const handlePickLocation = async (loc: PickedLocation) => {
    setLocationPickerVisible(false);
    try {
      await supabase.from('matches').update({
        location_name: loc.name,
        location_lat: loc.latitude,
        location_lng: loc.longitude,
      }).eq('id', item.id);
      updateFeedItem(item.id, (prev) => ({
        ...prev,
        location_name: loc.name,
        location_lat: loc.latitude,
        location_lng: loc.longitude,
      }));
    } catch { /* swallow */ }
  };

  const handleAddImage = async () => {
    if (!currentUserId || !isParticipant) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to add images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, base64: true });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    setSaving(true);
    try {
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const ext = mimeType.split('/')[1] ?? 'jpeg';
      const filePath = `${item.id}/${currentUserId}/${Date.now()}.${ext}`;
      if (!asset.base64) throw new Error('Image data unavailable');
      const binaryString = atob(asset.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const { error: uploadErr } = await supabase.storage.from('match-images').upload(filePath, bytes, { contentType: mimeType, upsert: false });
      if (uploadErr) throw uploadErr;
      const images = (item.images ?? []) as MatchImage[];
      const { data: insertedRow } = await supabase.from('match_images').insert({ match_id: item.id, user_id: currentUserId, file_path: filePath, sort_order: images.length }).select('id, file_path, sort_order').single();
      if (insertedRow) {
        updateFeedItem(item.id, (m) => ({
          ...m,
          images: [...(m.images ?? []), { id: insertedRow.id, file_path: insertedRow.file_path, sort_order: insertedRow.sort_order }],
        }));
      }
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Could not add image.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteImage = async (img: MatchImage) => {
    try {
      // Delete DB row first — verify it actually deleted (RLS could block silently)
      const { data: deleted, error: dbErr } = await supabase
        .from('match_images').delete().eq('id', img.id).select('id');
      if (dbErr) throw dbErr;
      if (!deleted || deleted.length === 0) {
        Alert.alert('Delete failed', 'Permission denied.');
        return;
      }
      // Remove from storage (best-effort, don't block on failure)
      supabase.storage.from('match-images').remove([img.file_path]).catch(() => {});
      setLightboxUrl(null);
      setLightboxImgId(null);
      setDeleteImageId(null);
      setImageUrls((prev) => { const next = { ...prev }; delete next[img.id]; return next; });
      updateFeedItem(item.id, (m) => ({
        ...m,
        images: (m.images ?? []).filter((i) => i.id !== img.id),
      }));
      // Show toast
      setDeleteToast(true);
      Animated.sequence([
        Animated.timing(deleteToastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(deleteToastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setDeleteToast(false));
    } catch (e: any) {
      Alert.alert('Delete failed', e?.message ?? 'Could not delete image.');
    }
  };

  const performFullDelete = async () => {
    // Reverse sport ratings if this was a completed ranked match
    if (item.status === 'completed' && item.match_type === 'ranked') {
      const pts = (item.participants ?? []) as Participant[];
      const { data: sportRow } = await supabase.from('sports').select('id').eq('name', item.sport_name).maybeSingle();
      if (sportRow?.id) {
        for (const p of pts) {
          await supabase.rpc('reverse_sport_rating', {
            p_user_id: p.user_id,
            p_sport_id: sportRow.id,
            p_vp_loss: Math.max(0, p.vp_delta ?? 0),
            p_was_win: p.result === 'win',
            p_was_loss: p.result === 'loss',
          });
        }
      }
    }
    // Clean up invite notifications
    await supabase.from('notifications').delete().eq('type', 'match_invite').filter('data->>match_id', 'eq', item.id);
    const { data: delResult, error: delError } = await supabase.rpc('delete_match_as_participant', { p_match_id: item.id });
    if (delError) throw delError;
    if (!delResult?.ok) throw new Error(delResult?.error ?? 'Could not delete match.');
    animateAndRemove();
  };

  const handleDelete = () => {
    if (!currentUserId || deleteLoading) return;

    const isPendingState = item.status === 'pending' || item.status === 'confirmed';

    const doRankedDeleteRequest = async () => {
      setDeleteLoading(true);
      try {
        await supabase.from('match_participants').update({ delete_requested: true }).eq('match_id', item.id).eq('user_id', currentUserId);
        updateFeedItem(item.id, (m) => ({
          ...m,
          participants: m.participants.map((p) =>
            p.user_id === currentUserId ? { ...p, delete_requested: true } : p
          ),
        }));
        // Query DB for real state to avoid race conditions
        const { data: dbParticipants } = await supabase
          .from('match_participants')
          .select('user_id, delete_requested')
          .eq('match_id', item.id);
        const allConfirmed = dbParticipants != null &&
          dbParticipants.length >= 2 &&
          dbParticipants.every((p) => p.delete_requested === true);
        if (allConfirmed) {
          await performFullDelete();
        }
      } catch (e: any) {
        Alert.alert('Error', e?.message ?? 'Could not process delete request.');
      } finally { setDeleteLoading(false); }
    };

    const doCasualDelete = async () => {
      setDeleteLoading(true);
      try {
        await performFullDelete();
      } catch (e: any) {
        Alert.alert('Delete failed', e?.message ?? 'Could not delete match.');
      } finally { setDeleteLoading(false); }
    };

    if (isRanked) {
      const alreadyRequested = myParticipant?.delete_requested === true;
      if (alreadyRequested) return;
      if (Platform.OS === 'web') {
        if (window.confirm('Both players must confirm to permanently delete this ranked match and reverse any rating changes.')) {
          doRankedDeleteRequest();
        }
      } else {
        Alert.alert(
          'Delete match?',
          'Both players must confirm to permanently delete this ranked match and reverse any rating changes.',
          [
            { text: 'Keep', style: 'cancel' },
            { text: 'Yes, request delete', style: 'destructive', onPress: doRankedDeleteRequest },
          ],
        );
      }
    } else if (isPendingState) {
      if (Platform.OS === 'web') {
        if (window.confirm('Are you sure you want to cancel this match? It will be permanently deleted.')) {
          doCasualDelete();
        }
      } else {
        Alert.alert('Cancel match', 'Are you sure you want to cancel this match? It will be permanently deleted.', [
          { text: 'Keep', style: 'cancel' },
          { text: 'Cancel match', style: 'destructive', onPress: doCasualDelete },
        ]);
      }
    } else {
      if (Platform.OS === 'web') {
        if (window.confirm('Are you sure you want to permanently delete this match?')) {
          doCasualDelete();
        }
      } else {
        Alert.alert('Delete match', 'Are you sure you want to permanently delete this match?', [
          { text: 'Keep', style: 'cancel' },
          { text: 'Delete match', style: 'destructive', onPress: doCasualDelete },
        ]);
      }
    }
  };

  const handleCancelDelete = async () => {
    if (!currentUserId || deleteLoading) return;
    setDeleteLoading(true);
    try {
      await supabase.from('match_participants').update({ delete_requested: false }).eq('match_id', item.id).eq('user_id', currentUserId);
      updateFeedItem(item.id, (m) => ({
        ...m,
        participants: m.participants.map((p) =>
          p.user_id === currentUserId ? { ...p, delete_requested: false } : p
        ),
      }));
    } catch { /* swallow */ }
    finally { setDeleteLoading(false); }
  };

  const handleCancelMatch = () => {
    if (!currentUserId || deleteLoading) return;
    Alert.alert(
      'Cancel match',
      'Are you sure you want to cancel this match?',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel match',
          style: 'destructive',
          onPress: async () => {
            setDeleteLoading(true);
            try {
              await supabase.from('matches').update({ status: 'canceled' }).eq('id', item.id);
              // Remove pending match invite notifications so the invited opponent's inbox is clean
              await supabase
                .from('notifications')
                .delete()
                .eq('type', 'match_invite')
                .filter('data->>match_id', 'eq', item.id);
              updateFeedItem(item.id, (m) => ({ ...m, status: 'canceled' }));
            } catch { /* swallow */ }
            finally { setDeleteLoading(false); }
          },
        },
      ],
    );
  };

  const handleLeave = () => {
    if (!currentUserId || deleteLoading) return;
    Alert.alert(
      'Leave match?',
      'Are you sure you want to leave this match? The host can invite someone else.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setDeleteLoading(true);
            try {
              await supabase.from('match_participants').delete()
                .eq('match_id', item.id).eq('user_id', currentUserId);
              // Always touch matches to ensure all users' realtime subscriptions fire
              const matchUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
              if (item.status === 'confirmed') matchUpdate.status = 'pending';
              await supabase.from('matches').update(matchUpdate).eq('id', item.id);
              const { data: myProfile } = await supabase.from('profiles').select('username, full_name').eq('user_id', currentUserId).maybeSingle();
              const displayName = (myProfile as any)?.full_name ?? (myProfile as any)?.username ?? 'Your opponent';
              const notifBody = item.status === 'paused'
                ? 'They left while the match was paused.'
                : 'They left before the match started.';
              await supabase.from('notifications').insert({
                user_id: item.created_by,
                type: 'match_declined',
                title: `${displayName} left your match`,
                body: notifBody,
                data: { match_id: item.id, from_user_id: currentUserId },
              });
              animateAndRemove();
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not leave match.');
            } finally { setDeleteLoading(false); }
          },
        },
      ],
    );
  };

  if (!p1) return null;

  const isCompleted = item.status === 'completed';
  const myVpDelta = myParticipant?.vp_delta ?? 0;
  const isWin = myParticipant?.result === 'win';
  const vpChange =
    myVpDelta > 0 ? `+${myVpDelta}` : myVpDelta < 0 ? `${myVpDelta}` : '0';

  const statusLabel = item.status === 'pending' ? 'Pending' : item.status === 'confirmed' ? 'Confirmed' : item.status === 'in_progress' ? 'In progress' : item.status === 'paused' ? 'Paused' : item.status === 'completed' ? 'Completed' : item.status;

  const createdDate = new Date(item.created_at);
  const dateStr = createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const createdTime = createdDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const startedTime = item.started_at ? new Date(item.started_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;

  const gamesForDisplay = localGames
    .map((g) => ({ score_challenger: parseInt(g.score_challenger, 10) || 0, score_opponent: parseInt(g.score_opponent, 10) || 0 }))
    .filter((g) => g.score_challenger > 0 || g.score_opponent > 0);
  const { main: displayScoreMain, sub: displayScoreSub } = formatMatchScore(
    item.sport_name,
    gamesForDisplay,
    p1 ? getName(p1) : 'Challenger',
    p2 ? getName(p2) : 'Opponent'
  );
  const hasScore = gamesForDisplay.length > 0;
  const imagesList = (item.images ?? []) as MatchImage[];
  const mediaRowWidth = Dimensions.get('window').width - 2 * spacing.lg;
  const halfWidth = (mediaRowWidth - spacing.sm) / 2;

  return (
    <Animated.View style={{ opacity: cardAnim, transform: [{ scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1] }) }] }}>
    <View style={styles.feedCard}>
      {/* Header: Created by (left) + Sport (right) */}
      <View style={styles.stravaHeader}>
        <View style={styles.creatorBlock}>
          <View style={styles.creatorRow}>
            <Avatar
              initials={creator ? getInitials(creator) : '?'}
              avatarUrl={creatorAvatarUrl ?? creator?.avatar_url}
              size={24}
              colors={colors}
            />
            <Text style={styles.creatorLabel}>{creator ? getName(creator) : 'Unknown'}</Text>
          </View>
        </View>
        <View style={styles.sportBadge}>
          <Text style={styles.sportEmoji}>{SPORT_EMOJI[item.sport_name] ?? '🏆'}</Text>
          <Text style={styles.sportName}>{item.sport_name}</Text>
        </View>
        {onEditMatch && isParticipant && (
          <TouchableOpacity
            style={{ padding: spacing.xs }}
            onPress={() => onEditMatch(item)}
            hitSlop={8}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Timestamps: keep on one line when possible */}
      <View style={styles.timestampsRow}>
        <Text
          style={styles.timestampTextSingle}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {isScheduledFuture
            ? `Scheduled: ${new Date(item.scheduled_at!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${new Date(item.scheduled_at!).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
            : `${dateStr} · Created ${createdTime}${startedTime ? ` · Started ${startedTime}` : ''}`
          }
        </Text>
      </View>

      <View style={styles.playersRow}>
        <View style={styles.playerCol}>
          {is2v2 ? (
            // 2v2 left side: creator + teammate
            <View style={{ alignItems: 'center', gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-start' }}>
                {/* Creator */}
                <View style={{ alignItems: 'center', gap: 2, maxWidth: 58 }}>
                  <TouchableOpacity onPress={() => p1 && navigation.navigate('UserProfile', { userId: p1.user_id })} activeOpacity={0.7}>
                    <Avatar initials={p1 ? getInitials(p1) : '?'} avatarUrl={p1AvatarUrl ?? p1?.avatar_url} size={36} colors={colors} isWinner={isCompleted && p1?.result === 'win'} />
                  </TouchableOpacity>
                  <Text style={[styles.playerName, { fontSize: 9 }]} numberOfLines={1}>{p1 ? getName(p1) : '?'}</Text>
                  {isRanked && p1 && (item.status === 'pending' || item.status === 'confirmed') && (
                    <Text style={[typography.caption, { fontSize: 9, color: isReady(p1) ? colors.primary : colors.textSecondary }]}>{isReady(p1) ? '✓' : '—'}</Text>
                  )}
                </View>
                {/* Teammate slot */}
                <View style={{ alignItems: 'center', gap: 2, maxWidth: 58 }}>
                  {teammate ? (
                    <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { userId: teammate.user_id })} activeOpacity={0.7}>
                      <Avatar initials={getInitials(teammate)} avatarUrl={partner2AvatarUrl ?? teammate.avatar_url} size={36} colors={colors} isWinner={isCompleted && teammate.result === 'win'} />
                    </TouchableOpacity>
                  ) : item.status === 'pending' && onInviteOpponent && item.created_by === currentUserId ? (
                    <TouchableOpacity onPress={() => onInviteOpponent(item, 'teammate')} activeOpacity={0.8}>
                      <View style={{ position: 'relative' }}>
                        <Avatar initials="+" size={36} colors={colors} />
                        <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: colors.primary, borderRadius: 8, padding: 2 }}>
                          <Ionicons name="person-add" size={9} color={colors.textOnPrimary} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <Avatar initials="?" size={36} colors={colors} />
                  )}
                  <Text style={[styles.playerName, { fontSize: 9 }]} numberOfLines={1}>
                    {teammate ? getName(teammate) : 'TBD'}
                  </Text>
                  {isRanked && teammate && (item.status === 'pending' || item.status === 'confirmed') && (
                    <Text style={[typography.caption, { fontSize: 9, color: isReady(teammate) ? colors.primary : colors.textSecondary }]}>{isReady(teammate) ? '✓' : '—'}</Text>
                  )}
                </View>
              </View>
              {(() => {
                if (!currentUserId) return null;
                const onTeam1 = team1.some((p) => p.user_id === currentUserId);
                const onTeam2 = team2.some((p) => p.user_id === currentUserId);
                if (onTeam1 && !onTeam2) {
                  return <Text style={[typography.caption, { fontSize: 11, color: colors.primary, fontWeight: '500' }]}>Your Team</Text>;
                } else if (onTeam2 && !onTeam1) {
                  return <Text style={[typography.caption, { fontSize: 11, color: colors.error, fontWeight: '500' }]}>Opponent Team</Text>;
                }
                return null;
              })()}
            </View>
          ) : (
            // 1v1 left side
            <>
              <TouchableOpacity
                onPress={() => p1 && navigation.navigate('UserProfile', { userId: p1.user_id })}
                activeOpacity={0.7}
                style={{ alignItems: 'center', gap: spacing.xs }}
                disabled={!p1}
              >
                <Avatar
                  initials={p1 ? getInitials(p1) : '?'}
                  avatarUrl={p1AvatarUrl ?? p1?.avatar_url}
                  size={44}
                  colors={colors}
                  isWinner={isCompleted && p1?.result === 'win'}
                />
                <Text style={styles.playerName} numberOfLines={1}>
                  {getName(p1!)}
                </Text>
              </TouchableOpacity>
              {p1 && currentUserId && (() => {
                if (String(p1.user_id) === String(currentUserId)) return <Text style={[typography.caption, { fontSize: 11, color: colors.primary, fontWeight: '500' }]}>You</Text>;
                if (p2 && String(p2.user_id) === String(currentUserId)) return <Text style={[typography.caption, { fontSize: 11, color: colors.error, fontWeight: '500' }]}>Opponent</Text>;
                return null;
              })()}
              {isRanked && p1 && (item.status === 'pending' || item.status === 'confirmed') && (
                <Text style={[typography.caption, { fontSize: 12, fontWeight: '500', color: isReady(p1) ? colors.primary : colors.textSecondary }]}>
                  {isReady(p1) ? 'Ready ✓' : 'Not ready'}
                </Text>
              )}
            </>
          )}
        </View>
        <View style={styles.vsCol}>
          {isPractice ? (
            <View style={{ alignItems: 'center' }}>
              {isCompleted ? (
                <View style={{
                  backgroundColor: colors.primary + '18',
                  borderRadius: borderRadius.sm,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 4,
                  marginBottom: 2,
                  borderWidth: 1,
                  borderColor: colors.primary + '40',
                }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary, letterSpacing: 0.2 }}>
                    Practiced for {formatDurationDigital(durationMs)}
                  </Text>
                </View>
              ) : (isInProgress || isPaused) ? (
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primary, letterSpacing: 1, marginBottom: 2 }}>
                  {formatDurationDigital(durationMs)}
                </Text>
              ) : null}
              <Text style={[styles.vsText, { fontSize: 9 }]}>{isCompleted ? (p2 ? 'PRACTICED WITH' : 'SOLO') : (p2 ? 'PRACTICE WITH' : 'SOLO')}</Text>
            </View>
          ) : ((isCompleted || isInProgress || isPaused) && hasScore) || (isCompleted && !hasScore) ? (
            <View style={{ alignItems: 'center' }}>
              {isCompleted && participants.every((p) => p?.result === 'draw') ? (
                <View style={{ alignItems: 'center' }}>
                  <Text style={[styles.scoreText, { color: colors.textSecondary }]}>Draw</Text>
                  {hasScore && displayScoreMain ? <Text style={[typography.caption, { fontSize: 12, color: colors.textSecondary, marginTop: 2 }]}>{displayScoreMain}</Text> : null}
                  <Text style={styles.vsText}>VS</Text>
                  {durationMs > 0 && (
                    <Text style={[typography.caption, { fontSize: 13, fontWeight: '600', color: '#1E3A8A', marginTop: spacing.xs }]}>
                      {formatDurationDigital(durationMs)}
                    </Text>
                  )}
                </View>
              ) : (
                <>
                  {isCompleted && (() => {
                    const firstWinner = participants.find((p) => p?.result === 'win');
                    if (!firstWinner) return null;
                    const winLabel = is2v2
                      ? (firstWinner.role === 'challenger' ? 'Team 1 Wins!' : 'Team 2 Wins!')
                      : `${getName(firstWinner)} Wins!`;
                    return (
                      <View style={{
                        backgroundColor: colors.primary + '18',
                        borderRadius: borderRadius.sm,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 4,
                        marginBottom: hasScore ? 4 : 2,
                        borderWidth: 1,
                        borderColor: colors.primary + '40',
                      }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary, letterSpacing: 0.2 }}>
                          🏆 {winLabel}
                        </Text>
                      </View>
                    );
                  })()}
                  {hasScore && <Text style={styles.scoreText}>{displayScoreMain}</Text>}
                  {hasScore && displayScoreSub && (
                    <Text style={[typography.caption, { fontSize: 9, color: colors.textSecondary, marginTop: 1 }]}>
                      {displayScoreSub}
                    </Text>
                  )}
                  <Text style={styles.vsText}>VS</Text>
                  {durationMs > 0 && (
                    <Text style={[typography.caption, { fontSize: 13, fontWeight: '600', color: '#1E3A8A', marginTop: spacing.xs }]}>
                      {formatDurationDigital(durationMs)}
                    </Text>
                  )}
                </>
              )}
            </View>
          ) : !isRanked && !p2 && (item.status === 'pending' || item.status === 'confirmed') ? (
            <View style={{ alignItems: 'center', gap: 2 }}>
              <Text style={styles.vsText}>VS</Text>
              <Text style={[typography.caption, { fontSize: 11, color: colors.textSecondary, textAlign: 'center' }]}>
                Waiting for{'\n'}opponent to accept
              </Text>
            </View>
          ) : isRanked && (item.status === 'pending' || item.status === 'confirmed') ? (
            <View style={{ alignItems: 'center', gap: 2 }}>
              <Text style={styles.vsText}>VS</Text>
              <Text style={[typography.caption, { fontSize: 11, color: colors.textSecondary, fontWeight: '600' }]}>Ready {readyCount}/{requiredParticipants}</Text>
              {participants.filter((p) => isReady(p)).map((p) => (
                <Text key={p.user_id} style={[typography.caption, { fontSize: 10, color: colors.primary }]}>{getName(p)} ✓</Text>
              ))}
              {myParticipant && (
                isReady(myParticipant) ? (
                  readyCount >= requiredParticipants ? (
                    <View style={[styles.readyUpCenterButtonSmall, { backgroundColor: '#dcfce7' }]}>
                      <Ionicons name="checkmark-circle" size={14} color="#15803d" />
                      <Text style={[styles.readyUpCenterTextSmall, { color: '#15803d' }]}>All Ready!</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.readyUpCenterButtonSmall, readyLoading && { opacity: 0.6 }, styles.readyUpUnreadyBtn]}
                      onPress={handleUnready}
                      disabled={readyLoading}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close-circle" size={14} color="#b91c1c" />
                      <Text style={[styles.readyUpCenterTextSmall, { color: '#b91c1c' }]}>Unready</Text>
                    </TouchableOpacity>
                  )
                ) : (
                  <TouchableOpacity
                    style={[styles.readyUpCenterButtonSmall, readyLoading && { opacity: 0.6 }, styles.readyUpReadyBtn]}
                    onPress={handleReady}
                    disabled={readyLoading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-circle" size={14} color="#15803d" />
                    <Text style={[styles.readyUpCenterTextSmall, { color: '#15803d' }]}>Ready up</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.scoreText, { fontSize: 12, color: colors.textSecondary }]}>{statusLabel}</Text>
              <Text style={styles.vsText}>VS</Text>
              {(isInProgress || isPaused) && durationMs > 0 && (
                <Text
                  style={[
                    typography.caption,
                    {
                      fontSize: 13,
                      fontWeight: '600',
                      color: '#1E3A8A',
                      marginTop: spacing.xs,
                    },
                  ]}
                >
                  {formatDurationDigital(durationMs)}
                </Text>
              )}
            </View>
          )}
        </View>
        <View style={styles.playerCol}>
          {isPractice ? (() => {
            const PSIZE = 36;
            const inviteBadge = (
              <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: colors.primary, borderRadius: 8, padding: 3 }}>
                <Ionicons name="person-add" size={10} color={colors.textOnPrimary} />
              </View>
            );
            const partnerAvatar = (p: Participant, url: string | null) => (
              <TouchableOpacity key={p.user_id} onPress={() => navigation.navigate('UserProfile', { userId: p.user_id })} activeOpacity={0.7} style={{ alignItems: 'center', gap: 2 }}>
                <Avatar initials={getInitials(p)} avatarUrl={url ?? p.avatar_url} size={PSIZE} colors={colors} />
                <Text numberOfLines={1} style={{ fontSize: 10, color: colors.text, fontWeight: '500', maxWidth: PSIZE + 8, textAlign: 'center' }}>
                  {(p.full_name ?? p.username ?? '').split(' ')[0] || getInitials(p)}
                </Text>
              </TouchableOpacity>
            );
            const inviteBtn = onInviteOpponent && canControl ? (
              <TouchableOpacity onPress={() => onInviteOpponent(item)} activeOpacity={0.8} style={{ alignItems: 'center', gap: 2 }}>
                <View style={{ position: 'relative' }}>
                  <Avatar initials="?" size={PSIZE} colors={colors} />
                  {inviteBadge}
                </View>
                <Text style={{ fontSize: 10, color: colors.textSecondary, textAlign: 'center' }}>Invite</Text>
              </TouchableOpacity>
            ) : null;
            const n = practicePartners.length;
            if (n === 0) {
              // single invite button centered
              return inviteBtn ?? <Avatar initials="?" size={PSIZE} colors={colors} />;
            }
            if (n === 1) {
              // [P1] [+] side by side
              return (
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  {partnerAvatar(practicePartners[0], p2AvatarUrl)}
                  {inviteBtn}
                </View>
              );
            }
            if (n === 2) {
              // P1, P2, [+] stacked vertically
              return (
                <View style={{ alignItems: 'center', gap: 5 }}>
                  {partnerAvatar(practicePartners[0], p2AvatarUrl)}
                  {partnerAvatar(practicePartners[1], partner2AvatarUrl)}
                  {inviteBtn}
                </View>
              );
            }
            // n === 3: [P1] top centered, [P2][P3] bottom  △
            return (
              <View style={{ alignItems: 'center', gap: 5 }}>
                {partnerAvatar(practicePartners[0], p2AvatarUrl)}
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {partnerAvatar(practicePartners[1], partner2AvatarUrl)}
                  {partnerAvatar(practicePartners[2], partner3AvatarUrl)}
                </View>
              </View>
            );
          })() : is2v2 ? (
            // 2v2 right side: opponent1 + opponent2
            <View style={{ alignItems: 'center', gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-start' }}>
                {/* Opponent 1 */}
                <View style={{ alignItems: 'center', gap: 2, maxWidth: 58 }}>
                  {p2 ? (
                    <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { userId: p2.user_id })} activeOpacity={0.7}>
                      <Avatar initials={getInitials(p2)} avatarUrl={p2AvatarUrl ?? p2.avatar_url} size={36} colors={colors} isWinner={isCompleted && p2.result === 'win'} />
                    </TouchableOpacity>
                  ) : item.status === 'pending' && onInviteOpponent && item.created_by === currentUserId ? (
                    <TouchableOpacity onPress={() => onInviteOpponent(item, 'opponent')} activeOpacity={0.8}>
                      <View style={{ position: 'relative' }}>
                        <Avatar initials="+" size={36} colors={colors} />
                        <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: colors.primary, borderRadius: 8, padding: 2 }}>
                          <Ionicons name="person-add" size={9} color={colors.textOnPrimary} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <Avatar initials="?" size={36} colors={colors} />
                  )}
                  <Text style={[styles.playerName, { fontSize: 9 }]} numberOfLines={1}>
                    {p2 ? getName(p2) : 'TBD'}
                  </Text>
                  {isRanked && p2 && (item.status === 'pending' || item.status === 'confirmed') && (
                    <Text style={[typography.caption, { fontSize: 9, color: isReady(p2) ? colors.primary : colors.textSecondary }]}>{isReady(p2) ? '✓' : '—'}</Text>
                  )}
                </View>
                {/* Opponent 2 slot */}
                <View style={{ alignItems: 'center', gap: 2, maxWidth: 58 }}>
                  {opponent2 ? (
                    <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { userId: opponent2.user_id })} activeOpacity={0.7}>
                      <Avatar initials={getInitials(opponent2)} avatarUrl={partner3AvatarUrl ?? opponent2.avatar_url} size={36} colors={colors} isWinner={isCompleted && opponent2.result === 'win'} />
                    </TouchableOpacity>
                  ) : item.status === 'pending' && onInviteOpponent && item.created_by === currentUserId ? (
                    <TouchableOpacity onPress={() => onInviteOpponent(item, 'opponent_2')} activeOpacity={0.8}>
                      <View style={{ position: 'relative' }}>
                        <Avatar initials="+" size={36} colors={colors} />
                        <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: colors.primary, borderRadius: 8, padding: 2 }}>
                          <Ionicons name="person-add" size={9} color={colors.textOnPrimary} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <Avatar initials="?" size={36} colors={colors} />
                  )}
                  <Text style={[styles.playerName, { fontSize: 9 }]} numberOfLines={1}>
                    {opponent2 ? getName(opponent2) : 'TBD'}
                  </Text>
                  {isRanked && opponent2 && (item.status === 'pending' || item.status === 'confirmed') && (
                    <Text style={[typography.caption, { fontSize: 9, color: isReady(opponent2) ? colors.primary : colors.textSecondary }]}>{isReady(opponent2) ? '✓' : '—'}</Text>
                  )}
                </View>
              </View>
              {(() => {
                if (!currentUserId) return null;
                const onTeam1 = team1.some((p) => p.user_id === currentUserId);
                const onTeam2 = team2.some((p) => p.user_id === currentUserId);
                if (onTeam2 && !onTeam1) {
                  return <Text style={[typography.caption, { fontSize: 11, color: colors.primary, fontWeight: '500' }]}>Your Team</Text>;
                } else if (onTeam1 && !onTeam2) {
                  return <Text style={[typography.caption, { fontSize: 11, color: colors.error, fontWeight: '500' }]}>Opponent Team</Text>;
                }
                return null;
              })()}
            </View>
          ) : p2 ? (
            // 1v1 with opponent
            <>
              <TouchableOpacity
                onPress={() => navigation.navigate('UserProfile', { userId: p2.user_id })}
                activeOpacity={0.7}
                style={{ alignItems: 'center', gap: spacing.xs }}
              >
                <Avatar
                  initials={getInitials(p2)}
                  avatarUrl={p2AvatarUrl ?? p2.avatar_url}
                  size={44}
                  colors={colors}
                  isWinner={isCompleted && p2.result === 'win'}
                />
                <Text style={styles.playerName} numberOfLines={1}>
                  {getName(p2)}
                </Text>
              </TouchableOpacity>
              {p2 && currentUserId && (() => {
                if (String(p2.user_id) === String(currentUserId)) return <Text style={[typography.caption, { fontSize: 11, color: colors.primary, fontWeight: '500' }]}>You</Text>;
                if (p1 && String(p1.user_id) === String(currentUserId)) return <Text style={[typography.caption, { fontSize: 11, color: colors.error, fontWeight: '500' }]}>Opponent</Text>;
                return null;
              })()}
              {isRanked && p2 && (item.status === 'pending' || item.status === 'confirmed') && (
                <Text style={[typography.caption, { fontSize: 12, fontWeight: '500', color: isReady(p2) ? colors.primary : colors.textSecondary }]}>
                  {isReady(p2) ? 'Ready ✓' : 'Not ready'}
                </Text>
              )}
            </>
          ) : (
            // 1v1 no opponent yet
            <>
              {onInviteOpponent && canControl ? (
                <TouchableOpacity
                  onPress={() => onInviteOpponent(item, 'opponent')}
                  activeOpacity={0.8}
                  style={{ alignItems: 'center' }}
                >
                  <View style={{ position: 'relative' }}>
                    <Avatar initials="?" size={44} colors={colors} />
                    <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: colors.primary, borderRadius: 10, padding: 4 }}>
                      <Ionicons name="person-add" size={12} color={colors.textOnPrimary} />
                    </View>
                  </View>
                  <Text style={styles.playerName}>Invite</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <Avatar initials="?" size={44} colors={colors} />
                  <Text style={styles.playerName}>TBD</Text>
                </>
              )}
            </>
          )}
        </View>
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detailsLeft}>
          {item.match_type && (
            <View style={styles.detailItem}>
              <Ionicons name="trophy-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.detailText}>{(item.match_type || 'casual').charAt(0).toUpperCase() + (item.match_type || 'casual').slice(1)}</Text>
            </View>
          )}
          <View style={styles.detailItem}>
            <Ionicons name={item.is_public !== false ? 'globe-outline' : 'lock-closed-outline'} size={13} color={colors.textSecondary} />
            <Text style={styles.detailText}>{item.is_public !== false ? 'Public' : 'Private'}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="people-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.detailText}>{(item.match_format || '1v1') === '2v2' ? '2v2' : '1v1'}</Text>
          </View>
        </View>
        {isCompleted && myParticipant && item.match_type === 'ranked' && (
          <View style={[styles.vpPill, isWin ? styles.vpPillWin : styles.vpPillLoss]}>
            <Text style={[styles.vpPillText, isWin ? styles.vpTextWin : styles.vpTextLoss]}>{vpChange} VP</Text>
          </View>
        )}
      </View>

      {/* Start / Stop / Score editing / Delete */}
      {canControl && item.status !== 'canceled' && (
        <View style={styles.matchControlsRow}>
          <View style={styles.matchControlsButtonRow}>
            {item.status !== 'in_progress' && item.status !== 'completed' && item.status !== 'paused' && (
              <TouchableOpacity
                style={[styles.startButton, (startStopLoading || !canStart) && { opacity: 0.6 }]}
                onPress={handleStart}
                disabled={startStopLoading || !canStart}
                activeOpacity={0.8}
              >
                <Ionicons name="play" size={12} color={colors.primary} />
                <Text style={styles.startButtonText}>{item.match_type === 'practice' ? 'Start Practice' : 'Start Match'}</Text>
              </TouchableOpacity>
            )}
            {item.status === 'in_progress' && (
              <>
                <TouchableOpacity
                  style={[styles.pauseButton, startStopLoading && { opacity: 0.6 }]}
                  onPress={handlePause}
                  disabled={startStopLoading}
                  activeOpacity={0.8}
                >
                  <Ionicons name="pause" size={12} color={colors.error} />
                  <Text style={styles.pauseButtonText}>Pause</Text>
                </TouchableOpacity>
                {isPractice ? (
                  <TouchableOpacity
                    style={[styles.startButton, startStopLoading && { opacity: 0.6 }]}
                    onPress={handleFinish}
                    disabled={startStopLoading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="flag" size={12} color={colors.primary} />
                    <Text style={styles.startButtonText}>Finish</Text>
                  </TouchableOpacity>
                ) : isRanked && (() => {
                  const myFinishRequested = myParticipant?.finish_requested === true;
                  const finishCount = is2v2
                    ? (participants.some((p) => p.role === 'challenger' && p.finish_requested) ? 1 : 0) +
                      (participants.some((p) => p.role === 'opponent' && p.finish_requested) ? 1 : 0)
                    : participants.filter((p) => p.finish_requested).length;
                  if (myFinishRequested) {
                    return (
                      <View style={{ alignItems: 'center', gap: 2 }}>
                        <Text style={[typography.caption, { fontSize: 10, color: colors.textSecondary }]}>
                          Finish {finishCount}/2 confirmed
                        </Text>
                        <TouchableOpacity
                          style={[styles.deleteButton, startStopLoading && { opacity: 0.6 }]}
                          onPress={handleCancelFinishRequest}
                          disabled={startStopLoading}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="close-circle" size={12} color={colors.error} />
                          <Text style={styles.deleteButtonText}>Cancel finish</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }
                  return (
                    <TouchableOpacity
                      style={[styles.startButton, startStopLoading && { opacity: 0.6 }]}
                      onPress={handleFinish}
                      disabled={startStopLoading}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="flag" size={12} color={colors.primary} />
                      <Text style={styles.startButtonText}>
                        {finishCount > 0 ? `Finish (${finishCount}/2)` : 'Finish'}
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
              </>
            )}
            {item.status === 'paused' && (
              <>
                <TouchableOpacity
                  style={[styles.resumeButton, startStopLoading && { opacity: 0.6 }]}
                  onPress={handleResume}
                  disabled={startStopLoading}
                  activeOpacity={0.8}
                >
                  <Ionicons name="play" size={12} color={colors.success} />
                  <Text style={styles.resumeButtonText}>Resume</Text>
                </TouchableOpacity>
                {isRanked && !isPractice ? (() => {
                  const myFinishRequested = myParticipant?.finish_requested === true;
                  const finishCount = is2v2
                    ? (participants.some((p) => p.role === 'challenger' && p.finish_requested) ? 1 : 0) +
                      (participants.some((p) => p.role === 'opponent' && p.finish_requested) ? 1 : 0)
                    : participants.filter((p) => p.finish_requested).length;
                  if (myFinishRequested) {
                    return (
                      <View style={{ alignItems: 'center', gap: 2 }}>
                        <Text style={[typography.caption, { fontSize: 10, color: colors.textSecondary }]}>
                          Finish {finishCount}/2 confirmed
                        </Text>
                        <TouchableOpacity
                          style={[styles.deleteButton, startStopLoading && { opacity: 0.6 }]}
                          onPress={handleCancelFinishRequest}
                          disabled={startStopLoading}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="close-circle" size={12} color={colors.error} />
                          <Text style={styles.deleteButtonText}>Cancel finish</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }
                  return (
                    <TouchableOpacity
                      style={[styles.startButton, startStopLoading && { opacity: 0.6 }]}
                      onPress={handleFinish}
                      disabled={startStopLoading}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="flag" size={12} color={colors.primary} />
                      <Text style={styles.startButtonText}>
                        {finishCount > 0 ? `Finish (${finishCount}/2)` : 'Finish'}
                      </Text>
                    </TouchableOpacity>
                  );
                })() : (
                  <TouchableOpacity
                    style={[styles.startButton, startStopLoading && { opacity: 0.6 }]}
                    onPress={handleFinish}
                    disabled={startStopLoading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="flag" size={12} color={colors.primary} />
                    <Text style={styles.startButtonText}>Finish</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
            {(isRanked ? isParticipant : item.created_by === currentUserId) && (item.status === 'pending' || item.status === 'confirmed' || item.status === 'completed') && (() => {
              const myDeleteRequested = myParticipant?.delete_requested === true;
              const deleteCount = participants.filter((p) => p.delete_requested === true).length;
              const totalParticipants = participants.length;

              if (isRanked && myDeleteRequested) {
                return (
                  <View style={{ alignItems: 'center', gap: 2 }}>
                    <Text style={[typography.caption, { fontSize: 10, color: colors.textSecondary }]}>
                      Delete {deleteCount}/{totalParticipants} confirmed
                    </Text>
                    {participants.filter((p) => p.delete_requested === true).map((p) => (
                      <Text key={p.user_id} style={[typography.caption, { fontSize: 10, color: colors.error }]}>{getName(p)} ✓</Text>
                    ))}
                    <TouchableOpacity
                      style={[styles.deleteButton, deleteLoading && { opacity: 0.6 }]}
                      onPress={handleCancelDelete}
                      disabled={deleteLoading}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close-circle" size={12} color={colors.error} />
                      <Text style={styles.deleteButtonText}>Cancel delete</Text>
                    </TouchableOpacity>
                  </View>
                );
              }

              const isPendingState = item.status === 'pending' || item.status === 'confirmed';
              const cancelBtnIcon = isPendingState ? 'close-outline' : 'trash-outline';
              const cancelBtnLabel = isPendingState
                ? (isRanked && deleteCount > 0 ? `Cancel (${deleteCount}/${totalParticipants})` : 'Cancel')
                : (isRanked && deleteCount > 0 ? `Delete (${deleteCount}/${totalParticipants})` : 'Delete');

              return (
                <TouchableOpacity
                  style={[styles.deleteButton, deleteLoading && { opacity: 0.6 }]}
                  onPress={handleDelete}
                  disabled={deleteLoading}
                  activeOpacity={0.8}
                >
                  <Ionicons name={cancelBtnIcon} size={12} color={colors.error} />
                  <Text style={styles.deleteButtonText}>{cancelBtnLabel}</Text>
                </TouchableOpacity>
              );
            })()}
            {!isRanked && !isPractice && isParticipant && item.created_by !== currentUserId && (item.status === 'pending' || item.status === 'confirmed' || item.status === 'paused') && (
              <TouchableOpacity
                style={[styles.deleteButton, deleteLoading && { opacity: 0.6 }]}
                onPress={handleLeave}
                disabled={deleteLoading}
                activeOpacity={0.8}
              >
                <Ionicons name="exit-outline" size={12} color={colors.error} />
                <Text style={styles.deleteButtonText}>Leave</Text>
              </TouchableOpacity>
            )}
          </View>
          {(item.status === 'in_progress' || item.status === 'paused') && !isPractice && (
            <View style={styles.gamesEditSection}>
                {/* Player name header — aligns above each input column */}
                <View style={styles.scoreHeaderRow}>
                  <Text style={styles.scoreHeaderName} numberOfLines={1}>{p1 ? getName(p1) : 'Challenger'}</Text>
                  <View style={{ width: 20 }} />
                  <Text style={styles.scoreHeaderName} numberOfLines={1}>{p2 ? getName(p2) : 'Opponent'}</Text>
                </View>
                {localGames.map((game, idx) => (
                  <View key={idx} style={styles.gameRow}>
                    <View style={styles.gameLabelWrap}>
                      <Text style={styles.gameLabelText}>G{idx + 1}</Text>
                    </View>
                    <TextInput
                      style={[styles.scoreInput, !canEditChallenger && styles.scoreInputDisabled]}
                      value={game.score_challenger}
                      onChangeText={(t) => handleScoreChange(idx, 'score_challenger', t)}
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      editable={canEditChallenger}
                    />
                    <Text style={styles.scoreEditVs}>–</Text>
                    <TextInput
                      style={[styles.scoreInput, !canEditOpponent && styles.scoreInputDisabled]}
                      value={game.score_opponent}
                      onChangeText={(t) => handleScoreChange(idx, 'score_opponent', t)}
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      editable={canEditOpponent}
                    />
                  </View>
                ))}
                {saveValidationError != null && (
                  <View style={[styles.validationErrorBanner, { backgroundColor: colors.error + '18', borderColor: colors.error }]}>
                    <Text style={[styles.validationErrorTitle, { color: colors.error }]}>Scoring may be incorrect</Text>
                    <Text style={styles.validationErrorText}>{saveValidationError}</Text>
                    <View style={styles.validationErrorActions}>
                      <TouchableOpacity style={styles.validationCancelBtn} onPress={() => setSaveValidationError(null)} activeOpacity={0.8}>
                        <Text style={[styles.validationCancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.validationSaveAnywayBtn, { backgroundColor: colors.error }]} onPress={handleSaveAnyway} activeOpacity={0.8}>
                        <Text style={styles.validationSaveAnywayBtnText}>Save anyway</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                <View style={styles.gameActionsRow}>
                  <TouchableOpacity style={styles.addGameBtn} onPress={handleAddGame} activeOpacity={0.8}>
                    <Ionicons name="add" size={12} color={colors.primary} />
                    <Text style={styles.addGameBtnText}>Add game</Text>
                  </TouchableOpacity>
                  {saving && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <ActivityIndicator size="small" color={colors.textSecondary} />
                      <Text style={[typography.caption, { fontSize: 10, color: colors.textSecondary }]}>Saving...</Text>
                    </View>
                  )}
                </View>
              </View>
          )}
        </View>
      )}

      {/* Horizontal scrollable media row: location → photos → add photo */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm, marginHorizontal: -spacing.md }} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md }}>
        {(item.location_lat != null || item.location_name != null || !!isParticipant) && (
          <TouchableOpacity
            style={[styles.mapTile, { width: halfWidth }]}
            activeOpacity={item.location_lat != null ? 0.7 : (isParticipant ? 0.8 : 1)}
            onPress={() => {
              if (item.location_lat != null && item.location_lng != null) {
                const label = encodeURIComponent(item.location_name || 'Match Location');
                const url = Platform.select({
                  ios: `maps:0,0?q=${label}&ll=${item.location_lat},${item.location_lng}`,
                  android: `geo:${item.location_lat},${item.location_lng}?q=${item.location_lat},${item.location_lng}(${label})`,
                  default: `https://www.google.com/maps/dir/?api=1&destination=${item.location_lat},${item.location_lng}`,
                });
                Linking.openURL(url!);
              } else if (isParticipant) {
                setLocationPickerVisible(true);
              }
            }}
          >
            <View style={[styles.mapPlaceholder, { width: halfWidth, height: halfWidth * 0.75 }]}>
              {item.location_lat != null && item.location_lng != null && MapPreview != null ? (
                <MapPreview latitude={item.location_lat} longitude={item.location_lng} />
              ) : (
                <>
                  <View style={styles.mapGridLines}>
                    <View style={[styles.mapGridH, { top: '25%' }]} />
                    <View style={[styles.mapGridH, { top: '50%' }]} />
                    <View style={[styles.mapGridH, { top: '75%' }]} />
                    <View style={[styles.mapGridV, { left: '25%' }]} />
                    <View style={[styles.mapGridV, { left: '50%' }]} />
                    <View style={[styles.mapGridV, { left: '75%' }]} />
                  </View>
                  <View style={styles.mapPinContainer}>
                    <Ionicons name="location" size={24} color={colors.primary} />
                  </View>
                </>
              )}
              <View style={styles.mapLabelContainer}>
                <View style={styles.mapLabelPill}>
                  <Ionicons
                    name={item.location_lat != null ? 'navigate-outline' : (isParticipant ? 'add-outline' : 'location-outline')}
                    size={10}
                    color={colors.textOnPrimary}
                  />
                  <Text style={styles.mapLabelText} numberOfLines={1}>
                    {item.location_name || (isParticipant ? 'Add location' : 'Location')}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
        {imagesList.map((img) => (
          <TouchableOpacity
            key={img.id}
            activeOpacity={0.9}
            onPress={() => {
              if (imageUrls[img.id]) {
                setLightboxUrl(imageUrls[img.id]);
                setLightboxImgId(img.id);
              }
            }}
            style={{ width: halfWidth, height: halfWidth * 0.75, borderRadius: borderRadius.md, overflow: 'hidden', backgroundColor: colors.background }}
          >
            {imageUrls[img.id] ? (
              <Image source={{ uri: imageUrls[img.id] }} style={{ width: halfWidth, height: halfWidth * 0.75 }} resizeMode="cover" />
            ) : (
              <View style={{ width: halfWidth, height: halfWidth * 0.75, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="image-outline" size={28} color={colors.textSecondary} />
              </View>
            )}
            {/* Removed inline delete overlay — delete is now in the lightbox */}
            {false && (
              <View />
            )}
          </TouchableOpacity>
        ))}
        {isParticipant ? (
          <TouchableOpacity style={[styles.addMediaTile, { width: halfWidth, height: halfWidth * 0.75 }]} onPress={handleAddImage} disabled={saving} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={32} color={colors.primary} />
            <Text style={styles.addMediaText}>Add photo</Text>
          </TouchableOpacity>
        ) : imagesList.length === 0 ? (
          <View style={[styles.addMediaTile, { width: halfWidth, height: halfWidth * 0.75, opacity: 0.5 }]}>
            <Ionicons name="images-outline" size={32} color={colors.textSecondary} />
            <Text style={[styles.addMediaText, { color: colors.textSecondary }]}>No photos</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleToggleLike} activeOpacity={0.8}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? colors.primary : colors.textSecondary} />
          {likesCount > 0 ? (
            <TouchableOpacity onPress={() => setLikersModalVisible(true)} activeOpacity={0.8}>
              <Text style={[styles.actionLabel, liked && { color: colors.primary, fontWeight: '600' }]}>
                {likesCount} {likesCount === 1 ? 'like' : 'likes'}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.actionLabel, liked && { color: colors.primary, fontWeight: '600' }]}>Like</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtnCenter}
          onPress={() => setCommentsVisible((v) => !v)}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-outline" size={17} color={colors.textSecondary} />
          <Text style={styles.actionLabel}>{commentsCount > 0 ? `${commentsCount} ` : ''}{commentsCount === 1 ? 'Comment' : 'Comments'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.8}>
          <Ionicons name="share-outline" size={17} color={colors.textSecondary} />
          <Text style={styles.actionLabel}>Share</Text>
        </TouchableOpacity>
      </View>

      {commentsVisible && (
        <View style={styles.commentsSection}>
          {commentsLoading ? (
            <View style={styles.commentsLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <>
              {comments.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.commentRow}
                  onPress={() => navigation.navigate('UserProfile', { userId: c.user_id })}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                    <Text style={styles.commentAuthor}>
                      {c.full_name || c.username || 'Someone'}
                    </Text>
                    <Text style={styles.commentDate}>
                      {c.created_at ? (() => { const d = new Date(c.created_at); const now = new Date(); const diffH = (now.getTime() - d.getTime()) / 3600000; if (diffH < 1) return `${Math.max(1, Math.floor(diffH * 60))}m ago`; if (diffH < 24) return `${Math.floor(diffH)}h ago`; return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); })() : ''}
                    </Text>
                  </View>
                  <Text style={styles.commentBody}>{c.body}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
          {currentUserId && (
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor={colors.textSecondary}
                value={commentBody}
                onChangeText={setCommentBody}
                maxLength={500}
                editable={!commentPosting}
                returnKeyType="send"
                onSubmitEditing={handlePostComment}
              />
              <TouchableOpacity
                onPress={handlePostComment}
                disabled={!commentBody.trim() || commentPosting}
                style={[styles.commentPostBtn, (!commentBody.trim() || commentPosting) && styles.commentPostBtnDisabled]}
                activeOpacity={0.8}
              >
                {commentPosting ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.commentPostBtnText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <Modal visible={likersModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setLikersModalVisible(false)}
          />
          <View style={styles.likersCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Likes</Text>
              <TouchableOpacity onPress={() => setLikersModalVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {likersLoading ? (
              <View style={styles.likersLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              <ScrollView style={styles.likersList} keyboardShouldPersistTaps="handled">
                {likers.map((u) => (
                  <TouchableOpacity
                    key={u.user_id}
                    style={styles.likerRow}
                    onPress={() => {
                      setLikersModalVisible(false);
                      navigation.navigate('UserProfile', { userId: u.user_id });
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.likerName}>{u.full_name || u.username || 'Someone'}</Text>
                    {u.username && <Text style={styles.likerHandle}>@{u.username}</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>

    <Modal visible={winnerPickerVisible} transparent animationType="fade">
      <View style={styles.winnerPickerBackdrop}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={() => setWinnerPickerVisible(false)}
        />
        <View style={styles.winnerPickerCard}>
          <Text style={styles.winnerPickerTitle}>Choose winner</Text>
          <Text style={styles.winnerPickerSubtitle}>Who won this match?</Text>
          <View style={styles.winnerPickerOptions}>
            {is2v2 ? (
              <>
                {/* 2v2: pick a team */}
                {p1 && (
                  <TouchableOpacity
                    style={[styles.winnerPickerOption, winnerSelection === p1.user_id && styles.winnerPickerOptionSel]}
                    onPress={() => selectWinner(p1.user_id)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', gap: 4, marginBottom: 4 }}>
                      <Avatar initials={p1 ? getInitials(p1) : '?'} avatarUrl={p1AvatarUrl ?? p1?.avatar_url} size={32} colors={colors} isWinner={winnerSelection === p1.user_id} />
                      {teammate && <Avatar initials={getInitials(teammate)} avatarUrl={partner2AvatarUrl ?? teammate.avatar_url} size={32} colors={colors} isWinner={winnerSelection === p1.user_id} />}
                    </View>
                    <Text style={[styles.winnerPickerName, winnerSelection === p1.user_id && { color: colors.primary }]}>
                      {currentUserId && team1.some((p) => p.user_id === currentUserId) ? 'Your team' : 'Team 1'}
                    </Text>
                    <Text style={styles.winnerPickerRole}>Challengers</Text>
                  </TouchableOpacity>
                )}
                {p2 && (
                  <TouchableOpacity
                    style={[styles.winnerPickerOption, winnerSelection === p2.user_id && styles.winnerPickerOptionSel]}
                    onPress={() => selectWinner(p2.user_id)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', gap: 4, marginBottom: 4 }}>
                      <Avatar initials={getInitials(p2)} avatarUrl={p2AvatarUrl ?? p2.avatar_url} size={32} colors={colors} isWinner={winnerSelection === p2.user_id} />
                      {opponent2 && <Avatar initials={getInitials(opponent2)} avatarUrl={partner3AvatarUrl ?? opponent2.avatar_url} size={32} colors={colors} isWinner={winnerSelection === p2.user_id} />}
                    </View>
                    <Text style={[styles.winnerPickerName, winnerSelection === p2.user_id && { color: colors.primary }]}>
                      {currentUserId && team2.some((p) => p.user_id === currentUserId) ? 'Your team' : 'Other team'}
                    </Text>
                    <Text style={styles.winnerPickerRole}>Opponents</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                {/* 1v1: pick a player */}
                {p1 && (
                  <TouchableOpacity
                    style={[styles.winnerPickerOption, winnerSelection === p1.user_id && styles.winnerPickerOptionSel]}
                    onPress={() => selectWinner(p1.user_id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.winnerPickerAvatarWrap, winnerSelection === p1.user_id && { borderWidth: 2, borderColor: colors.primary }]}>
                      {p1AvatarUrl ? (
                        <Image source={{ uri: p1AvatarUrl }} style={styles.winnerPickerAvatarImg} />
                      ) : (
                        <View style={[styles.winnerPickerAvatar, { backgroundColor: colors.primary }]}>
                          <Text style={[styles.winnerPickerInitials, { color: colors.textOnPrimary }]}>{getInitials(p1)}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.winnerPickerName, winnerSelection === p1.user_id && { color: colors.primary }]}>{getName(p1)}</Text>
                    <Text style={styles.winnerPickerRole}>Challenger</Text>
                  </TouchableOpacity>
                )}
                {p2 && (
                  <TouchableOpacity
                    style={[styles.winnerPickerOption, winnerSelection === p2.user_id && styles.winnerPickerOptionSel]}
                    onPress={() => selectWinner(p2.user_id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.winnerPickerAvatarWrap, winnerSelection === p2.user_id && { borderWidth: 2, borderColor: colors.primary }]}>
                      {p2AvatarUrl ? (
                        <Image source={{ uri: p2AvatarUrl }} style={styles.winnerPickerAvatarImg} />
                      ) : (
                        <View style={[styles.winnerPickerAvatar, { backgroundColor: colors.primary }]}>
                          <Text style={[styles.winnerPickerInitials, { color: colors.textOnPrimary }]}>{getInitials(p2)}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.winnerPickerName, winnerSelection === p2.user_id && { color: colors.primary }]}>{getName(p2)}</Text>
                    <Text style={styles.winnerPickerRole}>Opponent</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
            <TouchableOpacity
              style={[styles.winnerPickerOption, winnerSelection === null && styles.winnerPickerOptionSel]}
              onPress={() => selectWinner(null)}
              activeOpacity={0.8}
            >
              <View style={[styles.winnerPickerAvatarWrap, styles.winnerPickerDrawWrap, winnerSelection === null && { borderColor: colors.primary }]}>
                <Ionicons name="remove-circle-outline" size={36} color={winnerSelection === null ? colors.primary : colors.textSecondary} />
              </View>
              <Text style={[styles.winnerPickerName, winnerSelection === null && { color: colors.primary }]}>Draw</Text>
              <Text style={styles.winnerPickerRole}>Tie</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.winnerPickerConfirm} onPress={confirmWinner} activeOpacity={0.8}>
            <Text style={styles.winnerPickerConfirmText}>Confirm</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.winnerPickerCancel} onPress={() => setWinnerPickerVisible(false)}>
            <Text style={[styles.winnerPickerCancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    <LocationPickerModal
      visible={locationPickerVisible}
      onClose={() => setLocationPickerVisible(false)}
      onConfirm={handlePickLocation}
      colors={colors}
    />

    {/* Photo lightbox */}
    <Modal visible={!!lightboxUrl} transparent animationType="fade" onRequestClose={() => { setLightboxUrl(null); setLightboxImgId(null); }}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' }}>
        {/* Close */}
        <Pressable
          onPress={() => { setLightboxUrl(null); setLightboxImgId(null); }}
          style={{ position: 'absolute', top: 52, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 }}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        {/* Delete button for participants */}
        {isParticipant && lightboxImgId && (
          <Pressable
            onPress={() => {
              const img = imagesList.find((i) => i.id === lightboxImgId);
              if (img) handleDeleteImage(img);
            }}
            style={{ position: 'absolute', top: 52, left: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(229,57,53,0.85)', borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Delete</Text>
          </Pressable>
        )}
        {/* Zoomable image */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          minimumZoomScale={1}
          maximumZoomScale={5}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          centerContent
        >
          {lightboxUrl ? (
            <Image
              source={{ uri: lightboxUrl }}
              style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.8 }}
              resizeMode="contain"
            />
          ) : null}
        </ScrollView>
      </View>
    </Modal>

    {/* Delete toast */}
    {deleteToast && (
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: 14,
          alignSelf: 'center',
          backgroundColor: 'rgba(0,0,0,0.75)',
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          opacity: deleteToastAnim,
        }}
      >
        <Ionicons name="checkmark-circle" size={12} color="#4ade80" />
        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>Photo deleted</Text>
      </Animated.View>
    )}
    </Animated.View>
  );
}

function createHomeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      paddingBottom: spacing.sm,
    },
    topBarIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topBarTitle: { ...typography.heading, color: colors.text },
    topBarRight: { flexDirection: 'row', gap: spacing.sm },
    badge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.error,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    badgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
    switcherRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    switcherTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
    },
    switcherTabActive: { backgroundColor: colors.primary },
    switcherLabel: { ...typography.label, color: colors.textSecondary },
    switcherLabelActive: { color: colors.textOnPrimary },
    switcherHint: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.md,
      marginHorizontal: spacing.lg,
    },
    listContent: { paddingBottom: spacing.xxl, paddingHorizontal: spacing.lg },
    emptyFeed: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },

    feedCard: {
      backgroundColor: colors.cardBg,
      borderRadius: borderRadius.lg,
      paddingTop: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stravaHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
      paddingBottom: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    creatorBlock: { flex: 1 },
    creatorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    creatorLabel: { ...typography.caption, fontSize: 12, lineHeight: 18, color: colors.textSecondary },
    timestampsRow: {
      flexDirection: 'column',
      gap: spacing.xs,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
      paddingBottom: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      width: '100%',
    },
    timestampText: { ...typography.caption, fontSize: 13, color: colors.textSecondary },
    timestampTextSingle: { ...typography.caption, fontSize: 11, color: colors.textSecondary },
    sportBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginHorizontal: spacing.sm,
    },
    mapTile: { borderRadius: borderRadius.md, overflow: 'hidden' },
    mediaTile: { width: 140, height: 140, borderRadius: borderRadius.md, overflow: 'hidden' },
    mediaImage: { width: 140, height: 140, backgroundColor: colors.background },
    mediaPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    addMediaTileWrap: { height: 140 },
    addMediaTile: {
      flex: 1,
      height: 140,
      borderRadius: borderRadius.md,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addMediaText: { ...typography.caption, fontSize: 11, color: colors.primary, marginTop: spacing.xs },
    gamesEditSection: { marginTop: spacing.sm, width: '100%', alignItems: 'center' },
    scoreHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: 4 },
    scoreHeaderName: { ...typography.label, fontSize: 11, color: colors.textSecondary, width: 48, textAlign: 'center' },
    gameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.xs },
    gameLabelWrap: { width: 0, alignItems: 'flex-end' as const, overflow: 'visible' as const },
    gameLabelText: { ...typography.label, fontSize: 11, color: colors.textSecondary, marginRight: 4, width: 24 },
    scoreCol: { alignItems: 'center', gap: 2 },
    scorePlayerLabel: { ...typography.caption, fontSize: 12, fontWeight: '600', color: colors.text },
    validationErrorBanner: {
      width: '100%',
      padding: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      marginBottom: spacing.sm,
    },
    validationErrorTitle: { ...typography.label, fontSize: 13, marginBottom: spacing.xs },
    validationErrorText: { ...typography.caption, fontSize: 12, color: colors.text, marginBottom: spacing.sm },
    validationErrorActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
    validationCancelBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    validationCancelBtnText: { ...typography.label, fontSize: 14 },
    validationSaveAnywayBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.md },
    validationSaveAnywayBtnText: { ...typography.label, fontSize: 14, color: '#FFF' },
    gameActionsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: spacing.sm, width: '100%' },
    addGameBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: borderRadius.sm,
      minWidth: 82,
    },
    addGameBtnText: { ...typography.label, fontSize: 10, color: colors.primary },
    playersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.lg,
      marginTop: spacing.md,
    },
    playerCol: { flex: 1, alignItems: 'center', gap: spacing.xs },
    playerName: { ...typography.label, color: colors.text, textAlign: 'center' },
    vsCol: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
    vsText: {
      ...typography.caption,
      color: colors.text,
      fontWeight: '700',
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    scoreText: { ...typography.heading, fontSize: 14, color: colors.text },

    sportRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    sportEmoji: { fontSize: 16, lineHeight: 18 },
    sportName: { ...typography.label, color: colors.primary, textTransform: 'uppercase', lineHeight: 18 },
    vpPill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.full
    },
    vpPillWin: { backgroundColor: 'rgba(45,106,45,0.12)' },
    vpPillLoss: { backgroundColor: 'rgba(185,28,28,0.1)' },
    vpPillText: { ...typography.label, fontSize: 11 },
    vpTextWin: { color: colors.success },
    vpTextLoss: { color: colors.error },

    detailsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      paddingTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    detailsLeft: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    detailItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    detailText: { ...typography.caption, fontSize: 12, color: colors.textSecondary },
    readyUpReadyBtn: { backgroundColor: '#dcfce7' },
    readyUpUnreadyBtn: { backgroundColor: '#fecaca' },
    matchControlsRow: {
      flexDirection: 'column',
      alignItems: 'center',
      marginBottom: spacing.sm,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    matchControlsButtonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      marginBottom: 0,
    },
    startButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.primary,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: borderRadius.sm,
      minWidth: 82,
    },
    startButtonText: { ...typography.label, fontSize: 10, color: colors.primary },
    readyUpCenterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
      borderRadius: borderRadius.md,
      marginTop: 4,
    },
    readyUpCenterText: { ...typography.label, fontSize: 14, fontWeight: '600', color: colors.textOnPrimary },
    readyUpCenterButtonSmall: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
      marginTop: spacing.sm,
    },
    readyUpCenterTextSmall: { ...typography.label, fontSize: 11, fontWeight: '600', color: colors.textOnPrimary },
    stopButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.error,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
    },
    stopButtonText: { ...typography.label, color: '#FFF' },
    pauseButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.error,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: borderRadius.sm,
      minWidth: 82,
    },
    pauseButtonText: { ...typography.label, fontSize: 10, color: colors.error },
    resumeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.success,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: borderRadius.sm,
      minWidth: 82,
    },
    resumeButtonText: { ...typography.label, fontSize: 10, color: colors.success },
    scoreEditRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    scoreInput: {
      width: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.sm,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
      fontSize: 16,
      fontWeight: '600' as const,
      color: colors.text,
      backgroundColor: colors.background,
      textAlign: 'center' as const,
    },
    scoreInputDisabled: { opacity: 0.35, backgroundColor: colors.cardBg },
    scoreEditVs: { ...typography.label, color: colors.textSecondary, width: 20, textAlign: 'center' as const },
    saveScoreBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.sm,
    },
    saveScoreBtnDisabled: { opacity: 0.8 },
    saveScoreBtnText: { ...typography.label, fontSize: 11, color: colors.textOnPrimary },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingHorizontal: 9,
      paddingVertical: 5,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.error,
      borderRadius: borderRadius.sm,
      minWidth: 82,
    },
    deleteButtonText: { ...typography.label, fontSize: 10, color: colors.error },

    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginBottom: spacing.sm,
    },
    locationText: { ...typography.caption, fontSize: 12, color: colors.textSecondary },

    mapCard: {
      marginBottom: spacing.sm,
      borderRadius: borderRadius.md,
      overflow: 'hidden',
    },
    mapPlaceholder: {
      height: 140,
      backgroundColor: colors.background,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      overflow: 'hidden',
    },
    mapGridLines: {
      ...StyleSheet.absoluteFillObject,
    },
    mapGridH: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: colors.divider,
    },
    mapGridV: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: colors.divider,
    },
    mapPinContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    mapLabelContainer: {
      position: 'absolute',
      bottom: spacing.sm,
      left: spacing.sm,
      right: spacing.sm,
      alignItems: 'flex-start',
    },
    mapLabelPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: borderRadius.full,
      maxWidth: '100%',
    },
    mapLabelText: {
      ...typography.caption,
      fontSize: 11,
      fontWeight: '600',
      color: colors.textOnPrimary,
      flexShrink: 1,
    },

    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    actionBtnCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
    actionLabel: { ...typography.caption, fontSize: 11, color: colors.textSecondary },
    commentsSection: {
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    commentsLoading: { paddingVertical: spacing.md, alignItems: 'center' },
    commentRow: {
      marginBottom: 2,
      paddingVertical: 3,
      paddingLeft: spacing.sm,
    },
    commentAuthor: { ...typography.label, fontSize: 12, color: colors.primary, fontWeight: '600' },
    commentDate: { ...typography.caption, fontSize: 11, color: colors.textSecondary },
    commentBody: { ...typography.body, fontSize: 12, color: colors.text },
    commentInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    commentInput: {
      flex: 1,
      height: 30,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.sm,
      paddingTop: 0,
      paddingBottom: 0,
      fontSize: 12,
      color: colors.text,
      backgroundColor: colors.background,
      textAlignVertical: 'center',
    },
    commentPostBtn: {
      height: 30,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    commentPostBtnDisabled: { opacity: 0.5 },
    commentPostBtnText: { ...typography.caption, fontSize: 12, color: colors.textOnPrimary, fontWeight: '600' },
    likersCard: {
      backgroundColor: colors.cardBg,
      marginHorizontal: spacing.lg,
      marginTop: 100,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      maxHeight: '70%',
      borderWidth: 1,
      borderColor: colors.border,
    },
    likersLoading: { paddingVertical: spacing.xl, alignItems: 'center' },
    likersList: { maxHeight: 300 },
    likerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      gap: spacing.sm,
    },
    likerName: { ...typography.body, color: colors.text, fontWeight: '600', flex: 1 },
    likerHandle: { ...typography.caption, color: colors.textSecondary },

    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-start',
    },
    modalCard: {
      backgroundColor: colors.cardBg,
      marginTop: 60,
      marginHorizontal: spacing.lg,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      maxHeight: '70%',
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    modalTitle: { ...typography.heading, color: colors.text },
    searchInput: {
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.background,
      color: colors.text,
      marginBottom: spacing.md,
    },
    suggestedTitle: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
    suggestedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    suggestedName: { ...typography.body, color: colors.text, flex: 1 },
    suggestedHandle: { ...typography.caption, color: colors.textSecondary },
    addBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
    },
    addBtnText: { ...typography.label, color: colors.textOnPrimary },

    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },

    /* ---- Notifications modal ---- */
    notifModalCard: {
      backgroundColor: colors.cardBg,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl,
      maxHeight: '85%',
    },
    notifCard: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    notifIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notifContent: { flex: 1 },
    notifTitle: { ...typography.body, fontSize: 14, fontWeight: '600', color: colors.text },
    notifTitleUnread: { fontWeight: '700' },
    notifBody: { ...typography.caption, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    notifTime: { ...typography.caption, fontSize: 11, color: colors.border, marginTop: 4 },
    notifActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    notifAccept: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
    },
    notifAcceptText: { ...typography.label, color: colors.textOnPrimary },
    notifDecline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.error,
    },
    notifDeclineText: { ...typography.label, color: colors.error },
    notifUnreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginTop: 6,
    },
    winnerPickerBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    winnerPickerCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      width: '100%',
      maxWidth: 340,
      borderWidth: 1,
      borderColor: colors.border,
    },
    winnerPickerTitle: { ...typography.heading, color: colors.text, textAlign: 'center', marginBottom: spacing.xs },
    winnerPickerSubtitle: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
    winnerPickerOptions: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginBottom: spacing.lg },
    winnerPickerOption: { alignItems: 'center', flex: 1 },
    winnerPickerOptionSel: { },
    winnerPickerAvatarWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.background,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
      overflow: 'hidden',
    },
    winnerPickerAvatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
    winnerPickerAvatarImg: { width: 72, height: 72, borderRadius: 36 },
    winnerPickerDrawWrap: { borderStyle: 'dashed' },
    winnerPickerInitials: { fontSize: 24, fontWeight: '700' },
    winnerPickerName: { ...typography.body, fontWeight: '600', color: colors.text, textAlign: 'center' },
    winnerPickerRole: { ...typography.caption, fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    winnerPickerConfirm: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    winnerPickerConfirmText: { ...typography.heading, fontSize: 16, color: colors.textOnPrimary },
    winnerPickerCancel: { paddingVertical: spacing.sm, alignItems: 'center' },
    winnerPickerCancelText: { ...typography.label, fontSize: 14 },
  });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function HomeScreen() {
  const { colors, mode: themeMode } = useTheme();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const route = useRoute<RouteProp<TabParamList, 'Home'>>();
  const styles = useMemo(() => createHomeStyles(colors), [colors]);
  const [feedMode, setFeedMode] = useState<FeedMode>('my');
  const [pendingScrollMatchId, setPendingScrollMatchId] = useState<string | null>(null);
  const [notifsVisible, setNotifsVisible] = useState(false);
  const navigation = useNavigation<any>();
  const feedListRef = useRef<FlatList>(null);
  const notifSlideAnim = useRef(new Animated.Value(-400)).current;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [preferredSports, setPreferredSports] = useState<string[]>([]);
  const [feedItems, setFeedItems] = useState<FeedMatch[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadDmCount, setUnreadDmCount] = useState(0);

  useEffect(() => {
    if (notifsVisible) {
      notifSlideAnim.setValue(-400);
      Animated.spring(notifSlideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    }
  }, [notifsVisible]);

  const closeNotifications = useCallback(() => {
    Animated.timing(notifSlideAnim, {
      toValue: -400,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setNotifsVisible(false);
    });
  }, []);

  const [inviteOpponentMatch, setInviteOpponentMatch] = useState<FeedMatch | null>(null);
  const [inviteSlot, setInviteSlot] = useState<'opponent' | 'teammate' | 'opponent_2'>('opponent');
  const [selectedInviteUser, setSelectedInviteUser] = useState<SearchedUser | null>(null);
  const [editMatch, setEditMatch] = useState<FeedMatch | null>(null);
  const [followStates, setFollowStates] = useState<Record<string, 'none' | 'pending' | 'accepted'>>({});
  const [teamPickInvite, setTeamPickInvite] = useState<{ notif: NotificationItem; matchId: string } | null>(null);

  const refreshFollowStates = useCallback(async (userId?: string) => {
    const uid = userId || currentUserId;
    if (!uid) return;
    const { data: fRows } = await supabase
      .from('follows')
      .select('followed_id, status')
      .eq('follower_id', uid);
    if (fRows) {
      const map: Record<string, 'pending' | 'accepted'> = {};
      for (const r of fRows as { followed_id: string; status: string }[]) map[r.followed_id] = r.status as 'pending' | 'accepted';
      setFollowStates(map);
    }
  }, [currentUserId]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      refreshFollowStates(user.id);
      const { data: prof } = await supabase.from('profiles').select('preferred_sports').eq('user_id', user.id).maybeSingle();
      if (prof?.preferred_sports) setPreferredSports(prof.preferred_sports);
    })();
  }, []);

  const handleAcceptFollow = async (notif: NotificationItem) => {
    const fromUserId = notif.data?.from_user_id;
    if (!fromUserId || !currentUserId) return;
    try {
      await supabase.from('follows').update({ status: 'accepted' }).eq('follower_id', fromUserId).eq('followed_id', currentUserId);
      await supabase.from('notifications').update({ read: true }).eq('id', notif.id);

      const { data: myProfile } = await supabase.from('profiles').select('username, full_name').eq('user_id', currentUserId).maybeSingle();
      await supabase.from('notifications').insert({
        user_id: fromUserId,
        type: 'follow_accepted',
        title: `${myProfile?.full_name ?? myProfile?.username ?? 'Someone'} accepted your follow request`,
        body: null,
        data: { from_user_id: currentUserId },
      });
      loadNotifications();
    } catch { /* swallow */ }
  };

  const handleIgnoreFollow = async (notif: NotificationItem) => {
    const fromUserId = notif.data?.from_user_id;
    if (!fromUserId || !currentUserId) return;
    try {
      await supabase.from('follows').delete().eq('follower_id', fromUserId).eq('followed_id', currentUserId);
      await supabase.from('notifications').update({ read: true }).eq('id', notif.id);
      loadNotifications();
    } catch { /* swallow */ }
  };

  const handleFollowBack = async (notif: NotificationItem) => {
    const fromUserId = notif.data?.from_user_id;
    if (!fromUserId || !currentUserId) return;
    try {
      // Check if already following this user
      const { data: existing } = await supabase
        .from('follows')
        .select('status')
        .eq('follower_id', currentUserId)
        .eq('followed_id', fromUserId)
        .maybeSingle();
      if (existing?.status) {
        setFollowStates((prev) => ({ ...prev, [fromUserId]: existing.status as any }));
        return;
      }
      await supabase.from('follows').insert({ follower_id: currentUserId, followed_id: fromUserId, status: 'pending' });
      setFollowStates((prev) => ({ ...prev, [fromUserId]: 'pending' }));
      const { data: myProfile } = await supabase.from('profiles').select('username, full_name').eq('user_id', currentUserId).maybeSingle();
      const displayName = (myProfile as { full_name?: string; username?: string })?.full_name ?? (myProfile as { full_name?: string; username?: string })?.username ?? 'Someone';
      // Remove old follow_request notifications before inserting
      await supabase.from('notifications').delete().match({ user_id: fromUserId, type: 'follow_request' }).eq('data->>from_user_id', String(currentUserId));
      await supabase.from('notifications').insert({
        user_id: fromUserId,
        type: 'follow_request',
        title: `${displayName} wants to follow you`,
        body: 'Accept or ignore this follow request.',
        data: { from_user_id: currentUserId },
      });
      loadNotifications();
    } catch { /* swallow */ }
  };

  const updateFeedItem = useCallback((matchId: string, updater: (item: FeedMatch) => FeedMatch) => {
    setFeedItems(prev => prev.map(m => m.id === matchId ? updater(m) : m));
  }, []);

  const removeFeedItem = useCallback((matchId: string) => {
    setFeedItems(prev => prev.filter(m => m.id !== matchId));
  }, []);

  const loadFeed = useCallback(async (showLoading = true) => {
    if (showLoading) setLoadingFeed(true);
    try {
      const [feedRes, authRes] = await Promise.all([
        supabase.from('match_feed').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.auth.getUser(),
      ]);
      const user = authRes.data.user;
      if (user) {
        setCurrentUserId(user.id);
      }
      const parseParticipants = (raw: unknown): Participant[] => {
        if (Array.isArray(raw)) return raw as Participant[];
        if (typeof raw === 'string') { try { return JSON.parse(raw) as Participant[]; } catch { return []; } }
        return [];
      };
      const newItems = (feedRes.data ?? []).map((m: any) => ({ ...m, participants: parseParticipants(m.participants) })) as FeedMatch[];
      newItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setFeedItems(newItems);
    } catch { /* swallow */ }
    finally { if (showLoading) setLoadingFeed(false); }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      let items = (data ?? []) as NotificationItem[];

      // Clean up stale match invites.
      // The match creator cannot delete other users' notifications due to RLS, so invites
      // for deleted/canceled matches can linger unless we remove them client-side.
      if (currentUserId) {
        const inviteNotifs = items.filter((n) => n.type === 'match_invite' && n.data?.match_id);
        if (inviteNotifs.length > 0) {
          const matchIds = Array.from(
            new Set(inviteNotifs.map((n) => String(n.data?.match_id)).filter(Boolean)),
          );
          if (matchIds.length > 0) {
            const { data: matches } = await supabase
              .from('matches')
              .select('id, status')
              .in('id', matchIds);
            const existing = new Set(
              ((matches ?? []) as { id: string; status: string }[])
                .filter((m) => m?.id && m.status !== 'canceled')
                .map((m) => m.id),
            );
            const staleIds = matchIds.filter((id) => !existing.has(id));
            if (staleIds.length > 0) {
              await Promise.all(
                staleIds.map((id) =>
                  supabase
                    .from('notifications')
                    .delete()
                    .eq('user_id', currentUserId)
                    .eq('type', 'match_invite')
                    .filter('data->>match_id', 'eq', id),
                ),
              );
              items = items.filter(
                (n) => !(n.type === 'match_invite' && staleIds.includes(String(n.data?.match_id))),
              );
            }
          }
        }
      }

      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.read).length);
      // Refresh feed when we have match_accepted so ranked ready-up/start updates immediately
      const hasMatchAccepted = items.some((n) => n.type === 'match_accepted');
      if (hasMatchAccepted) loadFeed(false);
      // Refresh follow states so "Follow back" button is accurate
      refreshFollowStates();
    } catch { /* swallow */ }
  }, [currentUserId, loadFeed, refreshFollowStates]);

  const loadUnreadDmCount = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const uid = user.id;
      const { data: convos } = await supabase.from('dm_conversations').select('id').or(`user1_id.eq.${uid},user2_id.eq.${uid}`);
      if (!convos?.length) {
        setUnreadDmCount(0);
        return;
      }
      const convIds = (convos as { id: string }[]).map((c) => c.id);
      const { data: readRows } = await supabase.from('dm_conversation_read').select('conversation_id, last_read_at').eq('user_id', uid);
      const lastRead: Record<string, string> = {};
      (readRows ?? []).forEach((r: { conversation_id: string; last_read_at: string }) => { lastRead[r.conversation_id] = r.last_read_at; });
      const { data: messages } = await supabase
        .from('dm_messages')
        .select('conversation_id, sender_id, created_at')
        .in('conversation_id', convIds)
        .neq('sender_id', uid);
      let count = 0;
      (messages ?? []).forEach((m: { conversation_id: string; created_at: string }) => {
        const readAt = lastRead[m.conversation_id];
        if (!readAt || new Date(m.created_at) > new Date(readAt)) count += 1;
      });
      setUnreadDmCount(count);
    } catch { /* swallow */ }
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    loadFeed();
    loadNotifications();
    loadUnreadDmCount();
  }, [isFocused, loadFeed, loadNotifications, loadUnreadDmCount]);

  // Scroll to top when the user taps the Home tab while already on it
  useEffect(() => {
    const unsub = navigation.addListener('tabPress', () => {
      if (isFocused) feedListRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    return unsub;
  }, [navigation, isFocused]);

  const feedDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadFeedDebounced = useCallback((showLoading = true) => {
    if (feedDebounceTimerRef.current) clearTimeout(feedDebounceTimerRef.current);
    feedDebounceTimerRef.current = setTimeout(() => loadFeed(showLoading), 100);
  }, [loadFeed]);

  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!isFocused || !currentUserId) return;
    const channel = supabase
      .channel(`matches-changes-${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        loadFeedDebounced(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_participants' }, () => {
        loadFeedDebounced(false);
      })
      .on('broadcast', { event: 'match_updated' }, () => {
        loadFeed(false);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` }, () => {
        loadNotifications();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` }, () => {
        loadNotifications();
      })
      .subscribe();
    realtimeChannelRef.current = channel;
    return () => {
      if (feedDebounceTimerRef.current) clearTimeout(feedDebounceTimerRef.current);
      realtimeChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [isFocused, currentUserId, loadFeedDebounced, loadFeed, loadNotifications]);

  const hasPendingRankedMatch = useMemo(() => {
    if (!currentUserId) return false;
    return feedItems.some((m) => {
      const isRanked = String(m.match_type || '').toLowerCase() === 'ranked';
      const participants = Array.isArray(m.participants) ? m.participants : [];
      const amIn = participants.some((p: Participant) => String(p?.user_id) === String(currentUserId));
      const waiting = m.status !== 'confirmed' || participants.length < 2;
      return isRanked && amIn && waiting && m.status !== 'completed' && m.status !== 'canceled';
    });
  }, [feedItems, currentUserId]);

  const hasActiveMatch = useMemo(() => {
    if (!currentUserId) return false;
    return feedItems.some((m) => {
      const participants = Array.isArray(m.participants) ? m.participants : [];
      const amIn = participants.some((p: Participant) => String(p?.user_id) === String(currentUserId));
      return amIn && (m.status === 'in_progress' || m.status === 'paused');
    });
  }, [feedItems, currentUserId]);

  useEffect(() => {
    if (!isFocused) return;
    const interval = setInterval(() => {
      loadFeed(false);
      loadNotifications();
    }, (hasPendingRankedMatch || hasActiveMatch) ? 5000 : 20000);
    return () => clearInterval(interval);
  }, [isFocused, loadFeed, loadNotifications, hasPendingRankedMatch, hasActiveMatch]);

  // Safety net: when feed reloads and a ranked match has all participants delete_requested,
  // auto-trigger the actual deletion (handles race condition where both users clicked simultaneously)
  const deletingMatchRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!currentUserId) return;
    const candidates = feedItems.filter((m) => {
      if (String(m.match_type || '').toLowerCase() !== 'ranked') return false;
      const pts = Array.isArray(m.participants) ? m.participants : [];
      if (pts.length < 2) return false;
      if (!pts.some((p) => String(p?.user_id) === String(currentUserId))) return false;
      if (!pts.every((p) => p.delete_requested === true)) return false;
      if (deletingMatchRef.current.has(m.id)) return false;
      return true;
    });
    if (candidates.length === 0) return;
    candidates.forEach((m) => deletingMatchRef.current.add(m.id));
    Promise.all(candidates.map(async (m) => {
      const pts = Array.isArray(m.participants) ? m.participants : [];
      try {
        if (m.status === 'completed') {
          const { data: sportRow } = await supabase.from('sports').select('id').eq('name', m.sport_name).maybeSingle();
          if (sportRow?.id) {
            await Promise.all(pts.map((p) => supabase.rpc('reverse_sport_rating', {
              p_user_id: p.user_id,
              p_sport_id: sportRow.id,
              p_vp_loss: Math.max(0, p.vp_delta ?? 0),
              p_was_win: p.result === 'win',
              p_was_loss: p.result === 'loss',
            })));
          }
        }
        await supabase.from('matches').delete().eq('id', m.id);
      } catch { /* swallow — other user may have already deleted */ }
      finally { deletingMatchRef.current.delete(m.id); }
    })).then(() => { if (candidates.length > 0) loadFeed(false); });
  }, [feedItems, currentUserId, loadFeed]);

  const myFeed = useMemo(
    () => feedItems.filter((m) => {
      // Always show matches the current user created (even if participant row hasn't loaded)
      if (m.created_by === currentUserId) return true;
      // Show if the user is an accepted participant (not just invited — invitees aren't in
      // match_participants until they accept, so pending invites are automatically excluded)
      return (m.participants ?? []).some((p) => p.user_id === currentUserId);
    }),
    [feedItems, currentUserId],
  );
  const publicFeed = useMemo(
    () => feedItems
      .filter((m) => m.status === 'completed' && m.match_type !== 'practice' && m.is_public !== false)
      .sort((a, b) => new Date(b.ended_at ?? b.created_at).getTime() - new Date(a.ended_at ?? a.created_at).getTime()),
    [feedItems],
  );
  const displayedItems = useMemo(() => {
    const feed = feedMode === 'my' ? myFeed : publicFeed;
    if (preferredSports.length === 0) return feed;
    const prefSet = new Set(preferredSports);
    return [...feed].sort((a, b) => {
      const aP = prefSet.has(a.sport_name) ? 0 : 1;
      const bP = prefSet.has(b.sport_name) ? 0 : 1;
      return aP - bP;
    });
  }, [feedMode, myFeed, publicFeed, preferredSports]);

  // Capture scrollToMatchId param immediately and clear it from route so it doesn't re-fire
  useEffect(() => {
    const matchId = route.params?.scrollToMatchId;
    if (!matchId) return;
    setPendingScrollMatchId(matchId);
    setFeedMode('my');
    navigation.setParams({ scrollToMatchId: undefined } as any);
  }, [route.params?.scrollToMatchId]);

  // Scroll once myFeed has loaded and contains the target match
  useEffect(() => {
    if (!pendingScrollMatchId || myFeed.length === 0) return;
    const idx = myFeed.findIndex((i) => i.id === pendingScrollMatchId);
    if (idx >= 0) {
      setPendingScrollMatchId(null);
      setTimeout(() => feedListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 }), 400);
    }
  }, [pendingScrollMatchId, myFeed]);

  const inviteExcludeIds = useMemo(() => {
    if (!inviteOpponentMatch) return undefined;
    return (inviteOpponentMatch.participants ?? []).map((p: Participant) => p?.user_id).filter(Boolean) as string[];
  }, [inviteOpponentMatch]);

  const handleAcceptInvite = async (
    notif: NotificationItem,
    forceRole?: 'challenger' | 'opponent',
  ) => {
    const matchId = notif.data?.match_id;
    if (!matchId || !currentUserId) return;
    try {
      const { data: match, error: matchErr } = await supabase
        .from('matches')
        .select('invited_opponent_id, invited_teammate_id, invited_opponent_2_id, match_type, match_format, created_by, status')
        .eq('id', matchId)
        .maybeSingle();
      const m = match as {
        invited_opponent_id?: string | null;
        invited_teammate_id?: string | null;
        invited_opponent_2_id?: string | null;
        match_type?: string | null;
        match_format?: string | null;
        created_by?: string | null;
        status?: string | null;
      } | null;

      // If the match was canceled/deleted, silently remove the stale invite.
      if (matchErr || !m || m.status === 'canceled') {
        await supabase.from('notifications').delete().eq('id', notif.id);
        loadNotifications();
        Alert.alert('Invite expired', 'This match was canceled.');
        return;
      }

      const doAccept = async (role: 'challenger' | 'opponent') => {
        // First-come-first-serve: fetch live participant state
        const { data: existingParts } = await supabase
          .from('match_participants').select('user_id, role').eq('match_id', matchId);
        const parts = (existingParts ?? []) as { user_id: string; role: string }[];

        // Already a participant (e.g., accepted from another device/notification)
        if (parts.some((p) => p.user_id === currentUserId)) {
          await supabase.from('notifications').update({ read: true }).eq('id', notif.id);
          loadNotifications();
          loadFeed(false);
          return;
        }

        // Slot full check — first come, first served
        const maxPerRole = m?.match_format === '2v2' ? 2 : 1;
        if (parts.filter((p) => p.role === role).length >= maxPerRole) {
          Alert.alert('Spot taken', 'Someone else already filled that spot. Sorry!');
          await supabase.from('notifications').update({ read: true }).eq('id', notif.id);
          loadNotifications();
          return;
        }

        await supabase.from('match_participants').insert({ match_id: matchId, user_id: currentUserId, role });

        const updatePayload: Record<string, unknown> = {};
        // Clear matching invited_*_id (independent checks — don't clear other users' invites)
        if (m?.invited_opponent_id === currentUserId) updatePayload.invited_opponent_id = null;
        if (m?.invited_teammate_id === currentUserId) updatePayload.invited_teammate_id = null;
        if (m?.invited_opponent_2_id === currentUserId) updatePayload.invited_opponent_2_id = null;

        // Count-based confirmation (participant count reaching required slots)
        const required = m?.match_format === '2v2' ? 4 : 2;
        if (parts.length + 1 >= required) {
          updatePayload.status = 'confirmed';
          // Clear all remaining invited IDs when match is full
          updatePayload.invited_opponent_id = null;
          updatePayload.invited_teammate_id = null;
          updatePayload.invited_opponent_2_id = null;
        }

        if (Object.keys(updatePayload).length > 0) {
          await supabase.from('matches').update(updatePayload).eq('id', matchId);
        }
        await supabase.from('notifications').update({ read: true }).eq('id', notif.id);

        const fromUserId = m?.created_by ?? notif.data?.from_user_id;
        if (fromUserId) {
          const { data: myProfile } = await supabase
            .from('profiles')
            .select('username')
            .eq('user_id', currentUserId)
            .maybeSingle();
          const matchTypeLabel = m?.match_type ? String(m.match_type).charAt(0).toUpperCase() + String(m.match_type).slice(1) : 'Match';
          await supabase.from('notifications').insert({
            user_id: fromUserId,
            type: 'match_accepted',
            title: `${myProfile?.username ?? 'Your opponent'} accepted your ${matchTypeLabel} match!`,
            body: 'Your match is confirmed. Game on!',
            data: { match_id: matchId, from_user_id: currentUserId },
          });
        }

        loadNotifications();
        loadFeed(false);
      };

      if (m?.match_format === '2v2' && !forceRole) {
        if (Platform.OS === 'web') {
          // Web: show a custom team picker modal instead of using Alert with buttons,
          // which is unreliable on web. Close notifications first so it renders on top.
          closeNotifications();
          setTeamPickInvite({ notif, matchId });
          return;
        }
        const creatorTeamLabel = "Creator's team";
        const otherTeamLabel = 'Other team';
        Alert.alert('Choose your team', 'Which team would you like to join?', [
          { text: creatorTeamLabel, onPress: () => doAccept('challenger') },
          { text: otherTeamLabel, onPress: () => doAccept('opponent') },
          { text: 'Cancel', style: 'cancel' },
        ]);
      } else {
        await doAccept(forceRole ?? 'opponent');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not accept invite.');
    }
  };

  const handleDeclineInvite = async (notif: NotificationItem) => {
    const matchId = notif.data?.match_id;
    if (!matchId || !currentUserId) return;
    const slot = notif.data?.slot as string | undefined;
    try {
      const { data: match, error: matchErr } = await supabase
        .from('matches')
        .select('id, status, match_type, created_by, invited_opponent_id, invited_teammate_id, invited_opponent_2_id')
        .eq('id', matchId)
        .maybeSingle();
      const m = match as {
        id: string;
        status: string | null;
        match_type: string | null;
        created_by: string | null;
        invited_opponent_id: string | null;
        invited_teammate_id: string | null;
        invited_opponent_2_id: string | null;
      } | null;

      // If the match no longer exists (or was canceled), don't notify the creator of a "decline".
      if (matchErr || !m || m.status === 'canceled') {
        await supabase.from('notifications').delete().eq('id', notif.id);
        loadNotifications();
        return;
      }

      // Clear the correct invite slot — only if the declining user is still tracked there.
      // No slot-based fallback: clearing a field that belongs to a different user's invite would
      // silently revoke that other user's pending invite (multi-invite / first-come-first-served).
      const updatePayload: Record<string, unknown> = {};
      if (m.invited_teammate_id === currentUserId) updatePayload.invited_teammate_id = null;
      else if (m.invited_opponent_2_id === currentUserId) updatePayload.invited_opponent_2_id = null;
      else if (m.invited_opponent_id === currentUserId) updatePayload.invited_opponent_id = null;

      await supabase.from('matches').update(updatePayload).eq('id', matchId);
      await supabase.from('notifications').update({ read: true }).eq('id', notif.id);

      const fromUserId = m.created_by ?? notif.data?.from_user_id;
      if (fromUserId) {
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('username')
          .eq('user_id', currentUserId)
          .maybeSingle();
        const matchTypeLabel = m.match_type
          ? String(m.match_type).charAt(0).toUpperCase() + String(m.match_type).slice(1)
          : 'Match';
        await supabase.from('notifications').insert({
          user_id: fromUserId,
          type: 'match_declined',
          title: `${myProfile?.username ?? 'Your opponent'} declined your ${matchTypeLabel} match invite`,
          body: 'The match invite was declined.',
          data: { match_id: matchId, from_user_id: currentUserId },
        });
      }

      loadNotifications();
      loadFeed(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not decline invite.');
    }
  };

  const handleInviteOpponent = async (match: FeedMatch, user: SearchedUser) => {
    if (!currentUserId) return;
    setInviteOpponentMatch(null);
    const slot = inviteSlot;
    try {
      const updatePayload: Record<string, unknown> = {};
      if (slot === 'teammate') updatePayload.invited_teammate_id = user.user_id;
      else if (slot === 'opponent_2') updatePayload.invited_opponent_2_id = user.user_id;
      else updatePayload.invited_opponent_id = user.user_id;
      await supabase.from('matches').update(updatePayload).eq('id', match.id);

      const { data: myProfile } = await supabase.from('profiles').select('username').eq('user_id', currentUserId).maybeSingle();
      const sportLabelStr = match.sport_name ?? 'Match';
      const matchType = match.match_type ?? 'casual';
      const matchTypeLabel = String(matchType).charAt(0).toUpperCase() + String(matchType).slice(1);
      const notifBody = `${sportLabelStr} ${matchType} - ${myProfile?.username ?? 'Someone'} invited you!`;
      const inviteTitle = slot === 'teammate'
        ? `${myProfile?.username ?? 'Someone'} invited you as their teammate in a ${matchTypeLabel} match!`
        : `${myProfile?.username ?? 'Someone'} challenged you to a ${matchTypeLabel} match!`;
      await supabase.from('notifications').insert({
        user_id: user.user_id,
        type: 'match_invite',
        title: inviteTitle,
        body: notifBody,
        data: { match_id: match.id, from_user_id: currentUserId, slot },
      });
      sendMatchInvitePush(user.user_id, inviteTitle, notifBody, match.id);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not send invite.');
    }
  };

  const openNotifs = () => {
    setNotifsVisible(true);
    loadFeed(false);
    loadNotifications();
    supabase
      .from('notifications')
      .update({ read: true })
      .eq('read', false)
      .not('type', 'in', '("match_invite","follow_request")')
      .then(() => {
        setNotifications((prev) =>
          prev.map((n) =>
            n.type === 'match_invite' || n.type === 'follow_request' ? n : { ...n, read: true },
          ),
        );
        setUnreadCount((prev) => {
          const actionable = notifications.filter(
            (n) => !n.read && (n.type === 'match_invite' || n.type === 'follow_request'),
          ).length;
          return actionable;
        });
      });
  };

  const notifIcon = (type: string) => {
    if (type === 'match_invite') return { name: 'flash' as const, bg: colors.primary };
    if (type === 'match_accepted') return { name: 'checkmark-circle' as const, bg: colors.success };
    if (type === 'match_finished') return { name: 'flag' as const, bg: colors.primary };
    if (type === 'match_declined') return { name: 'close-circle' as const, bg: colors.error };
    if (type === 'follow_request') return { name: 'person-add' as const, bg: colors.primary };
    if (type === 'follow_accepted') return { name: 'people' as const, bg: colors.success };
    return { name: 'notifications' as const, bg: colors.textSecondary };
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ---- Top bar ---- */}
      <View style={styles.topBar}>
        <Image
          source={themeMode === 'dark' ? require('../../assets/icon_dark.png') : require('../../assets/icon_blue_small.png')}
          style={{ height: 90, width: 185, marginLeft: -10 }}
          resizeMode="contain"
        />
        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={styles.topBarIcon}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Search')}
          >
            <Ionicons name="search" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.topBarIcon}
            activeOpacity={0.8}
            onPress={openNotifs}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.text} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.topBarIcon}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Messages')}
          >
            <Ionicons name="chatbubbles-outline" size={20} color={colors.text} />
            {unreadDmCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadDmCount > 99 ? '99+' : unreadDmCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ---- Feed switcher ---- */}
      <View style={styles.switcherRow}>
        <TouchableOpacity
          style={[styles.switcherTab, feedMode === 'my' && styles.switcherTabActive]}
          onPress={() => setFeedMode('my')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="people"
            size={18}
            color={feedMode === 'my' ? colors.textOnPrimary : colors.textSecondary}
          />
          <Text style={[styles.switcherLabel, feedMode === 'my' && styles.switcherLabelActive]}>
            My feed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.switcherTab, feedMode === 'public' && styles.switcherTabActive]}
          onPress={() => setFeedMode('public')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="globe-outline"
            size={18}
            color={feedMode === 'public' ? colors.textOnPrimary : colors.textSecondary}
          />
          <Text style={[styles.switcherLabel, feedMode === 'public' && styles.switcherLabelActive]}>
            Public
          </Text>
        </TouchableOpacity>
      </View>
      {/* {feedMode === 'public' && (
        <Text style={styles.switcherHint}>All confirmed & completed matches</Text>
      )} */}

      {/* ---- Feed ---- */}
      {loadingFeed ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={feedListRef}
          data={displayedItems}
          keyExtractor={(item) => { const pts = Array.isArray(item.participants) ? item.participants : []; return `${item.id}-${item.status}-${pts.length}-${pts.map((p: Participant) => p?.ready).join(',')}`; }}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => feedListRef.current?.scrollToIndex({ index: info.index, animated: true }), 100);
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={async () => { setIsRefreshing(true); await Promise.all([loadFeed(false), loadNotifications(), loadUnreadDmCount()]); setIsRefreshing(false); }}
              tintColor={colors.text}
              colors={[colors.primary]}
              progressBackgroundColor={colors.cardBg}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyFeed}>
              {feedMode === 'my'
                ? 'No matches yet. Create one from the Plan tab!'
                : 'No public matches yet.'}
            </Text>
          }
          renderItem={({ item }) => (
            <FeedCard
              item={item}
              currentUserId={currentUserId}
              styles={styles}
              colors={colors}
              onRefresh={loadFeed}
              updateFeedItem={updateFeedItem}
              onRemoveItem={removeFeedItem}
              onInviteOpponent={(match, slot) => { setInviteOpponentMatch(match); setInviteSlot(slot ?? 'opponent'); }}
              onEditMatch={setEditMatch}
              navigation={navigation}
              onNotifyUpdate={() => {
                realtimeChannelRef.current?.send({ type: 'broadcast', event: 'match_updated', payload: {} });
              }}
            />
          )}
        />
      )}

      {/* ---- Edit match modal ---- */}
      <EditMatchModal
        visible={!!editMatch}
        onClose={() => setEditMatch(null)}
        onSaved={() => { loadFeed(false); setEditMatch(null); }}
        colors={colors}
        currentUserId={currentUserId}
        match={editMatch ? {
          id: editMatch.id,
          sport_name: editMatch.sport_name,
          match_type: editMatch.match_type ?? 'casual',
          status: editMatch.status,
          location_name: editMatch.location_name ?? null,
          location_lat: editMatch.location_lat ?? null,
          location_lng: editMatch.location_lng ?? null,
          notes: editMatch.notes ?? null,
          is_public: editMatch.is_public,
          match_format: editMatch.match_format ?? '1v1',
          scheduled_at: editMatch.scheduled_at ?? null,
          created_by: editMatch.created_by,
          participants: editMatch.participants?.map(p => ({ user_id: p.user_id, role: p.role, username: p.username, full_name: p.full_name })),
        } : null}
      />

      {/* ---- Invite opponent modal ---- */}
      <Modal visible={!!inviteOpponentMatch} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => { setInviteOpponentMatch(null); setSelectedInviteUser(null); }} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{inviteSlot === 'teammate' ? 'Invite teammate' : 'Invite opponent'}</Text>
              <TouchableOpacity onPress={() => { setInviteOpponentMatch(null); setSelectedInviteUser(null); }} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>Search by username or name (min 2 characters)</Text>
            <UserSearch
              colors={colors}
              excludeUserId={currentUserId ?? undefined}
              excludeUserIds={inviteExcludeIds}
              placeholder="Search by username or name..."
              onSelect={setSelectedInviteUser}
            />
            {selectedInviteUser && (
              <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
                  {selectedInviteUser.avatar_url ? (
                    <Image source={{ uri: selectedInviteUser.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                  ) : (
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: colors.textOnPrimary, fontWeight: '700', fontSize: 14 }}>
                        {(selectedInviteUser.full_name ?? selectedInviteUser.username ?? '?').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{selectedInviteUser.full_name ?? selectedInviteUser.username}</Text>
                    {selectedInviteUser.username && <Text style={{ color: colors.textSecondary, fontSize: 12 }}>@{selectedInviteUser.username}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => setSelectedInviteUser(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={{ backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: spacing.xs + 2, marginTop: spacing.sm, alignItems: 'center' }}
                  onPress={() => {
                    if (inviteOpponentMatch && selectedInviteUser) {
                      handleInviteOpponent(inviteOpponentMatch, selectedInviteUser);
                      setSelectedInviteUser(null);
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: colors.textOnPrimary, fontWeight: '600', fontSize: 13 }}>Send Invite</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ---- Notifications modal ---- */}
      <Modal visible={notifsVisible} transparent animationType="fade">
        <View style={[styles.modalBackdrop, { justifyContent: 'flex-start' }]}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={closeNotifications}
          />
          <Animated.View
            style={[
              styles.notifModalCard,
              { paddingTop: insets.top + spacing.lg, transform: [{ translateY: notifSlideAnim }] },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifications</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                {notifications.some((n) => n.read) && currentUserId && (
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        await supabase.from('notifications').delete().eq('user_id', currentUserId).eq('read', true);
                        loadNotifications();
                      } catch { /* swallow */ }
                    }}
                    hitSlop={8}
                  >
                    <Text style={{ ...typography.label, color: colors.primary, fontSize: 14 }}>Clear read</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={closeNotifications} hitSlop={12}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {notifications.length === 0 && (
                <Text style={styles.emptyText}>No notifications yet.</Text>
              )}
              {notifications.map((n) => {
                const icon = notifIcon(n.type);
                const isInvite = n.type === 'match_invite' && !n.read;
                const isFollowReq = n.type === 'follow_request' && !n.read;
                return (
                  <View key={n.id} style={styles.notifCard}>
                    <View style={[styles.notifIconCircle, { backgroundColor: `${icon.bg}20` }]}>
                      <Ionicons name={icon.name} size={20} color={icon.bg} />
                    </View>
                    <View style={styles.notifContent}>
                      <Text style={[styles.notifTitle, !n.read && styles.notifTitleUnread]}>
                        {n.title}
                      </Text>
                      {n.body && <Text style={styles.notifBody}>{n.body}</Text>}
                      <Text style={styles.notifTime}>{timeAgo(n.created_at)}</Text>
                      {isInvite && (
                        <View style={styles.notifActions}>
                          <TouchableOpacity
                            style={styles.notifAccept}
                            activeOpacity={0.8}
                            onPress={() => handleAcceptInvite(n)}
                          >
                            <Ionicons name="checkmark" size={16} color={colors.textOnPrimary} />
                            <Text style={styles.notifAcceptText}>Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.notifDecline}
                            activeOpacity={0.8}
                            onPress={() => handleDeclineInvite(n)}
                          >
                            <Ionicons name="close" size={16} color={colors.error} />
                            <Text style={styles.notifDeclineText}>Decline</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      {isFollowReq && (
                        <View style={styles.notifActions}>
                          <TouchableOpacity
                            style={styles.notifAccept}
                            activeOpacity={0.8}
                            onPress={() => handleAcceptFollow(n)}
                          >
                            <Ionicons name="checkmark" size={16} color={colors.textOnPrimary} />
                            <Text style={styles.notifAcceptText}>Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.notifDecline}
                            activeOpacity={0.8}
                            onPress={() => handleIgnoreFollow(n)}
                          >
                            <Ionicons name="close" size={16} color={colors.error} />
                            <Text style={styles.notifDeclineText}>Ignore</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      {n.type === 'follow_request' && n.read && n.data?.from_user_id && followStates[n.data.from_user_id] !== 'accepted' && followStates[n.data.from_user_id] !== 'pending' && (
                        <View style={[styles.notifActions, { marginTop: spacing.xs }]}>
                          <TouchableOpacity
                            style={styles.notifAccept}
                            activeOpacity={0.8}
                            onPress={() => handleFollowBack(n)}
                          >
                            <Text style={styles.notifAcceptText}>Follow back</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                    {!n.read && <View style={styles.notifUnreadDot} />}
                  </View>
                );
              })}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* ---- 2v2 team pick modal (web + native fallback) — rendered last so it appears on top ---- */}
      <Modal visible={!!teamPickInvite} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setTeamPickInvite(null)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose your team</Text>
              <TouchableOpacity onPress={() => setTeamPickInvite(null)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              Which team would you like to join for this 2v2 match?
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <TouchableOpacity
                style={[styles.notifAccept, { flex: 1 }]}
                activeOpacity={0.8}
                onPress={() => {
                  if (!teamPickInvite) return;
                  const notif = teamPickInvite.notif;
                  setTeamPickInvite(null);
                  handleAcceptInvite(notif, 'challenger');
                }}
              >
                <Text style={styles.notifAcceptText}>Creator's team</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.notifDecline, { flex: 1, borderWidth: 0 }]}
                activeOpacity={0.8}
                onPress={() => {
                  if (!teamPickInvite) return;
                  const notif = teamPickInvite.notif;
                  setTeamPickInvite(null);
                  handleAcceptInvite(notif, 'opponent');
                }}
              >
                <Text style={[styles.notifDeclineText, { color: colors.text }]}>Other team</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}
