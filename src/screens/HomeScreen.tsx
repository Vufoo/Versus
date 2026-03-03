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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { TabParamList } from '../navigation/TabNavigator';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../constants/theme';
import { sportLabel, SPORT_EMOJI, SPORT_SCORING, validateGameScore } from '../constants/sports';
import { supabase } from '../lib/supabase';
import { resolveAvatarUrl, resolveMatchImageUrl } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import UserSearch from '../components/UserSearch';
import type { SearchedUser } from '../components/UserSearch';
import EditMatchModal from '../components/EditMatchModal';

type FeedMode = 'public' | 'my';

type Participant = {
  user_id: string;
  role: string;
  result: string;
  score: string | null;
  vp_delta: number;
  ready?: boolean;
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
  match_type: string;
  status: string;
  is_public?: boolean;
  match_format?: string;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  notes: string | null;
  created_by: string;
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

function formatMatchScore(
  sportName: string,
  games: { score_challenger: number; score_opponent: number }[],
  p1Name: string,
  p2Name: string
): { main: string; sub: string | null } {
  const filtered = games.filter((g) => g.score_challenger > 0 || g.score_opponent > 0);
  if (filtered.length === 0) return { main: '', sub: null };

  const rules = SPORT_SCORING[sportName];
  const isSetBased = rules === 'set';

  if (isSetBased && filtered.length > 0) {
    const setsP1 = filtered.filter((g) => g.score_challenger > g.score_opponent).length;
    const setsP2 = filtered.filter((g) => g.score_opponent > g.score_challenger).length;
    const setScores = filtered.map((g) => `${g.score_challenger}-${g.score_opponent}`).join(', ');
    return {
      main: `${setsP1} - ${setsP2}`,
      sub: setScores,
    };
  }

  const totalP1 = filtered.reduce((a, g) => a + g.score_challenger, 0);
  const totalP2 = filtered.reduce((a, g) => a + g.score_opponent, 0);
  if (filtered.length === 1) {
    return { main: `${totalP1} - ${totalP2}`, sub: null };
  }
  const gameScores = filtered.map((g) => `${g.score_challenger}-${g.score_opponent}`).join(', ');
  return {
    main: `${totalP1} - ${totalP2}`,
    sub: gameScores,
  };
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
  onInviteOpponent,
  onEditMatch,
  navigation,
}: {
  item: FeedMatch;
  currentUserId: string | null;
  styles: ReturnType<typeof createHomeStyles>;
  colors: ThemeColors;
  onRefresh: () => void;
  onInviteOpponent?: (match: FeedMatch) => void;
  onEditMatch?: (match: FeedMatch) => void;
  navigation: { navigate: (screen: string, params?: object) => void };
}) {
  const challenger = (item.participants ?? []).find((p) => p.role === 'challenger');
  const opponent = (item.participants ?? []).find((p) => p.role === 'opponent');
  const p1 = challenger ?? (item.participants ?? [])[0];
  const p2 = opponent ?? (item.participants ?? [])[1];
  const creator = p1;

  const [creatorAvatarUrl, setCreatorAvatarUrl] = useState<string | null>(null);
  const [p1AvatarUrl, setP1AvatarUrl] = useState<string | null>(null);
  const [p2AvatarUrl, setP2AvatarUrl] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(item.likes_count);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [deleteImageId, setDeleteImageId] = useState<string | null>(null);
  const gamesList = (item.games ?? []) as MatchGame[];
  const [localGames, setLocalGames] = useState<{ score_challenger: string; score_opponent: string }[]>(
    gamesList.length > 0 ? gamesList.map((g) => ({ score_challenger: String(g.score_challenger), score_opponent: String(g.score_opponent) })) : [{ score_challenger: '', score_opponent: '' }],
  );
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveValidationError, setSaveValidationError] = useState<string | null>(null);
  const [startStopLoading, setStartStopLoading] = useState(false);
  const [readyLoading, setReadyLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [winnerPickerVisible, setWinnerPickerVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const [commentsVisible, setCommentsVisible] = useState(false);
  const [comments, setComments] = useState<MatchComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [commentPosting, setCommentPosting] = useState(false);
  const [commentsCount, setCommentsCount] = useState(item.comments_count);

  const [likersModalVisible, setLikersModalVisible] = useState(false);
  const [likers, setLikers] = useState<Liker[]>([]);
  const [likersLoading, setLikersLoading] = useState(false);

  useEffect(() => {
    if (creator?.avatar_url) resolveAvatarUrl(creator.avatar_url).then(setCreatorAvatarUrl);
    if (p1?.avatar_url) resolveAvatarUrl(p1.avatar_url).then(setP1AvatarUrl);
    if (p2?.avatar_url) resolveAvatarUrl(p2.avatar_url).then(setP2AvatarUrl);
  }, [creator?.avatar_url, p1?.avatar_url, p2?.avatar_url]);

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
    const gs = (item.games ?? []) as MatchGame[];
    setLocalGames(
      gs.length > 0 ? gs.map((g) => ({ score_challenger: String(g.score_challenger), score_opponent: String(g.score_opponent) })) : [{ score_challenger: '', score_opponent: '' }],
    );
  }, [item.id, item.games]);

  useEffect(() => {
    setCommentsCount(item.comments_count);
  }, [item.comments_count]);

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
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
    try {
      await supabase.from('match_comments').insert({ match_id: item.id, user_id: currentUserId, body });
      setCommentBody('');
      setCommentsCount((c) => c + 1);
      onRefresh();
      await loadComments();
    } catch { /* swallow */ }
    finally { setCommentPosting(false); }
  };

  const isInProgress = item.status === 'in_progress';
  const isPaused = item.status === 'paused';
  const isParticipant = currentUserId && (p1?.user_id === currentUserId || p2?.user_id === currentUserId);
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
  const participantsRaw = item.participants ?? [];
  const participants = (Array.isArray(participantsRaw) ? participantsRaw : (typeof participantsRaw === 'string' ? (() => { try { return JSON.parse(participantsRaw); } catch { return []; } })() : [])) as Participant[];
  const myParticipant = participants.find((p) => p?.user_id && String(p.user_id) === String(currentUserId));
  const requiredParticipants = (item.match_format || '1v1') === '2v2' ? 4 : 2;
  const isReady = (p: Participant) =>
    p?.ready === true ||
    (typeof p?.ready === 'string' && String(p.ready).toLowerCase() === 'true') ||
    (p?.user_id === item.created_by && p?.ready !== false);
  const readyCount = participants.filter((p) => isReady(p)).length;

  const handleReady = async () => {
    if (!currentUserId || readyLoading) return;
    setReadyLoading(true);
    try {
      await supabase.from('match_participants').update({ ready: true }).eq('match_id', item.id).eq('user_id', currentUserId);
      onRefresh();
    } catch { /* swallow */ }
    finally { setReadyLoading(false); }
  };

  const handleUnready = async () => {
    if (!currentUserId || readyLoading) return;
    setReadyLoading(true);
    try {
      await supabase.from('match_participants').update({ ready: false }).eq('match_id', item.id).eq('user_id', currentUserId);
      onRefresh();
    } catch { /* swallow */ }
    finally { setReadyLoading(false); }
  };

  const statusConfirmed = String(item.status || '').toLowerCase() === 'confirmed';
  const isLocal = String(item.match_type || '').toLowerCase() === 'local';
  const canStartRanked = isRanked && participants.length >= requiredParticipants && (statusConfirmed || readyCount >= requiredParticipants);
  const canStartCasual = !isRanked && !isLocal && participants.length >= requiredParticipants;
  const canStartLocal = isLocal && participants.length >= 1;
  const canStart = canStartRanked || canStartCasual || canStartLocal;

  const handleStart = async () => {
    if (!currentUserId || startStopLoading) return;
    if (!canStart) return;
    setStartStopLoading(true);
    try {
      await supabase.from('matches').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', item.id);
      onRefresh();
    } catch { /* swallow */ }
    finally { setStartStopLoading(false); }
  };

  const handlePause = async () => {
    if (!currentUserId || startStopLoading) return;
    setStartStopLoading(true);
    try {
      await supabase.from('matches').update({ status: 'paused' }).eq('id', item.id);
      onRefresh();
    } catch { /* swallow */ }
    finally { setStartStopLoading(false); }
  };

  const handleResume = async () => {
    if (!currentUserId || startStopLoading) return;
    setStartStopLoading(true);
    try {
      await supabase.from('matches').update({ status: 'in_progress' }).eq('id', item.id);
      onRefresh();
    } catch { /* swallow */ }
    finally { setStartStopLoading(false); }
  };

  const finishWithWinner = async (winnerUserId: string | null) => {
    if (!currentUserId || startStopLoading) return;
    setStartStopLoading(true);
    try {
      const participants = (item.participants ?? []) as Participant[];
      const is2v2 = (item.match_format || '1v1') === '2v2';
      const winnerParticipant = winnerUserId ? participants.find((p) => p.user_id === winnerUserId) : null;
      const winningRole = winnerParticipant?.role;
      const isRanked = item.match_type === 'ranked';
      const vpWinner = isRanked ? 1 : 0;
      const vpLoser = isRanked ? -1 : 0;
      const getResult = (p: Participant): 'win' | 'loss' | 'draw' => {
        if (winnerUserId === null) return 'draw';
        if (is2v2 && winningRole) return p.role === winningRole ? 'win' : 'loss';
        return winnerUserId === p.user_id ? 'win' : 'loss';
      };
      for (const p of participants) {
        const result = getResult(p);
        await supabase.from('match_participants').update({
          result,
          vp_delta: result === 'win' ? vpWinner : result === 'loss' ? vpLoser : 0,
        }).eq('match_id', item.id).eq('user_id', p.user_id);
      }
      await supabase.from('matches').update({ status: 'completed', ended_at: new Date().toISOString() }).eq('id', item.id);

      // Update sport ratings only for ranked matches
      if (item.match_type === 'ranked') {
        const { data: sportRow } = await supabase.from('sports').select('id').eq('name', item.sport_name).maybeSingle();
        if (sportRow?.id) {
          for (const p of participants) {
            const result = getResult(p);
            const vpGain = result === 'win' ? vpWinner : 0;
            await supabase.rpc('upsert_sport_rating', {
              p_user_id: p.user_id,
              p_sport_id: sportRow.id,
              p_vp_gain: vpGain,
              p_is_win: result === 'win',
              p_is_loss: result === 'loss',
            });
          }
        }
      }

      const { data: myProfile } = await supabase.from('profiles').select('username, full_name').eq('user_id', currentUserId).maybeSingle();
      const finisherName = myProfile?.full_name ?? myProfile?.username ?? 'Someone';
      const matchTypeLabel = item.match_type ? String(item.match_type).charAt(0).toUpperCase() + String(item.match_type).slice(1) : 'Match';
      for (const p of participants) {
        if (p.user_id !== currentUserId) {
          await supabase.from('notifications').insert({
            user_id: p.user_id,
            type: 'match_finished',
            title: `${matchTypeLabel} match finished`,
            body: winnerUserId === null ? `${finisherName} marked the match as a draw.` : `${finisherName} finished the match.`,
            data: { match_id: item.id, from_user_id: currentUserId },
          });
        }
      }
      onRefresh();
    } catch { /* swallow */ }
    finally { setStartStopLoading(false); }
  };

  const handleFinish = () => {
    if (!currentUserId || startStopLoading) return;
    setWinnerPickerVisible(true);
  };

  const selectWinner = (userId: string | null) => {
    setWinnerPickerVisible(false);
    finishWithWinner(userId);
  };

  const handleAddGame = () => {
    setLocalGames((prev) => [...prev, { score_challenger: '', score_opponent: '' }]);
  };

  const performSaveGames = async () => {
    if (!currentUserId) return;
    setSaving(true);
    try {
      await supabase.from('match_games').delete().eq('match_id', item.id);
      for (let i = 0; i < localGames.length; i++) {
        const sc = parseInt(localGames[i].score_challenger, 10) || 0;
        const so = parseInt(localGames[i].score_opponent, 10) || 0;
        await supabase.from('match_games').insert({ match_id: item.id, game_number: i + 1, score_challenger: sc, score_opponent: so });
      }
      const totalP1 = localGames.reduce((a, g) => a + (parseInt(g.score_challenger, 10) || 0), 0);
      const totalP2 = localGames.reduce((a, g) => a + (parseInt(g.score_opponent, 10) || 0), 0);
      if (p1) await supabase.from('match_participants').update({ score: String(totalP1) }).eq('match_id', item.id).eq('user_id', p1.user_id);
      if (p2) await supabase.from('match_participants').update({ score: String(totalP2) }).eq('match_id', item.id).eq('user_id', p2.user_id);
      onRefresh();
    } catch { /* swallow */ }
    finally {
      setSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  const handleSaveAnyway = () => {
    setSaveValidationError(null);
    performSaveGames();
  };

  const handleSaveGames = async () => {
    if (!currentUserId || saving) return;
    const errors: string[] = [];
    for (let i = 0; i < localGames.length; i++) {
      const sc = parseInt(localGames[i].score_challenger, 10) || 0;
      const so = parseInt(localGames[i].score_opponent, 10) || 0;
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
      await supabase.from('match_images').insert({ match_id: item.id, user_id: currentUserId, file_path: filePath, sort_order: images.length });
      onRefresh();
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Could not add image.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteImage = async (img: MatchImage) => {
    try {
      await supabase.storage.from('match-images').remove([img.file_path]);
      await supabase.from('match_images').delete().eq('id', img.id);
      setDeleteImageId(null);
      onRefresh();
    } catch (e: any) {
      Alert.alert('Delete failed', e?.message ?? 'Could not delete image.');
    }
  };

  const handleDelete = async () => {
    if (!currentUserId || deleteLoading) return;
    setDeleteLoading(true);
    try {
      await supabase.from('matches').delete().eq('id', item.id);
      onRefresh();
    } catch { /* swallow */ }
    finally { setDeleteLoading(false); }
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
    <>
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
        {onEditMatch && (
          <TouchableOpacity
            style={{ padding: spacing.xs }}
            onPress={() => onEditMatch(item)}
            hitSlop={8}
          >
            <Ionicons name="pencil" size={18} color={colors.textSecondary} />
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
          {dateStr} · Created {createdTime}{startedTime ? ` · Started ${startedTime}` : ''}
        </Text>
      </View>

      <View style={styles.playersRow}>
        <View style={styles.playerCol}>
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
          {p1 && String(p1.user_id) === String(currentUserId) && (
            <Text style={[typography.caption, { fontSize: 11, color: colors.primary, fontWeight: '500' }]}>You</Text>
          )}
          {isRanked && p1 && (item.status === 'pending' || item.status === 'confirmed') && (
            <Text style={[typography.caption, { fontSize: 12, fontWeight: '500', color: isReady(p1) ? colors.primary : colors.textSecondary }]}>
              {isReady(p1) ? 'Ready ✓' : 'Not ready'}
            </Text>
          )}
        </View>
        <View style={styles.vsCol}>
          {((isCompleted || isInProgress || isPaused) && hasScore) || (isCompleted && !hasScore) ? (
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
                    const winner = participants.find((p) => p?.result === 'win');
                    return winner ? (
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
                          🏆 {getName(winner)} Wins!
                        </Text>
                      </View>
                    ) : null;
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
                  <TouchableOpacity
                    style={[styles.readyUpCenterButtonSmall, readyLoading && { opacity: 0.6 }, styles.readyUpUnreadyBtn]}
                    onPress={handleUnready}
                    disabled={readyLoading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close-circle" size={14} color="#b91c1c" />
                    <Text style={[styles.readyUpCenterTextSmall, { color: '#b91c1c' }]}>Unready</Text>
                  </TouchableOpacity>
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
          {p2 ? (
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
              {p2 && String(p2.user_id) === String(currentUserId) && (
                <Text style={[typography.caption, { fontSize: 11, color: colors.primary, fontWeight: '500' }]}>You</Text>
              )}
              {isRanked && p2 && (item.status === 'pending' || item.status === 'confirmed') && (
                <Text style={[typography.caption, { fontSize: 12, fontWeight: '500', color: isReady(p2) ? colors.primary : colors.textSecondary }]}>
                  {isReady(p2) ? 'Ready ✓' : 'Not ready'}
                </Text>
              )}
            </>
          ) : (
            <>
              {onInviteOpponent && canControl ? (
                <TouchableOpacity
                  onPress={() => onInviteOpponent(item)}
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
                <Ionicons name="play" size={14} color={colors.textOnPrimary} />
                <Text style={styles.startButtonText}>Start match</Text>
              </TouchableOpacity>
            )}
            {item.status === 'in_progress' && (
              <TouchableOpacity
                style={[styles.pauseButton, startStopLoading && { opacity: 0.6 }]}
                onPress={handlePause}
                disabled={startStopLoading}
                activeOpacity={0.8}
              >
                <Ionicons name="pause" size={14} color="#FFF" />
                <Text style={styles.pauseButtonText}>Pause</Text>
              </TouchableOpacity>
            )}
            {item.status === 'paused' && (
              <>
                <TouchableOpacity
                  style={[styles.resumeButton, startStopLoading && { opacity: 0.6 }]}
                  onPress={handleResume}
                  disabled={startStopLoading}
                  activeOpacity={0.8}
                >
                  <Ionicons name="play" size={16} color="#FFF" />
                  <Text style={styles.resumeButtonText}>Resume</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.startButton, startStopLoading && { opacity: 0.6 }]}
                  onPress={handleFinish}
                  disabled={startStopLoading}
                  activeOpacity={0.8}
                >
                  <Ionicons name="flag" size={16} color={colors.textOnPrimary} />
                  <Text style={styles.startButtonText}>Finish</Text>
                </TouchableOpacity>
              </>
            )}
            {String(item.created_by) === String(currentUserId) && (
              <TouchableOpacity
                style={[styles.deleteButton, deleteLoading && { opacity: 0.6 }]}
                onPress={handleDelete}
                disabled={deleteLoading}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={14} color={colors.error} />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
          {(item.status === 'in_progress' || item.status === 'paused') && (
            <View style={styles.gamesEditSection}>
                {/* Player name header — aligns above each input column */}
                <View style={styles.scoreHeaderRow}>
                  <View style={{ width: 28 }} />
                  <Text style={styles.scoreHeaderName} numberOfLines={1}>{p1 ? getName(p1) : 'Challenger'}</Text>
                  <View style={{ width: 20 }} />
                  <Text style={styles.scoreHeaderName} numberOfLines={1}>{p2 ? getName(p2) : 'Opponent'}</Text>
                </View>
                {localGames.map((game, idx) => (
                  <View key={idx} style={styles.gameRow}>
                    <Text style={styles.gameLabel}>G{idx + 1}</Text>
                    <TextInput
                      style={styles.scoreInput}
                      value={game.score_challenger}
                      onChangeText={(t) => setLocalGames((prev) => {
                        const next = [...prev]; next[idx] = { ...next[idx], score_challenger: t }; return next;
                      })}
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                    />
                    <Text style={styles.scoreEditVs}>–</Text>
                    <TextInput
                      style={styles.scoreInput}
                      value={game.score_opponent}
                      onChangeText={(t) => setLocalGames((prev) => {
                        const next = [...prev]; next[idx] = { ...next[idx], score_opponent: t }; return next;
                      })}
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
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
                    <Ionicons name="add" size={18} color={colors.primary} />
                    <Text style={styles.addGameBtnText}>Add game</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveScoreBtn, (saving || saveSuccess) && styles.saveScoreBtnDisabled]} onPress={handleSaveGames} disabled={saving || saveSuccess} activeOpacity={0.8}>
                    {saving ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        <ActivityIndicator size="small" color={colors.textOnPrimary} />
                        <Text style={styles.saveScoreBtnText}>Saving...</Text>
                      </View>
                    ) : saveSuccess ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        <Ionicons name="checkmark-circle" size={18} color={colors.textOnPrimary} />
                        <Text style={styles.saveScoreBtnText}>Saved!</Text>
                      </View>
                    ) : (
                      <Text style={styles.saveScoreBtnText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
          )}
        </View>
      )}

      {/* Horizontal scrollable media row: location → photos → add photo */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm, marginHorizontal: -spacing.md }} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md }}>
        <TouchableOpacity
          style={[styles.mapTile, { width: halfWidth }]}
          activeOpacity={item.location_lat != null ? 0.7 : 1}
          onPress={() => {
            if (item.location_lat != null && item.location_lng != null) {
              const label = encodeURIComponent(item.location_name || 'Match Location');
              const url = Platform.select({
                ios: `maps:0,0?q=${label}&ll=${item.location_lat},${item.location_lng}`,
                android: `geo:${item.location_lat},${item.location_lng}?q=${item.location_lat},${item.location_lng}(${label})`,
                default: `https://www.google.com/maps/dir/?api=1&destination=${item.location_lat},${item.location_lng}`,
              });
              Linking.openURL(url!);
            }
          }}
        >
          <View style={[styles.mapPlaceholder, { width: halfWidth, height: halfWidth * 0.75 }]}>
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
            <View style={styles.mapLabelContainer}>
              <View style={styles.mapLabelPill}>
                <Ionicons name={item.location_lat != null ? 'navigate-outline' : 'location-outline'} size={10} color={colors.textOnPrimary} />
                <Text style={styles.mapLabelText} numberOfLines={1}>{item.location_name || 'Location'}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
        {imagesList.map((img) => (
          <TouchableOpacity
            key={img.id}
            activeOpacity={0.9}
            onPress={() => isParticipant && setDeleteImageId(deleteImageId === img.id ? null : img.id)}
            style={{ width: halfWidth, height: halfWidth * 0.75, borderRadius: borderRadius.md, overflow: 'hidden', backgroundColor: colors.background }}
          >
            {imageUrls[img.id] ? (
              <Image source={{ uri: imageUrls[img.id] }} style={{ width: halfWidth, height: halfWidth * 0.75 }} resizeMode="cover" />
            ) : (
              <View style={{ width: halfWidth, height: halfWidth * 0.75, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="image-outline" size={28} color={colors.textSecondary} />
              </View>
            )}
            {deleteImageId === img.id && (
              <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.md }}>
                <TouchableOpacity
                  onPress={() => handleDeleteImage(img)}
                  style={{ backgroundColor: '#E53935', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Delete</Text>
                </TouchableOpacity>
              </View>
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
          <Text style={styles.actionLabel}>{commentsCount > 0 ? `${commentsCount} ` : ''}Comment</Text>
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
                      {c.created_at ? new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
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
                multiline
                maxLength={500}
                editable={!commentPosting}
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
        <Pressable style={styles.modalBackdrop} onPress={() => setLikersModalVisible(false)}>
          <View style={styles.likersCard} onStartShouldSetResponder={() => true}>
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
        </Pressable>
      </Modal>
    </View>

    <Modal visible={winnerPickerVisible} transparent animationType="fade">
      <Pressable style={styles.winnerPickerBackdrop} onPress={() => setWinnerPickerVisible(false)}>
        <View style={styles.winnerPickerCard} onStartShouldSetResponder={() => true}>
          <Text style={styles.winnerPickerTitle}>Choose winner</Text>
          <Text style={styles.winnerPickerSubtitle}>Who won this match?</Text>
          <View style={styles.winnerPickerOptions}>
            {p1 && (
              <TouchableOpacity
                style={styles.winnerPickerOption}
                onPress={() => selectWinner(p1.user_id)}
                activeOpacity={0.8}
              >
                <View style={styles.winnerPickerAvatarWrap}>
                  {p1AvatarUrl ? (
                    <Image source={{ uri: p1AvatarUrl }} style={styles.winnerPickerAvatarImg} />
                  ) : (
                    <View style={[styles.winnerPickerAvatar, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.winnerPickerInitials, { color: colors.textOnPrimary }]}>{getInitials(p1)}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.winnerPickerName}>{getName(p1)}</Text>
                <Text style={styles.winnerPickerRole}>Challenger</Text>
              </TouchableOpacity>
            )}
            {p2 && (
              <TouchableOpacity
                style={styles.winnerPickerOption}
                onPress={() => selectWinner(p2.user_id)}
                activeOpacity={0.8}
              >
                <View style={styles.winnerPickerAvatarWrap}>
                  {p2AvatarUrl ? (
                    <Image source={{ uri: p2AvatarUrl }} style={styles.winnerPickerAvatarImg} />
                  ) : (
                    <View style={[styles.winnerPickerAvatar, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.winnerPickerInitials, { color: colors.textOnPrimary }]}>{getInitials(p2)}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.winnerPickerName}>{getName(p2)}</Text>
                <Text style={styles.winnerPickerRole}>Opponent</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.winnerPickerOption}
              onPress={() => selectWinner(null)}
              activeOpacity={0.8}
            >
              <View style={[styles.winnerPickerAvatarWrap, styles.winnerPickerDrawWrap]}>
                <Ionicons name="remove-circle-outline" size={36} color={colors.textSecondary} />
              </View>
              <Text style={styles.winnerPickerName}>Draw</Text>
              <Text style={styles.winnerPickerRole}>Tie</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.winnerPickerCancel} onPress={() => setWinnerPickerVisible(false)}>
            <Text style={[styles.winnerPickerCancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
    </>
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
      paddingTop: spacing.md,
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
    gameLabel: { ...typography.label, fontSize: 11, color: colors.textSecondary, width: 28, textAlign: 'right' },
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
    gameActionsRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm, width: '100%' },
    addGameBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: borderRadius.sm,
    },
    addGameBtnText: { ...typography.label, fontSize: 11, color: colors.primary },
    playersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.lg,
      marginTop: spacing.lg
    },
    playerCol: { flex: 1, alignItems: 'center', gap: spacing.xs },
    playerName: { ...typography.label, color: colors.text, textAlign: 'center' },
    vsCol: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
    vsText: {
      ...typography.caption,
      color: '#0F172A',
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
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    matchControlsButtonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginBottom: 0,
    },
    startButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: borderRadius.sm,
    },
    startButtonText: { ...typography.label, fontSize: 11, color: colors.textOnPrimary },
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
      gap: 4,
      backgroundColor: colors.error,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: borderRadius.sm,
    },
    pauseButtonText: { ...typography.label, fontSize: 11, color: '#FFF' },
    resumeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.success,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: borderRadius.sm,
    },
    resumeButtonText: { ...typography.label, fontSize: 11, color: '#FFF' },
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
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: colors.error,
      borderRadius: borderRadius.sm,
    },
    deleteButtonText: { ...typography.label, fontSize: 11, color: colors.error },

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
      paddingTop: spacing.sm,
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
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    commentsLoading: { paddingVertical: spacing.md, alignItems: 'center' },
    commentRow: {
      marginBottom: spacing.xs,
      paddingVertical: spacing.xs,
    },
    commentAuthor: { ...typography.label, fontSize: 13, color: colors.primary, fontWeight: '600' },
    commentDate: { ...typography.caption, fontSize: 12, color: colors.textSecondary },
    commentBody: { ...typography.body, fontSize: 13, color: colors.text },
    commentInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    commentInput: {
      flex: 1,
      height: 40,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.background,
    },
    commentPostBtn: {
      height: 40,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    commentPostBtnDisabled: { opacity: 0.5 },
    commentPostBtnText: { ...typography.label, color: colors.textOnPrimary },
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
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const route = useRoute<RouteProp<TabParamList, 'Home'>>();
  const styles = useMemo(() => createHomeStyles(colors), [colors]);
  const [feedMode, setFeedMode] = useState<FeedMode>('my');
  const [notifsVisible, setNotifsVisible] = useState(false);
  const navigation = useNavigation<any>();
  const feedListRef = useRef<FlatList>(null);
  const notifSlideAnim = useRef(new Animated.Value(-400)).current;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [feedItems, setFeedItems] = useState<FeedMatch[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
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
  const [editMatch, setEditMatch] = useState<FeedMatch | null>(null);
  const [followStates, setFollowStates] = useState<Record<string, 'none' | 'pending' | 'accepted'>>({});

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
      const { data: existing } = await supabase.from('follows').select('id').eq('follower_id', currentUserId).eq('followed_id', fromUserId).maybeSingle();
      if (existing) {
        setFollowStates((prev) => ({ ...prev, [fromUserId]: 'accepted' }));
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

  const loadFeed = useCallback(async (showLoading = true) => {
    if (showLoading) setLoadingFeed(true);
    try {
      const { data } = await supabase
        .from('match_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      const newItems = (data ?? []) as FeedMatch[];
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
      const items = (data ?? []) as NotificationItem[];
      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.read).length);
      // Refresh feed when we have match_accepted so ranked ready-up/start updates immediately
      const hasMatchAccepted = items.some((n) => n.type === 'match_accepted');
      if (hasMatchAccepted) loadFeed(false);
      // Refresh follow states so "Follow back" button is accurate
      refreshFollowStates();
    } catch { /* swallow */ }
  }, [loadFeed, refreshFollowStates]);

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

  useEffect(() => { loadFeed(); loadNotifications(); loadUnreadDmCount(); }, [loadFeed, loadNotifications, loadUnreadDmCount]);

  useEffect(() => {
    if (isFocused) { loadFeed(); loadNotifications(); loadUnreadDmCount(); }
  }, [isFocused, loadFeed, loadNotifications, loadUnreadDmCount]);

  useEffect(() => {
    if (!isFocused || !currentUserId) return;
    const channel = supabase
      .channel('matches-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        loadFeed(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_participants' }, () => {
        loadFeed(false);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isFocused, currentUserId, loadFeed]);

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

  useEffect(() => {
    if (!isFocused) return;
    const interval = setInterval(() => {
      loadFeed(false);
      loadNotifications();
    }, hasPendingRankedMatch ? 5000 : 20000);
    return () => clearInterval(interval);
  }, [isFocused, loadFeed, loadNotifications, hasPendingRankedMatch]);

  const myFeed = useMemo(
    () => feedItems.filter((m) => (m.participants ?? []).some((p) => p.user_id === currentUserId)),
    [feedItems, currentUserId],
  );
  const publicFeed = useMemo(
    () => feedItems.filter((m) => (m.status === 'confirmed' || m.status === 'completed') && (m.is_public !== false)),
    [feedItems],
  );
  const displayedItems = feedMode === 'my' ? myFeed : publicFeed;

  useEffect(() => {
    const matchId = route.params?.scrollToMatchId;
    if (!matchId) return;
    setFeedMode('my');
    const idx = myFeed.findIndex((i) => i.id === matchId);
    if (idx >= 0) {
      setTimeout(() => feedListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 }), 400);
    }
    navigation.setParams({ scrollToMatchId: undefined } as any);
  }, [route.params?.scrollToMatchId, myFeed]);

  const inviteExcludeIds = useMemo(() => {
    if (!inviteOpponentMatch) return undefined;
    return (inviteOpponentMatch.participants ?? []).map((p: Participant) => p?.user_id).filter(Boolean) as string[];
  }, [inviteOpponentMatch]);

  const handleAcceptInvite = async (notif: NotificationItem) => {
    const matchId = notif.data?.match_id;
    if (!matchId || !currentUserId) return;
    const slot = notif.data?.slot as string | undefined;
    const role = slot === 'teammate' ? 'challenger' : 'opponent';
    try {
      await supabase.from('match_participants').insert({
        match_id: matchId,
        user_id: currentUserId,
        role,
      });
      const { data: match } = await supabase.from('matches').select('invited_opponent_id, invited_teammate_id, invited_opponent_2_id, match_type').eq('id', matchId).single();
      const m = match as { invited_opponent_id?: string; invited_teammate_id?: string; invited_opponent_2_id?: string; match_type?: string } | null;
      const updatePayload: Record<string, unknown> = {};
      if (slot === 'opponent') updatePayload.invited_opponent_id = null;
      else if (slot === 'teammate') updatePayload.invited_teammate_id = null;
      else if (slot === 'opponent_2') updatePayload.invited_opponent_2_id = null;
      else updatePayload.invited_opponent_id = null;
      const others = [
        slot !== 'opponent' && m?.invited_opponent_id,
        slot !== 'teammate' && m?.invited_teammate_id,
        slot !== 'opponent_2' && m?.invited_opponent_2_id,
      ].filter(Boolean);
      if (others.length === 0) updatePayload.status = 'confirmed';
      await supabase.from('matches').update(updatePayload).eq('id', matchId);
      await supabase.from('notifications').update({ read: true }).eq('id', notif.id);

      const fromUserId = notif.data?.from_user_id;
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
      loadFeed();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not accept invite.');
    }
  };

  const handleDeclineInvite = async (notif: NotificationItem) => {
    const matchId = notif.data?.match_id;
    if (!matchId || !currentUserId) return;
    const slot = notif.data?.slot as string | undefined;
    try {
      const updatePayload: Record<string, unknown> = {};
      if (slot === 'teammate') updatePayload.invited_teammate_id = null;
      else if (slot === 'opponent_2') updatePayload.invited_opponent_2_id = null;
      else updatePayload.invited_opponent_id = null;
      await supabase.from('matches').update(updatePayload).eq('id', matchId);
      await supabase.from('notifications').update({ read: true }).eq('id', notif.id);

      const fromUserId = notif.data?.from_user_id;
      if (fromUserId) {
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('username')
          .eq('user_id', currentUserId)
          .maybeSingle();
        const { data: matchRow } = await supabase.from('matches').select('match_type').eq('id', matchId).single();
        const matchTypeLabel = (matchRow as { match_type?: string })?.match_type ? String((matchRow as { match_type?: string }).match_type).charAt(0).toUpperCase() + String((matchRow as { match_type?: string }).match_type).slice(1) : 'Match';
        await supabase.from('notifications').insert({
          user_id: fromUserId,
          type: 'match_declined',
          title: `${myProfile?.username ?? 'Your opponent'} declined your ${matchTypeLabel} match invite`,
          body: 'The match invite was declined.',
          data: { match_id: matchId, from_user_id: currentUserId },
        });
      }

      loadNotifications();
      loadFeed();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not decline invite.');
    }
  };

  const handleInviteOpponent = async (match: FeedMatch, user: SearchedUser) => {
    if (!currentUserId) return;
    setInviteOpponentMatch(null);
    try {
      await supabase.from('matches').update({ invited_opponent_id: user.user_id }).eq('id', match.id);
      const { data: myProfile } = await supabase.from('profiles').select('username').eq('user_id', currentUserId).maybeSingle();
      const sportLabel = match.sport_name ?? 'Match';
      const matchType = match.match_type ?? 'casual';
      const matchTypeLabel = String(matchType).charAt(0).toUpperCase() + String(matchType).slice(1);
      const notifBody = `${sportLabel} ${matchType} - ${myProfile?.username ?? 'Someone'} invited you!`;
      await supabase.from('notifications').insert({
        user_id: user.user_id,
        type: 'match_invite',
        title: `${myProfile?.username ?? 'Someone'} challenged you to a ${matchTypeLabel} match!`,
        body: notifBody,
        data: { match_id: match.id, from_user_id: currentUserId, slot: 'opponent' },
      });
      loadFeed();
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
        <Text style={styles.topBarTitle}>Home</Text>
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
          keyExtractor={(item) => `${item.id}-${item.status}-${(item.participants ?? []).length}-${(item.participants ?? []).map((p: Participant) => p?.ready).join(',')}`}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => feedListRef.current?.scrollToIndex({ index: info.index, animated: true }), 100);
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={() => { loadFeed(); loadNotifications(); loadUnreadDmCount(); }}
          refreshing={loadingFeed}
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
              onInviteOpponent={setInviteOpponentMatch}
              onEditMatch={setEditMatch}
              navigation={navigation}
            />
          )}
        />
      )}

      {/* ---- Edit match modal ---- */}
      <EditMatchModal
        visible={!!editMatch}
        onClose={() => setEditMatch(null)}
        onSaved={() => { loadFeed(); setEditMatch(null); }}
        colors={colors}
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
        } : null}
      />

      {/* ---- Invite opponent modal ---- */}
      <Modal visible={!!inviteOpponentMatch} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setInviteOpponentMatch(null)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite opponent</Text>
              <TouchableOpacity onPress={() => setInviteOpponentMatch(null)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>Search by username or name (min 2 characters)</Text>
            <UserSearch
              colors={colors}
              excludeUserId={currentUserId ?? undefined}
              excludeUserIds={inviteExcludeIds}
              placeholder="Search by username or name..."
              onSelect={(user) => inviteOpponentMatch && handleInviteOpponent(inviteOpponentMatch, user)}
            />
          </View>
        </View>
      </Modal>

      {/* ---- Notifications modal ---- */}
      <Modal visible={notifsVisible} transparent animationType="fade">
        <Pressable
          style={[styles.modalBackdrop, { justifyContent: 'flex-start' }]}
          onPress={closeNotifications}
        >
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
        </Pressable>
      </Modal>

    </View>
  );
}
