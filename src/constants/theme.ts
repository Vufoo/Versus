/**
 * Versus app theme: burnt orange + cream/off-white
 *
 * We support both light and dark palettes. Most components currently
 * import `colors` (which is aliased to `lightColors`), and the
 * ThemeProvider exposes `lightColors`/`darkColors` to screens that
 * want fully dynamic theming.
 */
export const lightColors = {
  // Primary: burnt orange
  primary: '#CC5500',
  primaryDark: '#A04400',
  primaryLight: '#E85D00',
  // Neutrals: cream & off-white
  cream: '#FFF8F0',
  offWhite: '#FDF6ED',
  background: '#FDF6ED',
  surface: '#FFF8F0',
  // Text
  text: '#2D2420',
  textSecondary: '#5C5048',
  textOnPrimary: '#FFFFFF',
  // Borders & subtle
  border: '#E8DED4',
  divider: '#EDE4DA',
  // Status
  success: '#2D6A2D',
  error: '#B91C1C',
  warning: '#B45309',
} as const;

export const darkColors = {
  primary: '#FF8C38',
  primaryDark: '#E56E12',
  primaryLight: '#FFB066',
  cream: '#201A14',
  offWhite: '#14110E',
  background: '#090806',
  surface: '#15120E',
  text: '#F5EEE4',
  textSecondary: '#B8AFA5',
  textOnPrimary: '#0C0602',
  border: '#3A3228',
  divider: '#2A241D',
  success: '#4ADE80',
  error: '#F97373',
  warning: '#FBBF24',
} as const;

// Default export used by older imports – equivalent to the light theme.
export const colors = lightColors;

/** Union of light and dark palettes for theme-aware components */
export type ThemeColors = typeof lightColors | typeof darkColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

export const typography = {
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
  },
  heading: {
    fontSize: 22,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400' as const,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
};
