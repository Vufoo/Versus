module.exports = ({ config }) => ({
  ...config,
  name: 'Versus',
  slug: 'versus',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/versus-icon2.png',
    resizeMode: 'contain',
    backgroundColor: '#FDF6ED',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.vufoo.versus',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription:
        'Versus uses your location to show nearby players, courts, and matches on the map.',
      NSPhotoLibraryUsageDescription:
        'Versus needs photo access to set your profile picture.',
    },
  },
  android: {
    package: 'com.vufoo.versus',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FDF6ED',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
  },
  web: { favicon: './assets/favicon.png' },
  extra: {
    eas: {
      projectId: 'b30a31d9-2ac1-4919-93b0-2433d66f6f20',
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
