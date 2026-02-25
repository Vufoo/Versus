import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import { supabase } from '../lib/supabase';

type Props = {
  onContinue: () => void;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xxl,
    },
    logoRow: {
      alignItems: 'flex-start',
      marginBottom: spacing.lg,
    },
    appName: {
      ...typography.title,
      fontSize: 32,
      color: colors.primary,
    },
    tagline: {
      ...typography.body,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    card: {
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modeSwitchRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    modeChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modeChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primaryDark,
    },
    modeChipText: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    modeChipTextActive: {
      color: colors.textOnPrimary,
    },
    label: {
      ...typography.label,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    input: {
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.background,
      color: colors.text,
      marginBottom: spacing.md,
    },
    primaryButton: {
      marginTop: spacing.md,
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    primaryButtonText: {
      ...typography.heading,
      color: colors.textOnPrimary,
    },
    secondaryButton: {
      marginTop: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    secondaryButtonText: {
      ...typography.body,
      color: colors.textSecondary,
    },
    helperText: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    errorText: {
      ...typography.caption,
      color: colors.error,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
  });
}

export default function LoginScreen({ onContinue }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
   const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleAuth = async () => {
    if (!email || !password) {
      setError('Enter an email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    if (mode === 'login') {
      setInfo(null);
    }

    try {
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
        onContinue();
      } else {
        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (authError) throw authError;

        // Successful signup: ask user to confirm email before logging in.
        setMode('login');
        setPassword('');
        setInfo(
          `We’ve sent a confirmation link to ${email.trim()}. Confirm your email, then log in with the same email and password.`,
        );
      }
    } catch (e) {
      const message =
        e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Auth error';

      if (message.toLowerCase().includes('already registered')) {
        setError('That email is already registered. Try logging in instead.');
      } else if (mode === 'login') {
        setError('Could not log in with that email and password.');
      } else {
        setError('Could not sign up. Please check your details and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={styles.logoRow}>
        <Text style={styles.appName}>Versus</Text>
        <Text style={styles.tagline}>Plan 1v1s. Earn VP. Prove it on the court.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.modeSwitchRow}>
          <TouchableOpacity
            style={[
              styles.modeChip,
              mode === 'login' && styles.modeChipActive,
            ]}
            onPress={() => setMode('login')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.modeChipText,
                mode === 'login' && styles.modeChipTextActive,
              ]}
            >
              Log in
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeChip,
              mode === 'signup' && styles.modeChipActive,
            ]}
            onPress={() => setMode('signup')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.modeChipText,
                mode === 'signup' && styles.modeChipTextActive,
              ]}
            >
              Sign up
            </Text>
          </TouchableOpacity>
        </View>

        {info ? <Text style={styles.helperText}>{info}</Text> : null}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor={colors.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.9}
          onPress={handleAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <>
              <Ionicons
                name={mode === 'login' ? 'log-in-outline' : 'person-add-outline'}
                size={20}
                color={colors.textOnPrimary}
              />
              <Text style={styles.primaryButtonText}>
                {mode === 'login' ? 'Log in' : 'Create account'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.9}
          onPress={onContinue}
        >
          <Ionicons name="arrow-forward-circle-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.secondaryButtonText}>Skip for now</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!info && (
          <Text style={styles.helperText}>
            Email + password auth is handled by Supabase. After signing up, confirm your email, then log in.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

