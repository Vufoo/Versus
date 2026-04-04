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
import { spacing, typography, borderRadius, lightColors, darkColors } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { supabase } from '../lib/supabase';

type Props = {
  onBackToLogin: () => void;
  onContinue: () => void;
};

function s(c: ThemeColors) {
  return StyleSheet.create({
    outer: { flex: 1, backgroundColor: c.background },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xxl },
    wrapper: { alignItems: 'center', paddingHorizontal: spacing.xl, width: '100%', maxWidth: 560, alignSelf: 'center' as const },

    logo: { width: 160, height: 160, marginBottom: spacing.sm, resizeMode: 'contain' as const },
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
      padding: spacing.xl,
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

    errorText: { ...typography.caption, color: c.error, textAlign: 'center', marginTop: spacing.sm },

    footerText: {
      ...typography.caption,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: spacing.lg,
      maxWidth: 300,
      lineHeight: 18,
    },

    // Web top nav (same structure as LoginScreen)
    webNav: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    webNavBack: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    webNavBackText: { fontSize: 15, color: c.primary, fontWeight: '700' },
  });
}

const lightStyles = s(lightColors);
const darkStyles = s(darkColors);

export default function SignupScreen({ onBackToLogin, onContinue }: Props) {
  const isWeb = Platform.OS === 'web';
  const cs = isWeb ? darkStyles : lightStyles;
  const cc = isWeb ? darkColors : lightColors;

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
        setError('This email is already registered. If you signed up with Google, go back and use "Continue with Google".');
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
      style={cs.outer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top-left back nav — web only */}
      {isWeb && (
        <View style={cs.webNav}>
          <TouchableOpacity onPress={onBackToLogin} activeOpacity={0.7} style={cs.webNavBack}>
            <Ionicons name="chevron-back" size={20} color={cc.primary} />
            <Text style={cs.webNavBackText}>Back</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={cs.scroll} keyboardShouldPersistTaps="handled">
        <View style={cs.wrapper}>
          <Image
            source={require('../../assets/icon_dark_mode.png')}
            style={cs.logo}
            resizeMode="contain"
          />
          <Text style={cs.appName}>Versus</Text>
          <Text style={cs.tagline}>Create an account to get started.</Text>

          <View style={[cs.card, isWeb && { maxWidth: 460, padding: spacing.xl }]}>
            <TextInput
              style={[cs.input, isWeb && { paddingVertical: 16, fontSize: 17 }]}
              placeholder="Email"
              placeholderTextColor={cc.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={(val) => { setEmail(val); setError(null); }}
            />

            <TextInput
              style={[cs.input, isWeb && { paddingVertical: 16, fontSize: 17 }]}
              placeholder="Password"
              placeholderTextColor={cc.textSecondary}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity
              style={[cs.signupBtn, loading && cs.signupBtnDisabled, isWeb && { paddingVertical: 16 }]}
              activeOpacity={0.9}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={cc.textOnPrimary} />
              ) : (
                <Text style={[cs.signupBtnText, isWeb && { fontSize: 17 }]}>Sign up</Text>
              )}
            </TouchableOpacity>

            {error ? <Text style={cs.errorText}>{error}</Text> : null}

            {/* Back to login — native only (web uses top nav) */}
            {!isWeb && (
              <TouchableOpacity
                style={{ marginTop: spacing.lg, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
                onPress={onBackToLogin}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-back" size={18} color={cc.primary} />
                <Text style={{ ...typography.body, color: cc.primary, fontWeight: '500' }}>Back to login</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={cs.footerText}>
            By continuing, you agree to the Versus Terms of Service and Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
