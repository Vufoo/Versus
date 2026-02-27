import { useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import TabNavigator from './src/navigation/TabNavigator';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { supabase } from './src/lib/supabase';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function AppShell() {
  const { colors, mode, isSignedIn, setSignedIn } = useTheme();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authScreen, setAuthScreen] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSignedIn(true);
      setAuthChecked(true);
    });
  }, [setSignedIn]);

  const navTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.primary,
      },
    }),
    [colors],
  );

  useEffect(() => {
    let cancelled = false;

    const checkProfile = async () => {
      if (!isSignedIn) {
        setNeedsOnboarding(null);
        return;
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setNeedsOnboarding(false);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, username, preferred_sports')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile && profile.username) {
          if (!cancelled) setNeedsOnboarding(false);
          return;
        }

        // No profile row (or no username). Decide: new user or legacy user?
        const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
        const isRecentSignup = Date.now() - createdAt < ONE_DAY_MS;

        if (isRecentSignup) {
          // Brand-new user who just signed up -> show onboarding
          if (!cancelled) setNeedsOnboarding(true);
        } else {
          // Existing user logging in who just doesn't have a profile row yet
          // (e.g. created before profiles table existed). Auto-create minimal
          // profile so they go straight to the app.
          await supabase.from('profiles').upsert(
            {
              user_id: user.id,
              username: (user.email ?? '').split('@')[0] || user.id.slice(0, 8),
            },
            { onConflict: 'user_id' },
          );
          if (!cancelled) setNeedsOnboarding(false);
        }
      } catch {
        if (!cancelled) setNeedsOnboarding(false);
      }
    };

    checkProfile();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  if (!authChecked) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        {isSignedIn ? (
          needsOnboarding === null ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : needsOnboarding ? (
            <OnboardingScreen onComplete={() => setNeedsOnboarding(false)} />
          ) : (
            <TabNavigator />
          )
        ) : authScreen === 'signup' ? (
          <SignupScreen
            onBackToLogin={() => setAuthScreen('login')}
            onContinue={() => setSignedIn(true)}
          />
        ) : (
          <LoginScreen
            onContinue={() => setSignedIn(true)}
            onGoToSignup={() => setAuthScreen('signup')}
          />
        )}
        <StatusBar
          style={mode === 'dark' ? 'light' : 'dark'}
          backgroundColor={colors.background}
        />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
