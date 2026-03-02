import { useState } from 'react';
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

type Props = {
  onBackToLogin: () => void;
  onContinue: () => void;
};

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

    signupBtn: {
      backgroundColor: c.primary,
      paddingVertical: 14,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    signupBtnDisabled: { opacity: 0.5 },
    signupBtnText: { ...typography.body, fontWeight: '600', color: c.textOnPrimary },

    backBtn: {
      marginTop: spacing.lg,
      paddingVertical: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    backBtnText: { ...typography.body, color: c.primary, fontWeight: '500' },

    errorText: { ...typography.caption, color: c.error, textAlign: 'center', marginTop: spacing.sm },

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

export default function SignupScreen({ onBackToLogin, onContinue }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async () => {
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { data, error: signupErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signupErr) throw signupErr;

      const identities = data?.user?.identities ?? [];
      if (identities.length === 0) {
        setError('That email is already registered. Go back and log in.');
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
          <Image source={require('../../assets/icon_blue.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.appName}>Versus</Text>
          <Text style={styles.tagline}>Create an account to get started.</Text>

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
              style={[styles.signupBtn, loading && styles.signupBtnDisabled]}
              activeOpacity={0.9}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.signupBtnText}>Sign up</Text>
              )}
            </TouchableOpacity>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity style={styles.backBtn} onPress={onBackToLogin} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={18} color={colors.primary} />
              <Text style={styles.backBtnText}>Back to login</Text>
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
