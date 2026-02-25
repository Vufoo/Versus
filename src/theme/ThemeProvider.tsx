import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance } from 'react-native';
import * as themeTokens from '../constants/theme';

const { lightColors, darkColors, spacing, borderRadius, typography } = themeTokens;

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
  const [mode, setMode] = useState<ThemeMode>(
    system === 'dark' ? 'dark' : 'light',
  );
  const [isSignedIn, setSignedIn] = useState(false);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: mode === 'dark' ? darkColors : lightColors,
      spacing,
      borderRadius,
      typography,
      setMode,
      toggleMode: () => setMode((prev) => (prev === 'light' ? 'dark' : 'light')),
      isSignedIn,
      setSignedIn,
    }),
    [mode, isSignedIn],
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

