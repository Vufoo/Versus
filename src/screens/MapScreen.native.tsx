import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Alert,
  Animated,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Callout, CalloutSubview, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { spacing, typography, borderRadius } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import { useLocation } from '../hooks/useLocation';
import { supabase, resolveAvatarUrl } from '../lib/supabase';
import { sportLabel } from '../constants/sports';
import NewMatchModal from '../components/NewMatchModal';

const versusPin = require('../../assets/versus_blue.png');
const versusDarkPin = require('../../assets/versus_dark.png');

function formatNearbyPlace(addr: Location.LocationGeocodedAddress | null): string {
  if (!addr) return '';
  const parts: string[] = [];
  if (addr.name) parts.push(addr.name);
  else if (addr.street) parts.push([addr.streetNumber, addr.street].filter(Boolean).join(' '));
  if (addr.district) parts.push(addr.district);
  if (addr.city) parts.push(addr.city);
  if (addr.region && addr.region !== addr.city) parts.push(addr.region);
  if (parts.length > 0) return parts.slice(0, 3).join(' · ');
  if (addr.formattedAddress) return addr.formattedAddress.split(',')[0]?.trim() ?? '';
  return '';
}

const DEFAULT_REGION = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const NEARBY_DELTA = 0.0725; // ~5 miles latitude
const NEARBY_RADIUS_METERS = 8047; // 5 miles in meters

type NearbyUser = {
  user_id: string;
  last_lat: number;
  last_lng: number;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  isFriend: boolean;
};

type NearbyMatch = {
  id: string;
  location_lat: number;
  location_lng: number;
  location_name: string | null;
  sport_name: string;
  match_type: string;
  match_format: string;
  status: string;
  is_public: boolean;
  created_by: string;
  scheduled_at: string | null;
  ended_at: string | null;
  creator_username: string | null;
  participant_count: number;
  isFriendMatch: boolean;
  isCurrentUserParticipant: boolean;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    title: { ...typography.heading, color: colors.text },
    subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
    mapContainer: { flex: 1, minHeight: 400 },
    map: { width: '100%', height: '100%' },
    centerBtn: {
      position: 'absolute',
      bottom: spacing.lg,
      right: spacing.lg,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 4,
      elevation: 4,
    },
    filterRow: {
      position: 'absolute',
      top: spacing.md,
      left: spacing.md,
      right: spacing.md,
      flexDirection: 'column',
      gap: spacing.sm,
    },
    filterChipRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    radiusChip: {
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 4,
      borderRadius: borderRadius.full,
      backgroundColor: 'rgba(255,255,255,0.92)',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.1)',
    },
    radiusChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primaryDark,
    },
    radiusChipText: { ...typography.label, fontSize: 11, color: colors.textSecondary },
    radiusChipTextActive: { color: colors.textOnPrimary },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 1 },
      shadowRadius: 2,
      elevation: 2,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primaryDark,
    },
    filterChipText: { ...typography.label, fontSize: 12, color: colors.textSecondary },
    filterChipTextActive: { color: colors.textOnPrimary },
    statusBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.cardBg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    statusText: { ...typography.caption, color: colors.textSecondary },
    statusError: { ...typography.caption, color: colors.error },
    coordsValue: { ...typography.caption, color: colors.text, fontWeight: '600' },
    calloutContainer: {
      width: 230,
      backgroundColor: '#fff',
      borderRadius: borderRadius.md,
      padding: spacing.md,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 6,
      elevation: 4,
    },
    calloutTitle: { ...typography.label, color: '#000', fontSize: 14, marginBottom: 2 },
    calloutSport: { ...typography.caption, color: '#555', fontSize: 12, marginBottom: 4 },
    calloutDetail: { ...typography.caption, color: '#777', fontSize: 11, marginBottom: 2 },
    profilePin: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 2.5,
      borderColor: colors.primary,
      overflow: 'hidden',
      backgroundColor: colors.cardBg,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 4,
      elevation: 4,
    },
    myPin: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: '#22C55E',
      overflow: 'hidden',
      backgroundColor: colors.cardBg,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 5,
      elevation: 5,
    },
    profilePinImage: {
      width: '100%',
      height: '100%',
    },
    profilePinFallback: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    profilePinInitial: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '700' as const,
    },
    calloutFriendBadge: {
      alignSelf: 'flex-start',
      backgroundColor: '#1E3A8A',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginBottom: 4,
    },
    calloutFriendBadgeText: { ...typography.label, color: '#FFF', fontSize: 10 },
    calloutJoin: {
      marginTop: spacing.sm,
      backgroundColor: '#1E3A8A',
      paddingVertical: 6,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.sm,
      alignItems: 'center',
    },
    calloutJoinText: { ...typography.label, color: '#FFF', fontSize: 12 },
    fab: {
      position: 'absolute',
      bottom: spacing.lg,
      left: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.full,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowOffset: { width: 0, height: 3 },
      shadowRadius: 6,
      elevation: 5,
    },
    fabText: { ...typography.label, color: colors.textOnPrimary, fontSize: 14 },
    droppedPinBar: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    droppedPinInfo: { flex: 1 },
    droppedPinName: { ...typography.label, color: colors.text, fontSize: 14 },
    droppedPinCoords: { ...typography.caption, color: colors.textSecondary, fontSize: 11, marginTop: 2 },
    droppedPinActions: { flexDirection: 'row', gap: spacing.sm },
    droppedPinBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
    },
    droppedPinBtnText: { ...typography.label, color: colors.textOnPrimary, fontSize: 13 },
    droppedPinCancel: {
      padding: spacing.sm,
    },
  });
}

