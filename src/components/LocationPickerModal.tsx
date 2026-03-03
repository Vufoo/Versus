import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';

const versusPin = require('../../assets/versus_blue.png');

export type PickedLocation = {
  latitude: number;
  longitude: number;
  name: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (loc: PickedLocation) => void;
  colors: ThemeColors;
  initial?: { latitude: number; longitude: number; name?: string } | null;
};

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    headerTitle: { ...typography.heading, color: c.text },
    map: { flex: 1 },
    searchBar: {
      position: 'absolute',
      top: spacing.md,
      left: spacing.md,
      right: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.md,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 4,
      elevation: 3,
    },
    searchInput: {
      flex: 1,
      paddingVertical: spacing.sm,
      fontSize: 15,
      color: c.text,
    },
    resultsList: {
      position: 'absolute',
      top: 56,
      left: spacing.md,
      right: spacing.md,
      backgroundColor: c.surface,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      maxHeight: 200,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 4,
      elevation: 3,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
    },
    resultText: { ...typography.body, fontSize: 14, color: c.text, flex: 1 },
    bottomBar: {
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.border,
      padding: spacing.lg,
    },
    locationPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    locationName: { ...typography.body, fontSize: 14, color: c.text, flex: 1 },
    confirmBtn: {
      backgroundColor: c.primary,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    confirmBtnText: { ...typography.heading, color: c.textOnPrimary },
    hint: { ...typography.caption, color: c.textSecondary, textAlign: 'center', marginBottom: spacing.sm },
    centerBtn: {
      position: 'absolute',
      bottom: spacing.lg,
      right: spacing.lg,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.cardBg,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 4,
      elevation: 4,
    },
  });
}

export default function LocationPickerModal({ visible, onClose, onConfirm, colors, initial }: Props) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const mapRef = useRef<MapView>(null);

  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(
    initial ? { latitude: initial.latitude, longitude: initial.longitude } : null,
  );
  const [placeName, setPlaceName] = useState(initial?.name ?? '');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Location.LocationGeocodedLocation[]>([]);
  const [resultNames, setResultNames] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    })();
  }, [visible]);

  useEffect(() => {
    if (initial) {
      setPin({ latitude: initial.latitude, longitude: initial.longitude });
      setPlaceName(initial.name ?? '');
    }
  }, [initial?.latitude, initial?.longitude]);

  const initialRegion: Region = useMemo(() => {
    if (initial) return { latitude: initial.latitude, longitude: initial.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    if (userCoords) return { latitude: userCoords.latitude, longitude: userCoords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    return { latitude: 37.78825, longitude: -122.4324, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  }, [initial, userCoords]);

  const reverseGeocode = async (lat: number, lng: number) => {
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

  const handleMapPress = async (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPin({ latitude, longitude });
    setResults([]);
    setQuery('');
    const name = await reverseGeocode(latitude, longitude);
    setPlaceName(name);
  };

  const handleSearch = (text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 3) {
      setResults([]);
      setResultNames([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const locs = await Location.geocodeAsync(text.trim());
        setResults(locs.slice(0, 5));
        const names = await Promise.all(
          locs.slice(0, 5).map((l) => reverseGeocode(l.latitude, l.longitude)),
        );
        setResultNames(names);
      } catch {
        setResults([]);
        setResultNames([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const selectResult = (loc: Location.LocationGeocodedLocation, name: string) => {
    setPin({ latitude: loc.latitude, longitude: loc.longitude });
    setPlaceName(name || query);
    setResults([]);
    setResultNames([]);
    setQuery('');
    mapRef.current?.animateToRegion(
      { latitude: loc.latitude, longitude: loc.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 },
      500,
    );
  };

  const handleConfirm = () => {
    if (!pin) return;
    onConfirm({ latitude: pin.latitude, longitude: pin.longitude, name: placeName });
  };

  const centerOnUser = () => {
    if (userCoords && mapRef.current) {
      mapRef.current.animateToRegion(
        { latitude: userCoords.latitude, longitude: userCoords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        500,
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 56 : spacing.md }]}>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Pick location</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={{ flex: 1 }}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={initialRegion}
              showsUserLocation
              showsMyLocationButton={false}
              onPress={handleMapPress}
            >
              {pin && (
                <Marker
                  coordinate={pin}
                  draggable
                  onDragEnd={async (e) => {
                    const { latitude, longitude } = e.nativeEvent.coordinate;
                    setPin({ latitude, longitude });
                    const name = await reverseGeocode(latitude, longitude);
                    setPlaceName(name);
                  }}
                >
                  <Image source={versusPin} style={{ width: 40, height: 40, resizeMode: 'contain' }} />
                </Marker>
              )}
            </MapView>

            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for a place..."
                placeholderTextColor={colors.textSecondary}
                value={query}
                onChangeText={handleSearch}
                autoCorrect={false}
              />
              {searching && <ActivityIndicator size="small" color={colors.textSecondary} />}
            </View>

            {results.length > 0 && (
              <View style={styles.resultsList}>
                {results.map((loc, i) => (
                  <TouchableOpacity
                    key={`${loc.latitude}-${loc.longitude}-${i}`}
                    style={styles.resultRow}
                    onPress={() => selectResult(loc, resultNames[i] ?? '')}
                  >
                    <Ionicons name="location" size={16} color={colors.primary} />
                    <Text style={styles.resultText} numberOfLines={1}>
                      {resultNames[i] || `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.centerBtn} onPress={centerOnUser} activeOpacity={0.8}>
              <Ionicons name="locate" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.bottomBar}>
            {pin ? (
              <View style={styles.locationPreview}>
                <Image source={versusPin} style={{ width: 28, height: 28, resizeMode: 'contain' }} />
                <Text style={styles.locationName} numberOfLines={2}>
                  {placeName || `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`}
                </Text>
              </View>
            ) : (
              <Text style={styles.hint}>Tap the map or search to drop a pin</Text>
            )}
            <TouchableOpacity
              style={[styles.confirmBtn, !pin && { opacity: 0.5 }]}
              onPress={handleConfirm}
              disabled={!pin}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmBtnText}>Confirm location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
