import { useCallback, useRef, useState } from 'react';
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
import { supabase } from '../lib/supabase';

type Props = { onContinue: () => void };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
    checkingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    checkingText: { ...typography.caption, color: c.textSecondary },

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

export default function LoginScreen({ onContinue }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [emailTaken, setEmailTaken] = useState(false);
  const [emailChecked, setEmailChecked] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const lastCheckedRef = useRef('');

  const checkEmail = useCallback(async (value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) { setEmailTaken(false); return; }
    if (trimmed === lastCheckedRef.current) return;
    lastCheckedRef.current = trimmed;

    setCheckingEmail(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc('check_email_exists', { email_input: trimmed });
      const exists = !rpcErr && data === true;
      setEmailTaken(exists);
      setEmailChecked(true);
    } catch { setEmailTaken(false); setEmailChecked(true); }
    finally { setCheckingEmail(false); }
  }, []);

  const isLoginMode = emailChecked && emailTaken;
  const isSignupMode = emailChecked && !emailTaken;
  const buttonLabel = isLoginMode ? 'Log in' : isSignupMode ? 'Sign up' : 'Continue';

  const handleSubmit = async () => {
    if (!email || !password) { setError('Enter your email and password.'); return; }
    setLoading(true);
    setError(null);

    try {
      if (isLoginMode) {
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
        if (loginErr) { setError('Incorrect password. Try again.'); return; }
        onContinue();
      } else if (isSignupMode) {
        const { data, error: signupErr } = await supabase.auth.signUp({ email, password });
        if (signupErr) throw signupErr;

        const identities = data?.user?.identities ?? [];
        if (identities.length === 0) {
          setEmailTaken(true);
          setError('That email is already registered. Check your password.');
          return;
        }

        setPassword('');
        setInfo(
          `We sent a confirmation link to ${email.trim()}. Check your inbox, then come back and log in.`,
        );
      } else {
        // Email not yet checked — do it now then retry
        await checkEmail(email);
        setLoading(false);
        return;
      }
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
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
          <Image source={require('../../assets/versus-icon.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.appName}>Versus</Text>
          <Text style={styles.tagline}>Plan 1v1s. Earn VP. Prove it in the game.</Text>

          <View style={styles.card}>
            {info ? <Text style={styles.infoText}>{info}</Text> : null}

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
                setEmailTaken(false);
                setEmailChecked(false);
                setError(null);
              }}
              onBlur={() => checkEmail(email)}
            />

            {checkingEmail && (
              <View style={styles.checkingRow}>
                <ActivityIndicator size="small" color={colors.textSecondary} />
                <Text style={styles.checkingText}>Checking…</Text>
              </View>
            )}

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity
              style={[styles.continueBtn, loading && styles.continueBtnDisabled]}
              activeOpacity={0.9}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.continueBtnText}>{buttonLabel}</Text>
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
          </View>

          <Text style={styles.footerText}>
            By continuing, you agree to the Versus Terms of Service and Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
