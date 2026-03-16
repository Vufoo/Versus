import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as themeTokens from '../constants/theme';

const { lightColors, darkColors, spacing, borderRadius, typography } = themeTokens;

const THEME_STORAGE_KEY = 'versus.themeMode';

export type ThemeMode = 'light' | 'dark';

type ThemeContextValue = {
  mode: ThemeMode;
  colors: typeof lightColors | typeof darkColors;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  typography: typeof typography;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  isSignedIn: boolean;
  setSignedIn: (value: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = Appearance.getColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(system === 'dark' ? 'dark' : 'light');
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [isSignedIn, setSignedIn] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark') {
        setModeState(stored);
      }
      setThemeLoaded(true);
    });
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(THEME_STORAGE_KEY, m);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      AsyncStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: mode === 'dark' ? darkColors : lightColors,
      spacing,
      borderRadius,
      typography,
      setMode,
      toggleMode,
      isSignedIn,
      setSignedIn,
    }),
    [mode, isSignedIn, setMode, toggleMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}

