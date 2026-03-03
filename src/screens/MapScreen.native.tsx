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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { spacing, typography, borderRadius } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import { useLocation } from '../hooks/useLocation';
import { supabase } from '../lib/supabase';
import { sportLabel } from '../constants/sports';
import NewMatchModal from '../components/NewMatchModal';

const versusPin = require('../../assets/versus_blue.png');

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

const NEARBY_DELTA = 0.05;

type NearbyUser = {
  user_id: string;
  last_lat: number;
  last_lng: number;
  username: string | null;
  full_name: string | null;
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
  creator_username: string | null;
  participant_count: number;
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
      flexDirection: 'row',
      gap: spacing.sm,
    },
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
      width: 220,
      padding: spacing.md,
    },
    calloutTitle: { ...typography.label, color: '#000', fontSize: 14, marginBottom: 2 },
    calloutSport: { ...typography.caption, color: '#555', fontSize: 12, marginBottom: 4 },
    calloutDetail: { ...typography.caption, color: '#777', fontSize: 11, marginBottom: 2 },
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
  const [joiningMatchId, setJoiningMatchId] = useState<string | null>(null);

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
      if (user) setCurrentUserId(user.id);
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
    if (!coords) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const latMin = coords.latitude - NEARBY_DELTA;
    const latMax = coords.latitude + NEARBY_DELTA;
    const lngMin = coords.longitude - NEARBY_DELTA;
    const lngMax = coords.longitude + NEARBY_DELTA;

    const { data: follows } = await supabase
      .from('follows')
      .select('follower_id, followed_id')
      .or(`follower_id.eq.${user.id},followed_id.eq.${user.id}`)
      .eq('status', 'accepted');

    const ids = new Set<string>();
    for (const f of follows ?? []) {
      const other = f.follower_id === user.id ? f.followed_id : f.follower_id;
      ids.add(other);
    }
    setFriendIds(ids);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, last_lat, last_lng, username, full_name')
      .eq('location_visibility', 'public')
      .not('last_lat', 'is', null)
      .not('last_lng', 'is', null)
      .neq('user_id', user.id)
      .gte('last_lat', latMin)
      .lte('last_lat', latMax)
      .gte('last_lng', lngMin)
      .lte('last_lng', lngMax);

    const users: NearbyUser[] = (profiles ?? []).map((p: any) => ({
      user_id: p.user_id,
      last_lat: p.last_lat,
      last_lng: p.last_lng,
      username: p.username,
      full_name: p.full_name,
      isFriend: ids.has(p.user_id),
    }));
    setNearbyUsers(users);

    // Fetch nearby matches with location pins
    const { data: matchRows } = await supabase
      .from('matches')
      .select('id, location_lat, location_lng, location_name, match_type, status, is_public, created_by, scheduled_at, match_format, sport_id')
      .not('location_lat', 'is', null)
      .not('location_lng', 'is', null)
      .gte('location_lat', latMin)
      .lte('location_lat', latMax)
      .gte('location_lng', lngMin)
      .lte('location_lng', lngMax)
      .in('status', ['pending', 'confirmed', 'in_progress']);

    const visibleMatches: NearbyMatch[] = [];
    for (const m of matchRows ?? []) {
      // Private matches: only show if user is creator or participant
      if (!m.is_public && m.created_by !== user.id) {
        const { count } = await supabase
          .from('match_participants')
          .select('id', { count: 'exact', head: true })
          .eq('match_id', m.id)
          .eq('user_id', user.id);
        if (!count || count === 0) continue;
      }

      const { data: sportRow } = await supabase.from('sports').select('name').eq('id', m.sport_id).maybeSingle();
      const { data: creatorProfile } = await supabase.from('profiles').select('username').eq('user_id', m.created_by).maybeSingle();
      const { count: pCount } = await supabase
        .from('match_participants')
        .select('id', { count: 'exact', head: true })
        .eq('match_id', m.id);

      visibleMatches.push({
        id: m.id,
        location_lat: Number(m.location_lat),
        location_lng: Number(m.location_lng),
        location_name: m.location_name,
        sport_name: (sportRow as any)?.name ?? 'Unknown',
        match_type: m.match_type,
        match_format: m.match_format ?? '1v1',
        status: m.status,
        is_public: m.is_public,
        created_by: m.created_by,
        scheduled_at: m.scheduled_at,
        creator_username: (creatorProfile as any)?.username ?? null,
        participant_count: pCount ?? 0,
      });
    }
    setNearbyMatches(visibleMatches);
  }, [coords?.latitude, coords?.longitude]);

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

      const { data: myProfile } = await supabase.from('profiles').select('username').eq('user_id', currentUserId).maybeSingle();
      await supabase.from('notifications').insert({
        user_id: match.created_by,
        type: 'match_joined',
        title: `${(myProfile as any)?.username ?? 'Someone'} joined your ${sportLabel(match.sport_name)} match!`,
        body: `A player joined your ${match.match_type} match${match.location_name ? ` at ${match.location_name}` : ''}.`,
        data: { match_id: match.id, from_user_id: currentUserId },
      });

      Alert.alert('Joined!', `You joined the ${sportLabel(match.sport_name)} match.`);
      loadNearby();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not join match.');
    } finally {
      setJoiningMatchId(null);
    }
  };

  const matchStatusLabel = (s: string) => {
    switch (s) {
      case 'pending': return 'Open';
      case 'confirmed': return 'Confirmed';
      case 'in_progress': return 'Live';
      default: return s;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
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
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass
          mapType="standard"
          onLongPress={handleMapLongPress}
          onPress={() => { if (droppedPin) clearDroppedPin(); }}
        >
          {showPlayers && nearbyUsers.map((u) => (
            <Marker
              key={`user-${u.user_id}`}
              coordinate={{ latitude: u.last_lat, longitude: u.last_lng }}
              title={u.isFriend ? (u.full_name ?? u.username ?? 'Player') : undefined}
              pinColor={u.isFriend ? colors.primary : colors.textSecondary}
            />
          ))}

          {showMatches && nearbyMatches.map((m) => (
            <Marker
              key={`match-${m.id}`}
              coordinate={{ latitude: m.location_lat, longitude: m.location_lng }}
            >
              <Image source={versusPin} style={{ width: 36, height: 36, resizeMode: 'contain' }} />
              <Callout tooltip={false} onPress={() => { if (m.is_public && m.created_by !== currentUserId) handleJoinMatch(m); }}>
                <View style={styles.calloutContainer}>
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
                    By @{m.creator_username ?? 'unknown'} · {m.participant_count} player{m.participant_count !== 1 ? 's' : ''}
                  </Text>
                  {m.scheduled_at && (
                    <Text style={styles.calloutDetail}>
                      {new Date(m.scheduled_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  )}
                  {m.is_public && m.created_by !== currentUserId && (
                    <View style={styles.calloutJoin}>
                      <Text style={styles.calloutJoinText}>Tap to join</Text>
                    </View>
                  )}
                  {!m.is_public && (
                    <Text style={[styles.calloutDetail, { fontStyle: 'italic' }]}>Private match</Text>
                  )}
                </View>
              </Callout>
            </Marker>
          ))}

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

        {!droppedPin && (
          <TouchableOpacity style={styles.fab} onPress={() => setShowNewMatch(true)} activeOpacity={0.85}>
            <Ionicons name="add" size={20} color={colors.textOnPrimary} />
            <Text style={styles.fabText}>New match</Text>
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
              {nearbyUsers.length} player{nearbyUsers.length !== 1 ? 's' : ''} · {nearbyMatches.length} match{nearbyMatches.length !== 1 ? 'es' : ''}{nearbyPlace ? ` · ${nearbyPlace}` : ''} · Hold to pin
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
    </View>
  );
}
