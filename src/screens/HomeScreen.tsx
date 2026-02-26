import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../constants/theme';
import { sportLabel, SPORT_EMOJI, validateGameScore } from '../constants/sports';
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
  data: { match_id?: string; from_user_id?: string };
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
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
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
}: {
  item: FeedMatch;
  currentUserId: string | null;
  styles: ReturnType<typeof createHomeStyles>;
  colors: ThemeColors;
  onRefresh: () => void;
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
  const [deleteLoading, setDeleteLoading] = useState(false);
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

  const handleStart = async () => {
    if (!currentUserId || startStopLoading) return;
    setStartStopLoading(true);
    try {
      await supabase.from('matches').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', item.id);
      onRefresh();
    } catch { /* swallow */ }
    finally { setStartStopLoading(false); }
  };

  const handleStop = async () => {
    if (!currentUserId || startStopLoading) return;
    setStartStopLoading(true);
    try {
      await supabase.from('matches').update({ status: 'completed', ended_at: new Date().toISOString() }).eq('id', item.id);
      onRefresh();
    } catch { /* swallow */ }
    finally { setStartStopLoading(false); }
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

  const statusLabel = item.status === 'pending' ? 'Pending' : item.status === 'confirmed' ? 'Confirmed' : item.status === 'in_progress' ? 'In progress' : item.status === 'completed' ? 'Completed' : item.status;

  const createdStr = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const startedStr = item.started_at ? new Date(item.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;

  const totalP1 = localGames.reduce((a, g) => a + (parseInt(g.score_challenger, 10) || 0), 0);
  const totalP2 = localGames.reduce((a, g) => a + (parseInt(g.score_opponent, 10) || 0), 0);
  const displayScore = (totalP1 || totalP2) ? `${totalP1} - ${totalP2}` : null;
  const imagesList = (item.images ?? []) as MatchImage[];
  const mediaWidth = Dimensions.get('window').width - 4 * spacing.lg;

  return (
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
        </View>
        <View style={styles.vsCol}>
          <Text style={styles.vsText}>vs</Text>
          {(isCompleted || isInProgress) && displayScore ? (
            <Text style={styles.scoreText}>{displayScore}</Text>
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
            </>
          ) : (
            <>
              <Avatar initials="?" size={44} colors={colors} />
              <Text style={styles.playerName}>TBD</Text>
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
              <Text style={styles.detailText}>{item.match_type.charAt(0).toUpperCase() + item.match_type.slice(1)}</Text>
            </View>
          )}
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
            {item.status !== 'in_progress' && item.status !== 'completed' && (
              <TouchableOpacity
                style={[styles.startButton, startStopLoading && { opacity: 0.6 }]}
                onPress={handleStart}
                disabled={startStopLoading}
                activeOpacity={0.8}
              >
                <Ionicons name="play" size={16} color={colors.textOnPrimary} />
                <Text style={styles.startButtonText}>Start match</Text>
              </TouchableOpacity>
            )}
            {item.status === 'in_progress' && (
              <TouchableOpacity
                style={[styles.stopButton, startStopLoading && { opacity: 0.6 }]}
                onPress={handleStop}
                disabled={startStopLoading}
                activeOpacity={0.8}
              >
                <Ionicons name="stop" size={16} color="#FFF" />
                <Text style={styles.stopButtonText}>Stop</Text>
              </TouchableOpacity>
            )}
            {(item.status === 'in_progress' || item.status === 'completed') && (
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
          {item.status === 'in_progress' && (
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

      {/* Map + Images (below delete button) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.mediaScroll}
        contentContainerStyle={styles.mediaScrollContent}
      >
        <View style={[styles.mapTile, { width: mediaWidth }]}>
          <View style={[styles.mapPlaceholder, { width: mediaWidth, height: 140 }]}>
            <View style={styles.mapGridLines}>
              <View style={[styles.mapGridH, { top: '25%' }]} />
              <View style={[styles.mapGridH, { top: '50%' }]} />
              <View style={[styles.mapGridH, { top: '75%' }]} />
              <View style={[styles.mapGridV, { left: '25%' }]} />
              <View style={[styles.mapGridV, { left: '50%' }]} />
              <View style={[styles.mapGridV, { left: '75%' }]} />
            </View>
            <View style={styles.mapPinContainer}>
              <Ionicons name="location" size={28} color={colors.primary} />
            </View>
            <View style={styles.mapLabelContainer}>
              <View style={styles.mapLabelPill}>
                <Ionicons name="location-outline" size={10} color={colors.textOnPrimary} />
                <Text style={styles.mapLabelText} numberOfLines={1}>{item.location_name || 'Location'}</Text>
              </View>
            </View>
          </View>
        </View>
        {imagesList.map((img) => (
          <View key={img.id} style={styles.mediaTile}>
            {imageUrls[img.id] ? (
              <Image source={{ uri: imageUrls[img.id] }} style={styles.mediaImage} resizeMode="cover" />
            ) : (
              <View style={[styles.mediaImage, styles.mediaPlaceholder]}>
                <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
              </View>
            )}
          </View>
        ))}
        {isParticipant && (
          <View style={[styles.addMediaTileWrap, { width: mediaWidth }]}>
            <TouchableOpacity style={styles.addMediaTile} onPress={handleAddImage} disabled={saving} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={36} color={colors.primary} />
              <Text style={styles.addMediaText}>Add photo</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

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
    mediaScroll: { marginHorizontal: -spacing.lg, marginBottom: spacing.md },
    mediaScrollContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
    mapTile: { height: 140, borderRadius: borderRadius.md, overflow: 'hidden' },
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
    matchControlsRow: {
      flexDirection: 'column',
      alignItems: 'center',
      marginBottom: spacing.md,
      paddingTop: spacing.sm,
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

    msgModalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl,
      maxHeight: '85%',
    },
    chatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    chatInfo: { flex: 1 },
    chatName: { ...typography.body, fontWeight: '600', color: colors.text },
    chatPreview: { ...typography.caption, color: colors.textSecondary },
    chatTime: { ...typography.caption, color: colors.textSecondary },
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
  });
}

const PLACEHOLDER_CHATS = [
  { id: '1', name: 'Alex M.', initials: 'AM', preview: 'Good game yesterday!', time: '2h ago' },
  { id: '2', name: 'Jamie P.', initials: 'JP', preview: 'Rematch this weekend?', time: '5h ago' },
  { id: '3', name: 'Pickleball Group', initials: 'PG', preview: "Who's free Saturday?", time: '1d ago' },
];

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
  const [messagesVisible, setMessagesVisible] = useState(false);
  const [notifsVisible, setNotifsVisible] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [feedItems, setFeedItems] = useState<FeedMatch[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [followStates, setFollowStates] = useState<Record<string, 'none' | 'pending' | 'accepted'>>({});
  const [togglingFollow, setTogglingFollow] = useState<string | null>(null);

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

  const loadFeed = useCallback(async () => {
    setLoadingFeed(true);
    try {
      const { data } = await supabase
        .from('match_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setFeedItems((data ?? []) as FeedMatch[]);
    } catch { /* swallow */ }
    finally { setLoadingFeed(false); }
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
    } catch { /* swallow */ }
  }, []);

  useEffect(() => { loadFeed(); loadNotifications(); }, [loadFeed, loadNotifications]);

  useEffect(() => {
    if (isFocused) { loadFeed(); loadNotifications(); }
  }, [isFocused, loadFeed, loadNotifications]);

  const myFeed = useMemo(
    () => feedItems.filter((m) => (m.participants ?? []).some((p) => p.user_id === currentUserId)),
    [feedItems, currentUserId],
  );
  const publicFeed = useMemo(
    () => feedItems.filter((m) => m.status === 'confirmed' || m.status === 'completed'),
    [feedItems],
  );
  const displayedItems = feedMode === 'my' ? myFeed : publicFeed;

  const handleAcceptInvite = async (notif: NotificationItem) => {
    const matchId = notif.data?.match_id;
    if (!matchId || !currentUserId) return;
    try {
      await supabase.from('matches').update({ status: 'confirmed' }).eq('id', matchId);
      await supabase.from('notifications').update({ read: true }).eq('id', notif.id);

      const fromUserId = notif.data?.from_user_id;
      if (fromUserId) {
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('username')
          .eq('user_id', currentUserId)
          .maybeSingle();
        await supabase.from('notifications').insert({
          user_id: fromUserId,
          type: 'match_accepted',
          title: `${myProfile?.username ?? 'Your opponent'} accepted!`,
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
    try {
      await supabase.from('matches').update({ status: 'canceled' }).eq('id', matchId);
      await supabase.from('notifications').update({ read: true }).eq('id', notif.id);

      const fromUserId = notif.data?.from_user_id;
      if (fromUserId) {
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('username')
          .eq('user_id', currentUserId)
          .maybeSingle();
        await supabase.from('notifications').insert({
          user_id: fromUserId,
          type: 'match_declined',
          title: `${myProfile?.username ?? 'Your opponent'} declined`,
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

  const openNotifs = () => {
    setNotifsVisible(true);
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
            onPress={() => setMessagesVisible(true)}
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
          keyExtractor={(item) => item.id}
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
            <FeedCard item={item} currentUserId={currentUserId} styles={styles} colors={colors} onRefresh={loadFeed} />
          )}
        />
      )}

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
              <TouchableOpacity onPress={() => setNotifsVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
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

      {/* ---- Messages modal ---- */}
      <Modal visible={messagesVisible} transparent animationType="slide">
        <Pressable
          style={[styles.modalBackdrop, { justifyContent: 'flex-end' }]}
          onPress={() => setMessagesVisible(false)}
        >
          <View style={styles.msgModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Messages</Text>
              <TouchableOpacity onPress={() => setMessagesVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
              {PLACEHOLDER_CHATS.map((chat) => (
                <TouchableOpacity key={chat.id} style={styles.chatRow} activeOpacity={0.7}>
                  <Avatar initials={chat.initials} size={44} colors={colors} />
                  <View style={styles.chatInfo}>
                    <Text style={styles.chatName}>{chat.name}</Text>
                    <Text style={styles.chatPreview} numberOfLines={1}>
                      {chat.preview}
                    </Text>
                  </View>
                  <Text style={styles.chatTime}>{chat.time}</Text>
                </TouchableOpacity>
              ))}
              <Text style={styles.emptyText}>
                More chats will appear as you play matches and connect with friends.
              </Text>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
