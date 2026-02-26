import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Image,
} from 'react-native';
import type { ReactNode } from 'react';
import { spacing, typography, borderRadius } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { supabase, resolveAvatarUrl } from '../lib/supabase';

export type SearchedUser = {
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type Props = {
  colors: ThemeColors;
  onSelect: (user: SearchedUser) => void;
  excludeUserId?: string;
  placeholder?: string;
  renderAction?: (user: SearchedUser) => ReactNode;
  suggestions?: SearchedUser[];
  suggestionsTitle?: string;
};

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    input: {
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: c.background,
      color: c.text,
      fontSize: 15,
    },
    list: { maxHeight: 200, marginTop: spacing.xs },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImage: { width: 36, height: 36, borderRadius: 18 },
    initials: { fontSize: 14, fontWeight: '700', color: c.textOnPrimary },
    info: { flex: 1 },
    name: { ...typography.body, fontSize: 14, color: c.text },
    handle: { ...typography.caption, fontSize: 12, color: c.textSecondary },
    loader: { padding: spacing.md, alignItems: 'center' },
    empty: { ...typography.caption, color: c.textSecondary, padding: spacing.md, textAlign: 'center' },
    sugTitle: { ...typography.label, color: c.textSecondary, paddingVertical: spacing.sm, textTransform: 'uppercase' },
  });
}

export default function UserSearch({ colors, onSelect, excludeUserId, placeholder, renderAction, suggestions, suggestionsTitle }: Props) {
  const styles = makeStyles(colors);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < 2) {
        setResults([]);
        setSearched(false);
        return;
      }
      setLoading(true);
      try {
        const pattern = `%${trimmed}%`;
        const { data } = await supabase
          .from('profiles')
          .select('user_id, username, full_name, avatar_url')
          .or(`username.ilike.${pattern},full_name.ilike.${pattern}`)
          .limit(10);

        const filtered = (data ?? []).filter(
          (u) => u.user_id !== excludeUserId,
        ) as SearchedUser[];
        const resolved = await Promise.all(
          filtered.map(async (u) => ({
            ...u,
            avatar_url: await resolveAvatarUrl(u.avatar_url) ?? u.avatar_url,
          })),
        );
        setResults(resolved);
        setSearched(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [excludeUserId],
  );

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, search]);

  const getInitials = (u: SearchedUser) =>
    (u.full_name ?? u.username ?? '?')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const renderRow = (item: SearchedUser, clearOnSelect = true) => (
    <TouchableOpacity
      key={item.user_id}
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => {
        onSelect(item);
        if (clearOnSelect) { setQuery(''); setResults([]); setSearched(false); }
      }}
    >
      {item.avatar_url ? (
        <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
      ) : (
        <View style={styles.avatar}>
          <Text style={styles.initials}>{getInitials(item)}</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name}>{item.full_name ?? item.username ?? 'Unknown'}</Text>
        {item.username && <Text style={styles.handle}>@{item.username}</Text>}
      </View>
      {renderAction ? renderAction(item) : null}
    </TouchableOpacity>
  );

  const showSuggestions = !searched && !loading && suggestions && suggestions.length > 0 && query.trim().length < 2;

  return (
    <View>
      <TextInput
        style={styles.input}
        placeholder={placeholder ?? 'Search by username or name...'}
        placeholderTextColor={colors.textSecondary}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
        </View>
      )}
      {!loading && searched && results.length === 0 && (
        <Text style={styles.empty}>No users found</Text>
      )}
      {!loading && results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.user_id}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => renderRow(item)}
        />
      )}
      {showSuggestions && (
        <View style={styles.list}>
          {suggestionsTitle && <Text style={styles.sugTitle}>{suggestionsTitle}</Text>}
          {suggestions!.map((u) => renderRow(u, true))}
        </View>
      )}
    </View>
  );
}
