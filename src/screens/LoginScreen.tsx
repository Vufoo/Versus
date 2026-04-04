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
import { spacing, typography, borderRadius, lightColors, darkColors } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { supabase, setRememberMe, getRememberMePreference } from '../lib/supabase';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

type Props = { onContinue: () => void; onGoToSignup: () => void; onBack?: () => void };

function s(c: ThemeColors) {
  return StyleSheet.create({
    outer: { flex: 1, backgroundColor: c.background },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xxl },
    wrapper: { alignItems: 'center', paddingHorizontal: spacing.xl, width: '100%', maxWidth: 560, alignSelf: 'center' as const },

    logo: { width: 160, height: 160, marginBottom: spacing.sm, resizeMode: 'contain' as const },
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
      backgroundColor: c.cardBg,
      marginBottom: spacing.sm,
    },
    socialBtnText: { ...typography.body, fontWeight: '500', color: c.text },

    rememberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
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

    // Web top nav
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

export default function LoginScreen({ onContinue, onGoToSignup, onBack }: Props) {
  const isWeb = Platform.OS === 'web';
  const cs = isWeb ? darkStyles : lightStyles;
  const cc = isWeb ? darkColors : lightColors;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMeState] = useState(true);

  useEffect(() => {
    getRememberMePreference().then(setRememberMeState);
  }, []);

  const handleAppleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const rawNonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) return;
      const { error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });
      if (authError) throw authError;
      onContinue();
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') return;
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { GoogleSignin, statusCodes } = require('@react-native-google-signin/google-signin');
      GoogleSignin.configure({
        webClientId: '748575961938-u5o8nf59pn8oqiu5h4a7bda2s0qm6bs8.apps.googleusercontent.com',
        iosClientId: '748575961938-ifm39u8rtt3aorcsujrj0oabd2n8ha4i.apps.googleusercontent.com',
      });
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (!response.data?.idToken) return;
      const { error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.data.idToken,
      });
      if (authError) throw authError;
      onContinue();
    } catch (e: any) {
      if (e?.code === statusCodes?.SIGN_IN_CANCELLED) return;
      if (e?.code === statusCodes?.IN_PROGRESS) return;
    } finally {
      setLoading(false);
    }
  };

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
      style={cs.outer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top-left back nav — web only */}
      {isWeb && onBack && (
        <View style={cs.webNav}>
          <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={cs.webNavBack}>
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
          <Text style={cs.tagline}>Play vs opponents. Record matches. Earn points. Prove it in the game.</Text>

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
              style={cs.rememberRow}
              onPress={() => setRememberMeState((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={[cs.checkbox, rememberMe && cs.checkboxChecked]}>
                {rememberMe && <Ionicons name="checkmark" size={14} color="#FFF" />}
              </View>
              <Text style={[cs.rememberText, isWeb && { fontSize: 16 }]}>Remember me</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[cs.continueBtn, loading && cs.continueBtnDisabled, isWeb && { paddingVertical: 16 }]}
              activeOpacity={0.9}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={cc.textOnPrimary} />
              ) : (
                <Text style={[cs.continueBtnText, isWeb && { fontSize: 17 }]}>Log in</Text>
              )}
            </TouchableOpacity>

            {error ? <Text style={cs.errorText}>{error}</Text> : null}

            <View style={cs.dividerRow}>
              <View style={cs.dividerLine} />
              <Text style={cs.dividerText}>or</Text>
              <View style={cs.dividerLine} />
            </View>

            <Text style={[cs.infoText, { marginBottom: spacing.sm }]}>Create an account with</Text>

            <TouchableOpacity style={[cs.socialBtn, isWeb && { paddingVertical: 16 }]} activeOpacity={0.8} onPress={onGoToSignup}>
              <Ionicons name="mail-outline" size={20} color={cc.text} />
              <Text style={[cs.socialBtnText, isWeb && { fontSize: 17 }]}>Email</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[cs.socialBtn, isWeb && { paddingVertical: 16 }]} activeOpacity={0.8} onPress={handleGoogleSignIn} disabled={loading}>
              <Ionicons name="logo-google" size={20} color="#4285F4" />
              <Text style={[cs.socialBtnText, isWeb && { fontSize: 17 }]}>Google</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[cs.socialBtn, { backgroundColor: '#1a1a1a' }, isWeb && { paddingVertical: 16 }]} activeOpacity={0.8} onPress={handleAppleSignIn} disabled={loading}>
              <Ionicons name="logo-apple" size={20} color="#FFF" />
              <Text style={[cs.socialBtnText, { color: '#FFF' }, isWeb && { fontSize: 17 }]}>Apple</Text>
            </TouchableOpacity>
          </View>

          <Text style={cs.footerText}>
            By continuing, you agree to the Versus Terms of Service and Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
