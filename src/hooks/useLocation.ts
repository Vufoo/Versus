import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export type LocationStatus = 'pending' | 'granted' | 'denied' | 'error';

export interface LocationState {
  coords: { latitude: number; longitude: number } | null;
  status: LocationStatus;
  error: string | null;
}

/**
 * Request location permission and optionally subscribe to updates.
 * Use this for "find match nearby" and location sharing.
 */
export function useLocation(options?: { watch?: boolean }) {
  const [state, setState] = useState<LocationState>({
    coords: null,
    status: 'pending',
    error: null,
  });

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setState((s) => ({ ...s, status: 'denied', error: 'Location permission denied' }));
          return;
        }
        setState((s) => ({ ...s, status: 'granted' }));

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setState((s) => ({
          ...s,
          coords: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
        }));

        if (options?.watch) {
          subscription = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, distanceInterval: 50 },
            (loc) => {
              setState((s) => ({
                ...s,
                coords: {
                  latitude: loc.coords.latitude,
                  longitude: loc.coords.longitude,
                },
              }));
            }
          );
        }
      } catch (e) {
        setState((s) => ({
          ...s,
          status: 'error',
          error: e instanceof Error ? e.message : 'Location error',
        }));
      }
    })();

    return () => {
      subscription?.remove();
    };
  }, [options?.watch]);

  return state;
}