export default function MapScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const location = useLocation({ watch: true });
  const { status, coords, error } = location;
  const mapRef = useRef<MapView>(null);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [nearbyMatches, setNearbyMatches] = useState<NearbyMatch[]>([]);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [nearbyPlace, setNearbyPlace] = useState<string | null>(null);
  const [showPlayers, setShowPlayers] = useState(true);
  const [showMatches, setShowMatches] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ avatar_url: string | null; username: string | null; full_name: string | null } | null>(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [joiningMatchId, setJoiningMatchId] = useState<string | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(5);
  const radiusRef = useRef(5);

  const [refreshing, setRefreshing] = useState(false);

  // Ref to always call the latest loadNearby (used by expiry timeouts)
  const loadNearbyRef = useRef<() => void>(() => {});

  // Stable ref for coords so loadNearby doesn't need to be recreated on every GPS update
  const coordsRef = useRef(coords);
  useEffect(() => { coordsRef.current = coords; }, [coords]);

  // Dropped pin for creating a match
  const [droppedPin, setDroppedPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [droppedPinName, setDroppedPinName] = useState('');
  const [showNewMatch, setShowNewMatch] = useState(false);
  const droppedPinBounce = useRef(new Animated.Value(0)).current;

  const region = useMemo(() => {
    if (coords) {
      return {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    return DEFAULT_REGION;
  }, [coords]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url, username, full_name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile) {
        const p = profile as { avatar_url: string | null; username: string | null; full_name: string | null };
        setCurrentUserProfile(p);
        const resolved = await resolveAvatarUrl(p.avatar_url);
        setMyAvatarUrl(resolved);
      }
    })();
  }, []);

  useEffect(() => {
    if (!coords) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('location_visibility').eq('user_id', user.id).maybeSingle();
      if ((p as { location_visibility?: string })?.location_visibility !== 'public') return;
      await supabase
        .from('profiles')
        .update({ last_lat: coords.latitude, last_lng: coords.longitude })
        .eq('user_id', user.id);
    })();
  }, [coords?.latitude, coords?.longitude]);

  const loadNearby = useCallback(async () => {
    const c = coordsRef.current;
    if (!c) return;
    try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const miles = radiusRef.current;
    const nearbyDelta = miles / 69; // 1 degree lat ≈ 69 miles
    const latMin = c.latitude - nearbyDelta;
    const latMax = c.latitude + nearbyDelta;
    const lngMin = c.longitude - nearbyDelta;
    const lngMax = c.longitude + nearbyDelta;
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

    const profileCols = 'user_id, last_lat, last_lng, username, full_name, avatar_url';
    const matchCols = 'id, location_lat, location_lng, location_name, match_type, status, is_public, created_by, scheduled_at, match_format, sport_id, ended_at';

    // Round 1: follows + nearby profiles (within bbox) + matches — all parallel
    // NOTE: profiles use last_lat/last_lng; matches use location_lat/location_lng
    const [followsRes, nearbyProfilesRes, activeRes, recentCompletedRes] = await Promise.all([
      supabase.from('follows')
        .select('follower_id, followed_id')
        .or(`follower_id.eq.${user.id},followed_id.eq.${user.id}`)
        .eq('status', 'accepted'),
      supabase.from('profiles').select(profileCols)
        .eq('location_visibility', 'public')
        .not('last_lat', 'is', null)
        .not('last_lng', 'is', null)
        .neq('user_id', user.id)
        .gte('last_lat', latMin).lte('last_lat', latMax)
        .gte('last_lng', lngMin).lte('last_lng', lngMax),
      supabase.from('matches').select(matchCols)
        .not('location_lat', 'is', null).not('location_lng', 'is', null)
        .gte('location_lat', latMin).lte('location_lat', latMax)
        .gte('location_lng', lngMin).lte('location_lng', lngMax)
        .in('status', ['pending', 'confirmed', 'in_progress', 'paused']),
      supabase.from('matches').select(matchCols)
        .not('location_lat', 'is', null).not('location_lng', 'is', null)
        .gte('location_lat', latMin).lte('location_lat', latMax)
        .gte('location_lng', lngMin).lte('location_lng', lngMax)
        .eq('status', 'completed')
        .gte('ended_at', oneMinuteAgo),
    ]);

    // Build friend id set
    const ids = new Set<string>();
    for (const f of followsRes.data ?? []) {
      ids.add(f.follower_id === user.id ? f.followed_id : f.follower_id);
    }
    setFriendIds(ids);

    const bboxMatchRows = [...(activeRes.data ?? []), ...(recentCompletedRes.data ?? [])];
    const bboxMatchIdSet = new Set(bboxMatchRows.map((m: any) => m.id));

    // Round 2: friend profiles (no range limit) + friend-created matches anywhere on the map
    // Friends and their matches are always visible regardless of the radius setting
    const [friendProfilesRes, friendActiveRes, friendCompletedRes] = await Promise.all([
      ids.size > 0
        ? supabase.from('profiles').select(profileCols)
            .in('user_id', [...ids])
            .eq('location_visibility', 'public')
            .not('last_lat', 'is', null)
            .not('last_lng', 'is', null)
            .neq('user_id', user.id)
        : Promise.resolve({ data: [] as any[] }),
      // Friend-created active matches anywhere (no bbox)
      ids.size > 0
        ? supabase.from('matches').select(matchCols)
            .not('location_lat', 'is', null).not('location_lng', 'is', null)
            .in('created_by', [...ids])
            .in('status', ['pending', 'confirmed', 'in_progress', 'paused'])
        : Promise.resolve({ data: [] as any[] }),
      // Friend-created recently completed matches anywhere (no bbox)
      ids.size > 0
        ? supabase.from('matches').select(matchCols)
            .not('location_lat', 'is', null).not('location_lng', 'is', null)
            .in('created_by', [...ids])
            .eq('status', 'completed')
            .gte('ended_at', oneMinuteAgo)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    // Merge match rows: bbox results + friend matches outside bbox (deduped)
    const extraFriendMatches = [
      ...((friendActiveRes as any).data ?? []),
      ...((friendCompletedRes as any).data ?? []),
    ].filter((m: any) => !bboxMatchIdSet.has(m.id));
    const matchRows = [...bboxMatchRows, ...extraFriendMatches];

    // Round 3: sports + creators + participants for all combined match rows
    const [sportsRes, creatorsRes, participantsRes] = await Promise.all([
      matchRows.length > 0
        ? supabase.from('sports').select('id, name')
            .in('id', [...new Set(matchRows.map((m: any) => m.sport_id).filter(Boolean))])
        : Promise.resolve({ data: [] as any[] }),
      matchRows.length > 0
        ? supabase.from('profiles').select('user_id, username')
            .in('user_id', [...new Set(matchRows.map((m: any) => m.created_by).filter(Boolean))])
        : Promise.resolve({ data: [] as any[] }),
      matchRows.length > 0
        ? supabase.from('match_participants').select('match_id, user_id')
            .in('match_id', matchRows.map((m: any) => m.id))
        : Promise.resolve({ data: [] as any[] }),
    ]);

    // Merge profiles: start with bbox results, then add friends outside range (deduplicated)
    const profileMap = new Map<string, any>();
    for (const p of (nearbyProfilesRes.data ?? [])) profileMap.set(p.user_id, p);
    for (const p of ((friendProfilesRes as any).data ?? [])) {
      if (!profileMap.has(p.user_id)) profileMap.set(p.user_id, p);
    }
    const usersRaw: NearbyUser[] = [...profileMap.values()].map((p: any) => ({
      user_id: p.user_id,
      last_lat: p.last_lat,
      last_lng: p.last_lng,
      username: p.username,
      full_name: p.full_name,
      avatar_url: p.avatar_url ?? null,
      isFriend: ids.has(p.user_id),
    }));
    // Resolve signed avatar URLs for all friend pins (same fix as "my pin")
    const users = await Promise.all(usersRaw.map(async (u) => ({
      ...u,
      avatar_url: await resolveAvatarUrl(u.avatar_url),
    })));
    setNearbyUsers(users);

    if (matchRows.length === 0) {
      setNearbyMatches([]);
      return;
    }

    const sportMap = new Map(((sportsRes as any).data ?? []).map((s: any) => [s.id, s.name]));
    const creatorMap = new Map(((creatorsRes as any).data ?? []).map((p: any) => [p.user_id, p.username]));

    const participantsByMatch = new Map<string, string[]>();
    for (const p of ((participantsRes as any).data ?? [])) {
      const list = participantsByMatch.get(p.match_id) ?? [];
      list.push(p.user_id);
      participantsByMatch.set(p.match_id, list);
    }

    const visibleMatches: NearbyMatch[] = [];
    for (const m of matchRows) {
      const participants = participantsByMatch.get(m.id) ?? [];
      const isCreator = m.created_by === user.id;
      const isParticipant = participants.includes(user.id);
      const isFriendCreator = ids.has(m.created_by);
      const hasFriendParticipant = participants.some((uid: string) => ids.has(uid));
      const isFriendMatch = isFriendCreator || hasFriendParticipant;

      // Private matches: only show if current user is involved, or a friend is playing
      if (!m.is_public && !isCreator && !isParticipant && !isFriendMatch) continue;

      visibleMatches.push({
        id: m.id,
        location_lat: Number(m.location_lat),
        location_lng: Number(m.location_lng),
        location_name: m.location_name,
        sport_name: sportMap.get(m.sport_id) ?? 'Unknown',
        match_type: m.match_type,
        match_format: m.match_format ?? '1v1',
        status: m.status,
        is_public: m.is_public,
        created_by: m.created_by,
        scheduled_at: m.scheduled_at,
        ended_at: m.ended_at ?? null,
        creator_username: creatorMap.get(m.created_by) ?? null,
        participant_count: participants.length,
        isFriendMatch,
        isCurrentUserParticipant: isCreator || isParticipant,
      });
    }
    setNearbyMatches(visibleMatches);

    // Schedule a reload for each recently-completed match when its 60s window expires
    for (const m of visibleMatches) {
      if (m.status === 'completed' && m.ended_at) {
        const expiresIn = 60000 - (Date.now() - new Date(m.ended_at).getTime());
        if (expiresIn > 0) {
          setTimeout(() => loadNearbyRef.current(), expiresIn + 500);
        }
      }
    }
    } catch { /* swallow — network or DB errors should not crash the map */ }
  }, []); // stable — reads coords via coordsRef so no need to recreate on GPS updates

  // Keep ref pointing to latest loadNearby so expiry timeouts always call the current version
  useEffect(() => { loadNearbyRef.current = loadNearby; }, [loadNearby]);

  // Sync radius ref and reload when user changes radius
  useEffect(() => {
    radiusRef.current = radiusMiles;
    loadNearby();
  }, [radiusMiles, loadNearby]);

  // handleRefresh must come AFTER loadNearby since it depends on it
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadNearby();
    } finally {
      setRefreshing(false);
    }
  }, [loadNearby]);

  useEffect(() => {
    loadNearby();
    const interval = setInterval(loadNearby, 30000);
    return () => clearInterval(interval);
  }, [loadNearby]);


  useEffect(() => {
    if (!coords || status !== 'granted') return;
    let cancelled = false;
    (async () => {
      try {
        const [addr] = await Location.reverseGeocodeAsync({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        if (!cancelled) setNearbyPlace(formatNearbyPlace(addr ?? null) || null);
      } catch {
        if (!cancelled) setNearbyPlace(null);
      }
    })();
    return () => { cancelled = true; };
  }, [coords?.latitude, coords?.longitude, status]);

  useEffect(() => {
    if (coords && mapRef.current) {
      mapRef.current.animateToRegion(region, 500);
    }
  }, [coords?.latitude, coords?.longitude]);

  const centerOnUser = () => {
    if (coords && mapRef.current) {
      mapRef.current.animateToRegion(region, 500);
    }
  };

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const [addr] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (!addr) return '';
      const parts: string[] = [];
      if (addr.name && addr.name !== String(addr.streetNumber)) parts.push(addr.name);
      else if (addr.street) parts.push([addr.streetNumber, addr.street].filter(Boolean).join(' '));
      if (addr.city) parts.push(addr.city);
      if (addr.region && addr.region !== addr.city) parts.push(addr.region);
      return parts.slice(0, 3).join(', ') || addr.formattedAddress?.split(',').slice(0, 2).join(',') || '';
    } catch {
      return '';
    }
  };

  const handleMapLongPress = async (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setDroppedPin({ latitude, longitude });
    droppedPinBounce.setValue(0);
    Animated.spring(droppedPinBounce, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }).start();
    const name = await reverseGeocode(latitude, longitude);
    setDroppedPinName(name);
  };

  const clearDroppedPin = () => {
    setDroppedPin(null);
    setDroppedPinName('');
  };

  const openNewMatchAtPin = () => {
    setShowNewMatch(true);
  };

  const handleJoinMatch = async (match: NearbyMatch) => {
    if (!currentUserId) return;
    if (match.created_by === currentUserId) {
      Alert.alert('Your match', 'You created this match.');
      return;
    }
    setJoiningMatchId(match.id);
    try {
      // Check current participant count from DB (fresh check)
      const maxSlots = match.match_format === '2v2' ? 4 : 2;
      const { count: freshCount } = await supabase
        .from('match_participants')
        .select('id', { count: 'exact', head: true })
        .eq('match_id', match.id);
      if ((freshCount ?? 0) >= maxSlots) {
        Alert.alert('Match is full', `This match already has ${maxSlots}/${maxSlots} players.`);
        loadNearby();
        return;
      }

      const { count } = await supabase
        .from('match_participants')
        .select('id', { count: 'exact', head: true })
        .eq('match_id', match.id)
        .eq('user_id', currentUserId);
      if (count && count > 0) {
        Alert.alert('Already joined', 'You are already in this match.');
        return;
      }

      await supabase.from('match_participants').insert({
        match_id: match.id,
        user_id: currentUserId,
        role: 'opponent',
      });

      // Confirm match now that both slots are filled (freshCount was 1 before joining)
      if ((freshCount ?? 0) + 1 >= maxSlots) {
        await supabase.from('matches').update({ status: 'confirmed' }).eq('id', match.id);
      }

      const { data: myProfile } = await supabase.from('profiles').select('username').eq('user_id', currentUserId).maybeSingle();
      await Promise.all([
        // Notify the creator
        supabase.from('notifications').insert({
          user_id: match.created_by,
          type: 'match_joined',
          title: `${(myProfile as any)?.username ?? 'Someone'} joined your ${sportLabel(match.sport_name)} match!`,
          body: `A player joined your ${match.match_type} match${match.location_name ? ` at ${match.location_name}` : ''}.`,
          data: { match_id: match.id, from_user_id: currentUserId },
        }),
        // Delete any pending match_invite notification for this match sent to us
        supabase.from('notifications')
          .delete()
          .eq('user_id', currentUserId)
          .eq('type', 'match_invite')
          .filter('data->>match_id', 'eq', match.id),
      ]);

      Alert.alert('Joined!', `You joined the ${sportLabel(match.sport_name)} match.`);
      loadNearby();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not join match.');
      loadNearby(); // refresh to remove any stale pins
    } finally {
      setJoiningMatchId(null);
    }
  };

  const matchStatusLabel = (s: string) => {
    switch (s) {
      case 'pending': return 'Open';
      case 'confirmed': return 'Confirmed';
      case 'in_progress': return 'Live';
      case 'paused': return 'Paused';
      case 'completed': return 'Just finished';
      default: return s;
    }
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + spacing.lg }]}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Map</Text>
          <Text style={styles.subtitle}>
            Your location · Nearby players and open matches
          </Text>
        </View>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={coords ? region : DEFAULT_REGION}
          showsMyLocationButton={false}
          showsCompass
          mapType="standard"
          onLongPress={handleMapLongPress}
          onPress={() => { if (droppedPin) clearDroppedPin(); }}
        >
          {/* Current user's profile picture pin */}
          {coords && (
            <Marker coordinate={{ latitude: coords.latitude, longitude: coords.longitude }} anchor={{ x: 0.5, y: 0.5 }} zIndex={10}>
              <View style={styles.myPin}>
                {myAvatarUrl ? (
                  <Image source={{ uri: myAvatarUrl }} style={styles.profilePinImage} />
                ) : (
                  <View style={styles.profilePinFallback}>
                    <Text style={styles.profilePinInitial}>
                      {((currentUserProfile?.full_name ?? currentUserProfile?.username ?? 'Me')[0]).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            </Marker>
          )}

          {/* Range indicator */}
          {coords && (
            <Circle
              center={{ latitude: coords.latitude, longitude: coords.longitude }}
              radius={radiusMiles * 1609.34}
              fillColor="rgba(30, 58, 138, 0.06)"
              strokeColor="rgba(30, 58, 138, 0.45)"
              strokeWidth={2}
            />
          )}

          {showPlayers && nearbyUsers.map((u) => {
            if (u.isFriend) {
              // Friend: profile picture pin with callout
              const initial = (u.full_name ?? u.username ?? '?')[0].toUpperCase();
              return (
                <Marker
                  key={`user-${u.user_id}`}
                  coordinate={{ latitude: u.last_lat, longitude: u.last_lng }}
                >
                  <View style={styles.profilePin}>
                    {u.avatar_url ? (
                      <Image source={{ uri: u.avatar_url }} style={styles.profilePinImage} />
                    ) : (
                      <View style={styles.profilePinFallback}>
                        <Text style={styles.profilePinInitial}>{initial}</Text>
                      </View>
                    )}
                  </View>
                  <Callout tooltip={false}>
                    <View style={styles.calloutContainer}>
                      <Text style={styles.calloutTitle}>{u.full_name ?? u.username ?? 'Friend'}</Text>
                      {u.username ? <Text style={styles.calloutSport}>@{u.username}</Text> : null}
                    </View>
                  </Callout>
                </Marker>
              );
            }
            // Non-friend nearby user: simple grey dot pin, no callout
            return (
              <Marker
                key={`user-${u.user_id}`}
                coordinate={{ latitude: u.last_lat, longitude: u.last_lng }}
                pinColor={colors.textSecondary}
              />
            );
          })}

          {showMatches && nearbyMatches.map((m) => {
            const maxSlots = m.match_format === '2v2' ? 4 : 2;
            const isFull = m.participant_count >= maxSlots;
            const canJoin = m.is_public && !m.isCurrentUserParticipant && m.status !== 'completed';
            // Friend matches shown slightly larger so they stand out
            const pinSize = m.isFriendMatch ? 42 : 36;
            return (
              <Marker
                key={`match-${m.id}`}
                coordinate={{ latitude: m.location_lat, longitude: m.location_lng }}
              >
                <Image source={versusPin} style={{ width: pinSize, height: pinSize, resizeMode: 'contain' }} />
                <Callout tooltip={true}>
                  <View style={styles.calloutContainer}>
                    {m.isFriendMatch && (
                      <View style={styles.calloutFriendBadge}>
                        <Text style={styles.calloutFriendBadgeText}>Following</Text>
                      </View>
                    )}
                    <Text style={styles.calloutTitle}>
                      {sportLabel(m.sport_name)} {m.match_format}
                    </Text>
                    <Text style={styles.calloutSport}>
                      {m.match_type.charAt(0).toUpperCase() + m.match_type.slice(1)} · {matchStatusLabel(m.status)}
                    </Text>
                    {m.location_name && (
                      <Text style={styles.calloutDetail} numberOfLines={1}>
                        {m.location_name}
                      </Text>
                    )}
                    <Text style={styles.calloutDetail}>
                      By @{m.creator_username ?? 'unknown'} · {m.participant_count}/{maxSlots} players
                    </Text>
                    {m.scheduled_at && m.status !== 'completed' && (
                      <Text style={styles.calloutDetail}>
                        {new Date(m.scheduled_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </Text>
                    )}
                    {canJoin && !isFull && (
                      <CalloutSubview onPress={() => handleJoinMatch(m)}>
                        <View style={styles.calloutJoin}>
                          <Text style={styles.calloutJoinText}>
                            {joiningMatchId === m.id ? 'Joining...' : 'Join match'}
                          </Text>
                        </View>
                      </CalloutSubview>
                    )}
                    {canJoin && isFull && (
                      <View style={[styles.calloutJoin, { backgroundColor: '#888' }]}>
                        <Text style={styles.calloutJoinText}>Full ({m.participant_count}/{maxSlots})</Text>
                      </View>
                    )}
                    {!m.is_public && (
                      <Text style={[styles.calloutDetail, { fontStyle: 'italic' }]}>Private match</Text>
                    )}
                  </View>
                </Callout>
              </Marker>
            );
          })}

          {droppedPin && (
            <Marker
              coordinate={droppedPin}
              draggable
              onDragEnd={async (e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                setDroppedPin({ latitude, longitude });
                const name = await reverseGeocode(latitude, longitude);
                setDroppedPinName(name);
              }}
            >
              <Animated.View style={{ transform: [{ scale: droppedPinBounce }] }}>
                <Image source={versusPin} style={{ width: 44, height: 44, resizeMode: 'contain' }} />
              </Animated.View>
            </Marker>
          )}
        </MapView>

        <View style={styles.filterRow}>
          <View style={styles.filterChipRow}>
            <TouchableOpacity
              style={[styles.filterChip, showPlayers && styles.filterChipActive]}
              onPress={() => setShowPlayers((p) => !p)}
              activeOpacity={0.8}
            >
              <Ionicons name="people" size={14} color={showPlayers ? colors.textOnPrimary : colors.textSecondary} />
              <Text style={[styles.filterChipText, showPlayers && styles.filterChipTextActive]}>Players</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, showMatches && styles.filterChipActive]}
              onPress={() => setShowMatches((p) => !p)}
              activeOpacity={0.8}
            >
              <Ionicons name="trophy" size={14} color={showMatches ? colors.textOnPrimary : colors.textSecondary} />
              <Text style={[styles.filterChipText, showMatches && styles.filterChipTextActive]}>Matches</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.filterChipRow}>
            {([1, 3, 5, 10] as const).map((mi) => (
              <TouchableOpacity
                key={mi}
                style={[styles.radiusChip, radiusMiles === mi && styles.radiusChipActive]}
                onPress={() => setRadiusMiles(mi)}
                activeOpacity={0.8}
              >
                <Text style={[styles.radiusChipText, radiusMiles === mi && styles.radiusChipTextActive]}>{mi}mi</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {!droppedPin && (
          <TouchableOpacity style={styles.fab} onPress={() => setShowNewMatch(true)} activeOpacity={0.85}>
            <Ionicons name="add" size={20} color={colors.textOnPrimary} />
            <Text style={styles.fabText}>New Match</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.centerBtn} onPress={centerOnUser} activeOpacity={0.8}>
          <Ionicons name="locate" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {droppedPin ? (
        <View style={styles.droppedPinBar}>
          <Image source={versusPin} style={{ width: 32, height: 32, resizeMode: 'contain' }} />
          <View style={styles.droppedPinInfo}>
            <Text style={styles.droppedPinName} numberOfLines={1}>
              {droppedPinName || 'Pinned location'}
            </Text>
            <Text style={styles.droppedPinCoords}>
              {droppedPin.latitude.toFixed(5)}, {droppedPin.longitude.toFixed(5)}
            </Text>
          </View>
          <View style={styles.droppedPinActions}>
            <TouchableOpacity style={styles.droppedPinBtn} onPress={openNewMatchAtPin} activeOpacity={0.85}>
              <Ionicons name="trophy" size={16} color={colors.textOnPrimary} />
              <Text style={styles.droppedPinBtnText}>Create match</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.droppedPinCancel} onPress={clearDroppedPin} hitSlop={8}>
              <Ionicons name="close-circle" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.statusBar}>
          {status === 'pending' && (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.statusText}>Getting your location...</Text>
            </View>
          )}
          {status === 'denied' && (
            <Text style={styles.statusError}>
              Enable location in Settings to see yourself on the map.
            </Text>
          )}
          {status === 'error' && (
            <Text style={styles.statusError}>{error ?? 'Location error'}</Text>
          )}
          {status === 'granted' && coords && (
            <Text style={styles.coordsValue} numberOfLines={1}>
              {nearbyUsers.length} player{nearbyUsers.length !== 1 ? 's' : ''} · {nearbyMatches.length} match{nearbyMatches.length !== 1 ? 'es' : ''}{nearbyMatches.some(m => m.isFriendMatch) ? ` (${nearbyMatches.filter(m => m.isFriendMatch).length} friends)` : ''}{nearbyPlace ? ` · ${nearbyPlace}` : ''} · Hold to pin
            </Text>
          )}
        </View>
      )}

      <NewMatchModal
        visible={showNewMatch}
        onClose={() => { setShowNewMatch(false); clearDroppedPin(); }}
        onCreated={() => { setShowNewMatch(false); clearDroppedPin(); loadNearby(); }}
        colors={colors}
        initialLocation={droppedPin ? { latitude: droppedPin.latitude, longitude: droppedPin.longitude, name: droppedPinName } : null}
      />
    </ScrollView>
  );
}
