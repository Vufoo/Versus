import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, lightColors } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { SPORTS, sportLabel } from '../constants/sports';

type Props = {
  onComplete: () => void;
};

const MAX_PREFERRED = 3;
const colors = lightColors;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  card: {
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...typography.title,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  labelHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
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
  sportsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sportChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  sportChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  sportChipDisabled: {
    opacity: 0.4,
  },
  sportChipLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  sportChipLabelSelected: {
    color: colors.textOnPrimary,
  },
  primaryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center' as const,
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: spacing.sm,
  },
  primaryButtonText: {
    ...typography.heading,
    color: colors.textOnPrimary,
  },
  helperText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.sm,
  },
});

export default function OnboardingScreen({ onComplete }: Props) {
  const [loadingUser, setLoadingUser] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [preferredSports, setPreferredSports] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkUsername = useCallback(async (name: string) => {
    const trimmed = name.trim().toLowerCase();
    if (trimmed.length < 3) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    try {
      const { data: taken, error: rpcErr } = await supabase.rpc('check_username_taken', { username_input: trimmed });
      if (rpcErr) {
        const { data: row } = await supabase.from('profiles').select('user_id').eq('username', trimmed).maybeSingle();
        const { data: { user } } = await supabase.auth.getUser();
        setUsernameStatus(row && row.user_id !== user?.id ? 'taken' : 'available');
        return;
      }
      setUsernameStatus(taken ? 'taken' : 'available');
    } catch { setUsernameStatus('idle'); }
  }, []);

  const onUsernameChange = (text: string) => {
    setUsername(text);
    setError(null);
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    usernameTimerRef.current = setTimeout(() => checkUsername(text), 400);
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const { data, error: userError } = await supabase.auth.getUser();
        if (userError || !data?.user) {
          if (!cancelled) setError('You need to be signed in to complete setup.');
          return;
        }

        const email = data.user.email ?? '';
        if (!cancelled && email && !username) {
          setUsername(email.split('@')[0] ?? '');
        }
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    };

    bootstrap();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSport = (sport: string) => {
    setPreferredSports((prev) => {
      if (prev.includes(sport)) return prev.filter((s) => s !== sport);
      if (prev.length >= MAX_PREFERRED) return prev;
      return [...prev, sport];
    });
  };

  const handleSave = async () => {
    if (!username.trim()) {
      setError('Pick a username to continue.');
      return;
    }
    if (usernameStatus === 'taken') {
      setError('That username is taken. Choose a different one.');
      return;
    }
    if (preferredSports.length === 0) {
      setError('Select at least one sport you play.');
      return;
    }

    setSaving(true);
    setError(null);
    setInfo(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('You must be signed in.');

      const { error: upsertError } = await supabase.from('profiles').upsert(
        {
          user_id: user.id,
          full_name: fullName.trim() || null,
          username: username.trim(),
          preferred_sports: preferredSports,
        },
        { onConflict: 'user_id' },
      );

      if (upsertError) {
        console.error('Profile upsert error:', upsertError);
        if (upsertError.code === '23505') {
          setError('That username is taken. Try another.');
        } else if (upsertError.message?.includes('row-level security')) {
          setError(
            'Permission denied. Please run the RLS policies SQL in the Supabase dashboard.',
          );
        } else if (upsertError.message?.includes('column') && upsertError.message?.includes('does not exist')) {
          setError(
            `Database column missing. Run the latest schema migration in Supabase. (${upsertError.message})`,
          );
        } else {
          setError(`Could not save profile: ${upsertError.message ?? 'unknown error'}`);
        }
        return;
      }

      setInfo('Profile saved.');
      onComplete();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={styles.card}>
        <Text style={styles.title}>Welcome to Versus</Text>
        <Text style={styles.subtitle}>Set up your profile so friends can find you.</Text>

        {loadingUser ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={colors.textSecondary}
              value={fullName}
              onChangeText={setFullName}
            />

            <Text style={styles.label}>Username</Text>
            <TextInput
              style={[
                styles.input,
                usernameStatus === 'taken' && { borderColor: colors.error },
                usernameStatus === 'available' && { borderColor: colors.success },
              ]}
              placeholder="@username"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              value={username}
              onChangeText={onUsernameChange}
            />
            {usernameStatus === 'checking' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -8, marginBottom: 8 }}>
                <ActivityIndicator size="small" color={colors.textSecondary} />
                <Text style={styles.helperText}>Checking availability...</Text>
              </View>
            )}
            {usernameStatus === 'taken' && (
              <Text style={[styles.errorText, { marginTop: -8, marginBottom: 8 }]}>
                That username is taken. Try another.
              </Text>
            )}
            {usernameStatus === 'available' && (
              <Text style={[styles.helperText, { marginTop: -8, marginBottom: 8, color: colors.success }]}>
                Username is available!
              </Text>
            )}

            <Text style={styles.label}>Preferred sports</Text>
            <Text style={styles.labelHint}>
              Select up to {MAX_PREFERRED} sports you play the most.
            </Text>
            <View style={styles.sportsRow}>
              {SPORTS.map((sport) => {
                const selected = preferredSports.includes(sport);
                const atMax = !selected && preferredSports.length >= MAX_PREFERRED;
                return (
                  <TouchableOpacity
                    key={sport}
                    style={[
                      styles.sportChip,
                      selected && styles.sportChipSelected,
                      atMax && styles.sportChipDisabled,
                    ]}
                    onPress={() => toggleSport(sport)}
                    disabled={atMax}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[styles.sportChipLabel, selected && styles.sportChipLabelSelected]}
                    >
                      {sportLabel(sport)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.9}
            >
              {saving ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.textOnPrimary} />
                  <Text style={styles.primaryButtonText}>Continue</Text>
                </>
              )}
            </TouchableOpacity>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {info ? <Text style={styles.helperText}>{info}</Text> : null}

            <Text style={styles.helperText}>
              You can always edit these later from your profile.
            </Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}
