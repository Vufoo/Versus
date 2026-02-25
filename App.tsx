import { useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TabNavigator from './src/navigation/TabNavigator';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import LoginScreen from './src/screens/LoginScreen';

function AppShell() {
  const { colors, mode, isSignedIn, setSignedIn } = useTheme();

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

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        {isSignedIn ? (
          <TabNavigator />
        ) : (
          <LoginScreen onContinue={() => setSignedIn(true)} />
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

