module.exports = ({ config }) => ({
  ...config,
  name: 'Versus',
  slug: 'versus',
  scheme: 'versus',
  version: '1.0.1',
  orientation: 'portrait',
  icon: './assets/versus_blue.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/icon_blue.png',
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
        'Versus needs photo access to set your profile picture and add photos to matches.',
    },
  },
  android: {
    package: 'com.vufoo.versus',
    adaptiveIcon: {
      foregroundImage: './assets/versus_blue.png',
      backgroundColor: '#FDF6ED',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
  },
  plugins: [
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme: 'com.googleusercontent.apps.748575961938-ifm39u8rtt3aorcsujrj0oabd2n8ha4i',
      },
    ],
  ],
  web: { favicon: './assets/versus_blue.png' },
  extra: {
    eas: {
      projectId: 'b30a31d9-2ac1-4919-93b0-2433d66f6f20',
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
