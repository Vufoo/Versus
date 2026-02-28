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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
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
    return (
      <View style={{ alignItems: 'center', position: 'relative' }}>
        <View
          style={{
            borderWidth: 3,
            borderColor: colors.primary,
            borderRadius: size / 2 + 4,
            padding: 4,
          }}
        >
          {avatarContent}
        </View>
        <View
          style={{
            position: 'absolute',
            top: -6,
            left: '50%',
            marginLeft: -10,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="trophy" size={12} color={colors.textOnPrimary} />
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

function FeedCard({
  item,
  currentUserId,
  styles,
  colors,
  onRefresh,
  onInviteOpponent,
}: {
  item: FeedMatch;
  currentUserId: string | null;
  styles: ReturnType<typeof createHomeStyles>;
  colors: ThemeColors;
  onRefresh: () => void;
  onInviteOpponent?: (match: FeedMatch) => void;
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
    : isInProgress ? elapsedMs : 0;

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
  const canStartRanked = isRanked && participants.length >= requiredParticipants && (statusConfirmed || readyCount >= requiredParticipants);
  const canStartCasual = !isRanked;
  const canStart = canStartRanked || canStartCasual;

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
      const vpWinner = item.match_type === 'ranked' ? 25 : 0;
      const vpLoser = 0;
      for (const p of participants) {
        const result = winnerUserId === null ? 'draw' : (is2v2 && winningRole ? p.role === winningRole ? 'win' : 'loss' : winnerUserId === p.user_id ? 'win' : 'loss');
        await supabase.from('match_participants').update({
          result,
          vp_delta: result === 'win' ? vpWinner : result === 'loss' ? vpLoser : 0,
        }).eq('match_id', item.id).eq('user_id', p.user_id);
      }
      await supabase.from('matches').update({ status: 'completed', ended_at: new Date().toISOString() }).eq('id', item.id);
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
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri;
    setSaving(true);
    try {
      const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const filePath = `${item.id}/${currentUserId}/${Date.now()}.${ext}`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error: uploadErr } = await supabase.storage.from('match-images').upload(filePath, blob, { contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`, upsert: false });
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
  const winnerVp = Math.max(p1?.vp_delta ?? 0, p2?.vp_delta ?? 0);
  const vpChange = winnerVp > 0 ? `+${winnerVp}` : '0';
  const isWin = winnerVp > 0;

  const d = item.scheduled_at ? new Date(item.scheduled_at) : new Date(item.created_at);
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const statusLabel = item.status === 'pending' ? 'Pending' : item.status === 'confirmed' ? 'Confirmed' : item.status === 'in_progress' ? 'In progress' : item.status === 'paused' ? 'Paused' : item.status === 'completed' ? 'Completed' : item.status;

  const createdStr = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const startedStr = item.started_at ? new Date(item.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;

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
            <Text style={styles.creatorLabel}>Created by {creator ? getName(creator) : 'Unknown'}</Text>
          </View>
          <View style={styles.timestampsRow}>
            <Text style={styles.timestampText}>Created: {createdStr}</Text>
            {startedStr && <Text style={styles.timestampText}>Started: {startedStr}</Text>}
            {durationMs > 0 && <Text style={styles.timestampText}>Duration: {formatDuration(durationMs)}</Text>}
          </View>
        </View>
        <View style={styles.sportBadge}>
          <Text style={styles.sportEmoji}>{SPORT_EMOJI[item.sport_name] ?? '🏆'}</Text>
          <Text style={styles.sportName}>{item.sport_name}</Text>
        </View>
      </View>

      <View style={styles.playersRow}>
        <View style={styles.playerCol}>
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
          <Text style={styles.vsText}>vs</Text>
          {((isCompleted || isInProgress || isPaused) && hasScore) || (isCompleted && !hasScore) ? (
            <View style={{ alignItems: 'center' }}>
              {isCompleted && participants.every((p) => p?.result === 'draw') ? (
                <>
                  <Text style={[styles.scoreText, { color: colors.textSecondary }]}>Draw</Text>
                  {hasScore && displayScoreMain ? <Text style={[typography.caption, { fontSize: 12, color: colors.textSecondary, marginTop: 2 }]}>{displayScoreMain}</Text> : null}
                </>
              ) : (
                <>
                  {hasScore && <Text style={styles.scoreText}>{displayScoreMain}</Text>}
                  {hasScore && displayScoreSub && (
                    <Text style={[typography.caption, { fontSize: 11, color: colors.textSecondary, marginTop: 2 }]}>
                      {displayScoreSub}
                    </Text>
                  )}
                  {isCompleted && (() => {
                    const winner = participants.find((p) => p?.result === 'win');
                    return winner ? (
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.primary, marginTop: hasScore ? 6 : 0, letterSpacing: 0.5 }}>
                        🏆 {getName(winner)} wins!
                      </Text>
                    ) : null;
                  })()}
                </>
              )}
              <Text style={[typography.caption, { fontSize: 10, color: colors.textSecondary, marginTop: 2 }]}>
                {p1 ? getName(p1) : 'Challenger'} — {p2 ? getName(p2) : 'Opponent'}
              </Text>
            </View>
          ) : isRanked && (item.status === 'pending' || item.status === 'confirmed') ? (
            <View style={{ alignItems: 'center', gap: 2, marginTop: 8 }}>
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
            <Text style={[styles.scoreText, { fontSize: 12, color: colors.textSecondary }]}>{statusLabel}</Text>
          )}
        </View>
        <View style={styles.playerCol}>
          {p2 ? (
            <>
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
          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.detailText}>{dateStr}</Text>
          </View>
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
        {isCompleted && (
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
                <Ionicons name="play" size={16} color={colors.textOnPrimary} />
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
                <Ionicons name="pause" size={16} color="#FFF" />
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
            <TouchableOpacity
              style={[styles.deleteButton, deleteLoading && { opacity: 0.6 }]}
              onPress={handleDelete}
              disabled={deleteLoading}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={14} color={colors.error} />
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
          {(item.status === 'in_progress' || item.status === 'paused') && (
            <View style={styles.gamesEditSection}>
                {localGames.map((game, idx) => (
                  <View key={idx} style={styles.gameRow}>
                    <Text style={styles.gameLabel}>Game {idx + 1}</Text>
                    <View style={styles.scoreCol}>
                      <Text style={styles.scorePlayerLabel}>{p1 ? getName(p1) : 'Challenger'}</Text>
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
                    </View>
                    <Text style={styles.scoreEditVs}>-</Text>
                    <View style={styles.scoreCol}>
                      <Text style={styles.scorePlayerLabel}>{p2 ? getName(p2) : 'Opponent'}</Text>
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

      {/* Map (left half) + Add photos (right half) */}
      <View style={[styles.mediaRow, { marginBottom: spacing.md }]}>
        <View style={[styles.mapTile, { width: halfWidth, flex: 1 }]}>
          <View style={[styles.mapPlaceholder, { width: halfWidth, height: 120 }]}>
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
                <Ionicons name="location-outline" size={10} color={colors.textOnPrimary} />
                <Text style={styles.mapLabelText} numberOfLines={1}>{item.location_name || 'Location'}</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={[styles.photosHalf, { width: halfWidth }]}>
          {imagesList.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.xs }} contentContainerStyle={{ gap: spacing.xs }}>
              {imagesList.map((img) => (
                <View key={img.id} style={{ width: 56, height: 56, borderRadius: borderRadius.sm, overflow: 'hidden', backgroundColor: colors.background }}>
                  {imageUrls[img.id] ? (
                    <Image source={{ uri: imageUrls[img.id] }} style={{ width: 56, height: 56 }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
          {isParticipant ? (
            <TouchableOpacity style={[styles.addMediaTile, { flex: 1, minHeight: 80 }]} onPress={handleAddImage} disabled={saving} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={32} color={colors.primary} />
              <Text style={styles.addMediaText}>Add photo</Text>
            </TouchableOpacity>
          ) : imagesList.length === 0 ? (
            <View style={[styles.addMediaTile, { flex: 1, minHeight: 80, opacity: 0.5 }]}>
              <Ionicons name="images-outline" size={32} color={colors.textSecondary} />
              <Text style={[styles.addMediaText, { color: colors.textSecondary }]}>No photos</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleToggleLike} activeOpacity={0.8}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? colors.primary : colors.textSecondary} />
          <Text style={[styles.actionLabel, liked && { color: colors.primary, fontWeight: '600' }]}>
            {likesCount > 0 ? `${likesCount} ` : ''}{liked ? 'Liked' : 'Like'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8}>
          <Ionicons name="chatbubble-outline" size={17} color={colors.textSecondary} />
          <Text style={styles.actionLabel}>{item.comments_count > 0 ? `${item.comments_count} ` : ''}Comment</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.8}>
          <Ionicons name="share-outline" size={17} color={colors.textSecondary} />
          <Text style={styles.actionLabel}>Share</Text>
        </TouchableOpacity>
      </View>
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
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stravaHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    creatorBlock: { flex: 1 },
    creatorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    creatorLabel: { ...typography.caption, fontSize: 12, color: colors.textSecondary },
    timestampsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    timestampText: { ...typography.caption, fontSize: 11, color: colors.textSecondary },
    sportBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    mediaRow: { flexDirection: 'row', gap: spacing.sm },
    mapTile: { borderRadius: borderRadius.md, overflow: 'hidden' },
    photosHalf: { flex: 1, justifyContent: 'center' },
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
    gameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.md },
    gameLabel: { ...typography.label, fontSize: 12, color: colors.textSecondary, width: 56 },
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
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: borderRadius.md,
    },
    addGameBtnText: { ...typography.label, fontSize: 12, color: colors.primary },
    playersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    playerCol: { flex: 1, alignItems: 'center', gap: spacing.xs },
    playerName: { ...typography.label, color: colors.text, textAlign: 'center' },
    vsCol: { alignItems: 'center', paddingHorizontal: spacing.sm },
    vsText: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    scoreText: { ...typography.heading, fontSize: 16, color: colors.text },

    sportRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    sportEmoji: { fontSize: 18 },
    sportName: { ...typography.label, color: colors.primary, flex: 1, textTransform: 'uppercase' },
    vpPill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.full,
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
      paddingTop: spacing.md,
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
      marginBottom: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    matchControlsButtonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    startButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
    },
    startButtonText: { ...typography.label, color: colors.textOnPrimary },
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
      paddingVertical: 4,
      borderRadius: borderRadius.sm,
      marginTop: 2,
    },
    readyUpCenterTextSmall: { ...typography.label, fontSize: 12, fontWeight: '600', color: colors.textOnPrimary },
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
      gap: spacing.xs,
      backgroundColor: colors.error,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
    },
    pauseButtonText: { ...typography.label, color: '#FFF' },
    resumeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.success,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
    },
    resumeButtonText: { ...typography.label, color: '#FFF' },
    scoreEditRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    scoreInput: {
      width: 44,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.background,
    },
    scoreEditVs: { ...typography.label, color: colors.textSecondary },
    saveScoreBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.sm,
    },
    saveScoreBtnDisabled: { opacity: 0.8 },
    saveScoreBtnText: { ...typography.label, color: colors.textOnPrimary },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderWidth: 1,
      borderColor: colors.error,
      borderRadius: borderRadius.md,
    },
    deleteButtonText: { ...typography.label, fontSize: 12, color: colors.error },

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
      gap: spacing.lg,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    actionLabel: { ...typography.caption, color: colors.textSecondary },

    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-start',
    },
    modalCard: {
      backgroundColor: colors.surface,
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
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
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
  const styles = useMemo(() => createHomeStyles(colors), [colors]);
  const [feedMode, setFeedMode] = useState<FeedMode>('my');
  const [searchVisible, setSearchVisible] = useState(false);
  const [notifsVisible, setNotifsVisible] = useState(false);
  const navigation = useNavigation<any>();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [feedItems, setFeedItems] = useState<FeedMatch[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [followStates, setFollowStates] = useState<Record<string, 'none' | 'pending' | 'accepted'>>({});
  const [togglingFollow, setTogglingFollow] = useState<string | null>(null);
  const [inviteOpponentMatch, setInviteOpponentMatch] = useState<FeedMatch | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: fRows } = await supabase
        .from('follows')
        .select('followed_id, status')
        .eq('follower_id', user.id);
      if (fRows) {
        const map: Record<string, 'pending' | 'accepted'> = {};
        for (const r of fRows as any[]) map[r.followed_id] = r.status;
        setFollowStates(map);
      }
    })();
  }, []);

  const sendFollowRequest = async (targetUserId: string) => {
    if (!currentUserId || togglingFollow) return;
    setTogglingFollow(targetUserId);
    try {
      const current = followStates[targetUserId];
      if (current === 'pending' || current === 'accepted') {
        await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('followed_id', targetUserId);
        setFollowStates((prev) => { const next = { ...prev }; delete next[targetUserId]; return next; });
      } else {
        await supabase.from('follows').insert({ follower_id: currentUserId, followed_id: targetUserId, status: 'pending' });
        setFollowStates((prev) => ({ ...prev, [targetUserId]: 'pending' }));

        const { data: myProfile } = await supabase.from('profiles').select('username, full_name').eq('user_id', currentUserId).maybeSingle();
        const displayName = myProfile?.full_name ?? myProfile?.username ?? 'Someone';
        await supabase.from('notifications').insert({
          user_id: targetUserId,
          type: 'follow_request',
          title: `${displayName} wants to follow you`,
          body: 'Accept or ignore this follow request.',
          data: { from_user_id: currentUserId },
        });
      }
    } catch { /* swallow */ }
    finally { setTogglingFollow(null); }
  };

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
    } catch { /* swallow */ }
  }, [loadFeed]);

  useEffect(() => { loadFeed(); loadNotifications(); }, [loadFeed, loadNotifications]);

  useEffect(() => {
    if (isFocused) { loadFeed(); loadNotifications(); }
  }, [isFocused, loadFeed, loadNotifications]);

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
        <TouchableOpacity
          style={styles.topBarIcon}
          activeOpacity={0.8}
          onPress={() => setSearchVisible(true)}
        >
          <Ionicons name="search" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Versus</Text>
        <View style={styles.topBarRight}>
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
      {feedMode === 'public' && (
        <Text style={styles.switcherHint}>All confirmed & completed matches</Text>
      )}

      {/* ---- Feed ---- */}
      {loadingFeed ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={displayedItems}
          keyExtractor={(item) => `${item.id}-${item.status}-${(item.participants ?? []).length}-${(item.participants ?? []).map((p: Participant) => p?.ready).join(',')}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={() => { loadFeed(); loadNotifications(); }}
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
            />
          )}
        />
      )}

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

      {/* ---- Search modal ---- */}
      <Modal visible={searchVisible} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setSearchVisible(false)}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Find people</Text>
              <TouchableOpacity onPress={() => setSearchVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <UserSearch
              colors={colors}
              excludeUserId={currentUserId ?? undefined}
              placeholder="Search by username or name..."
              onSelect={() => {}}
              renderAction={(user) => {
                const state = followStates[user.user_id] ?? 'none';
                const label = state === 'accepted' ? 'Following' : state === 'pending' ? 'Requested' : 'Follow';
                const isMuted = state !== 'none';
                return (
                  <TouchableOpacity
                    style={[styles.addBtn, isMuted && { backgroundColor: colors.border }]}
                    activeOpacity={0.8}
                    onPress={() => sendFollowRequest(user.user_id)}
                    disabled={togglingFollow === user.user_id}
                  >
                    {togglingFollow === user.user_id ? (
                      <ActivityIndicator size="small" color={isMuted ? colors.text : colors.textOnPrimary} />
                    ) : (
                      <Text style={[styles.addBtnText, isMuted && { color: colors.text }]}>
                        {label}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>

      {/* ---- Notifications modal ---- */}
      <Modal visible={notifsVisible} transparent animationType="slide">
        <Pressable
          style={[styles.modalBackdrop, { justifyContent: 'flex-end' }]}
          onPress={() => setNotifsVisible(false)}
        >
          <View style={styles.notifModalCard} onStartShouldSetResponder={() => true}>
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
                <TouchableOpacity onPress={() => setNotifsVisible(false)} hitSlop={12}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
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
                    </View>
                    {!n.read && <View style={styles.notifUnreadDot} />}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

    </View>
  );
}
