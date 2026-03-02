import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { spacing, typography } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import { useLocation } from '../hooks/useLocation';
import { supabase } from '../lib/supabase';

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

const NEARBY_DELTA = 0.05; // ~5km bounding box

type NearbyUser = {
  user_id: string;
  last_lat: number;
  last_lng: number;
  username: string | null;
  full_name: string | null;
  isFriend: boolean;
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
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [nearbyPlace, setNearbyPlace] = useState<string | null>(null);

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

  // Update our location in profile when we have coords (only if location is public)
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

  // Fetch nearby users (public location) and our follows
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

    const users: NearbyUser[] = (profiles ?? []).map((p: { user_id: string; last_lat: number; last_lng: number; username: string | null; full_name: string | null }) => ({
      user_id: p.user_id,
      last_lat: p.last_lat,
      last_lng: p.last_lng,
      username: p.username,
      full_name: p.full_name,
      isFriend: ids.has(p.user_id),
    }));
    setNearbyUsers(users);
  }, [coords?.latitude, coords?.longitude]);

  useEffect(() => {
    loadNearby();
    const interval = setInterval(loadNearby, 30000);
    return () => clearInterval(interval);
  }, [loadNearby]);

  // Reverse geocode to show nearby place instead of coordinates
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
        >
          {nearbyUsers.map((u) => (
            <Marker
              key={u.user_id}
              coordinate={{ latitude: u.last_lat, longitude: u.last_lng }}
              title={u.isFriend ? (u.full_name ?? u.username ?? 'Player') : undefined}
              pinColor={u.isFriend ? colors.primary : colors.textSecondary}
            />
          ))}
        </MapView>
        <TouchableOpacity style={styles.centerBtn} onPress={centerOnUser} activeOpacity={0.8}>
          <Ionicons name="locate" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.statusBar}>
        {status === 'pending' && (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.statusText}>Getting your location…</Text>
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
            {nearbyUsers.length} nearby{nearbyPlace ? ` · ${nearbyPlace}` : ` · ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`}
          </Text>
        )}
      </View>
    </View>
  );
}
