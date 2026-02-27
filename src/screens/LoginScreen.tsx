import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, lightColors } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { supabase, setRememberMe, getRememberMePreference } from '../lib/supabase';

type Props = { onContinue: () => void; onGoToSignup: () => void };

const colors = lightColors;

function s(c: ThemeColors) {
  return StyleSheet.create({
    outer: { flex: 1, backgroundColor: c.background },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xxl },
    wrapper: { alignItems: 'center', paddingHorizontal: spacing.xl },

    logo: { width: 140, height: 140, marginBottom: spacing.md, resizeMode: 'contain' as const },
    appName: { ...typography.title, fontSize: 36, color: c.primary, marginBottom: spacing.xs },
    tagline: {
      ...typography.body,
      color: c.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.xl,
      maxWidth: 280,
    },

    card: {
      width: '100%',
      maxWidth: 360,
      borderRadius: borderRadius.lg,
      backgroundColor: c.surface,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: c.border,
    },

    input: {
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      backgroundColor: c.background,
      color: c.text,
      fontSize: 15,
      marginBottom: spacing.sm,
    },
    inputError: { borderColor: c.error },

    continueBtn: {
      backgroundColor: c.primary,
      paddingVertical: 14,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    continueBtnDisabled: { opacity: 0.5 },
    continueBtnText: { ...typography.body, fontWeight: '600', color: c.textOnPrimary },

    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: spacing.md,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
    dividerText: {
      ...typography.caption,
      color: c.textSecondary,
      paddingHorizontal: spacing.md,
    },

    socialBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: 13,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.background,
      marginBottom: spacing.sm,
    },
    socialBtnText: { ...typography.body, fontWeight: '500', color: c.text },
    appleBtnText: { color: '#000' },

    inlineError: {
      ...typography.caption,
      color: c.error,
      marginBottom: spacing.sm,
    },
    rememberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    rememberText: { ...typography.body, fontSize: 14, color: c.text },

    errorText: { ...typography.caption, color: c.error, textAlign: 'center', marginTop: spacing.sm },
    infoText: {
      ...typography.caption,
      color: c.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.md,
      lineHeight: 18,
    },

    footerText: {
      ...typography.caption,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: spacing.lg,
      maxWidth: 300,
      lineHeight: 18,
    },
  });
}

const styles = s(colors);

export default function LoginScreen({ onContinue, onGoToSignup }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMeState] = useState(true);

  useEffect(() => {
    getRememberMePreference().then(setRememberMeState);
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      await setRememberMe(rememberMe);
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (loginErr) {
        setError(loginErr.message?.includes('Invalid login') ? 'Invalid email or password. Try again.' : loginErr.message);
        return;
      }
      onContinue();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.outer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.wrapper}>
          <Image source={require('../../assets/versus-icon2.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.appName}>Versus</Text>
          <Text style={styles.tagline}>Plan 1v1s. Earn VP. Prove it in the game.</Text>

          <View style={styles.card}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={(val) => {
                setEmail(val);
                setError(null);
              }}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRememberMeState((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Ionicons name="checkmark" size={14} color="#FFF" />}
              </View>
              <Text style={styles.rememberText}>Remember me</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.continueBtn, loading && styles.continueBtnDisabled]}
              activeOpacity={0.9}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.continueBtnText}>Log in</Text>
              )}
            </TouchableOpacity>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
              <Ionicons name="logo-google" size={20} color="#DB4437" />
              <Text style={styles.socialBtnText}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.socialBtn, { backgroundColor: '#000' }]} activeOpacity={0.8}>
              <Ionicons name="logo-apple" size={20} color="#FFF" />
              <Text style={[styles.socialBtnText, { color: '#FFF' }]}>Continue with Apple</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8} onPress={onGoToSignup}>
              <Ionicons name="mail-outline" size={20} color={colors.text} />
              <Text style={styles.socialBtnText}>Continue with email</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footerText}>
            By continuing, you agree to the Versus Terms of Service and Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
