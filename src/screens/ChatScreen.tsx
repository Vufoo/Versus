import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../constants/theme';
import { supabase, resolveAvatarUrl } from '../lib/supabase';
import type { RootStackParamList } from '../navigation/RootNavigator';

type DMMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type DateHeader = { type: 'date-header'; id: string; label: string };
type ListItem = DMMessage | DateHeader;

function formatDateHeader(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function buildMessageList(messages: DMMessage[]): ListItem[] {
  const result: ListItem[] = [];
  let lastDateStr = '';
  for (const msg of messages) {
    const d = new Date(msg.created_at);
    const dateStr = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (dateStr !== lastDateStr) {
      result.push({ type: 'date-header', id: `dh-${msg.id}`, label: formatDateHeader(d) });
      lastDateStr = dateStr;
    }
    result.push(msg);
  }
  return result;
}

function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    backBtn: { padding: spacing.xs, marginRight: spacing.sm },
    headerTitle: { ...typography.heading, color: colors.text, flex: 1 },
    list: { flex: 1 },
    listContent: { padding: spacing.md, paddingBottom: spacing.xl },
    messageRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.xs },
    messageRowSent: { flexDirection: 'row-reverse' },
    messageAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    messageAvatarImage: { width: 28, height: 28, borderRadius: 14 },
    messageBubble: {
      maxWidth: '75%',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.lg,
    },
    messageBubbleSent: { backgroundColor: colors.primary },
    messageBubbleReceived: {
      backgroundColor: isDark ? '#5A5450' : colors.cardBg,
      borderWidth: 1,
      borderColor: isDark ? '#7A7470' : colors.border,
    },
    messageBubblePending: { opacity: 0.6 },
    messageText: { ...typography.body, fontSize: 15, textAlignVertical: 'center' as any },
    messageTextSent: { color: colors.textOnPrimary },
    messageTextReceived: { color: isDark ? '#FFFFFF' : colors.text },
    messageTimeSent: { ...typography.caption, fontSize: 11, marginTop: 2, color: 'rgba(255,255,255,0.75)' },
    messageTimeReceived: { ...typography.caption, fontSize: 11, marginTop: 2, color: isDark ? 'rgba(255,255,255,0.65)' : colors.textSecondary },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      paddingBottom: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      textAlignVertical: 'center' as any,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.background,
      maxHeight: 100,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: spacing.sm,
    },
    empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
    dateHeaderContainer: { alignItems: 'center', marginVertical: spacing.md },
    dateHeaderText: { ...typography.caption, fontSize: 12, color: colors.textSecondary, backgroundColor: colors.cardBg, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: 999 },
  });
}

export default function ChatScreen() {
  const { colors, mode } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'Chat'>>();
  const otherUserId = route.params?.userId ?? '';
  const styles = useMemo(() => createStyles(colors, mode === 'dark'), [colors, mode]);
  const flatListRef = useRef<FlatList>(null);
  const hasScrolledInitiallyRef = useRef(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState<{ full_name: string | null; username: string | null; avatar_url: string | null } | null>(null);
  const [otherUserAvatarUrl, setOtherUserAvatarUrl] = useState<string | null>(null);
  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState<string | null>(null);
  const [currentUserInitials, setCurrentUserInitials] = useState<string>('?');

  // One-time init: resolve user, find/create conversation, load messages
  useEffect(() => {
    if (!otherUserId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const uid = user.id;
      if (!cancelled) setCurrentUserId(uid);

      // Find or create conversation
      const u1 = uid < otherUserId ? uid : otherUserId;
      const u2 = uid < otherUserId ? otherUserId : uid;
      let cid: string | null = null;
      const { data: existing } = await supabase
        .from('dm_conversations')
        .select('id')
        .eq('user1_id', u1)
        .eq('user2_id', u2)
        .maybeSingle();
      if (existing?.id) {
        cid = existing.id;
      } else {
        const { data: created, error: insertErr } = await supabase
          .from('dm_conversations')
          .insert({ user1_id: u1, user2_id: u2 })
          .select('id')
          .single();
        if (insertErr) {
          // Another client may have inserted concurrently — re-fetch
          const { data: refetch } = await supabase
            .from('dm_conversations')
            .select('id')
            .eq('user1_id', u1)
            .eq('user2_id', u2)
            .maybeSingle();
          cid = refetch?.id ?? null;
        } else {
          cid = created?.id ?? null;
        }
      }
      if (!cid || cancelled) { if (!cancelled) setLoading(false); return; }
      if (!cancelled) setConversationId(cid);

      // Load initial messages
      const { data } = await supabase
        .from('dm_messages')
        .select('id, conversation_id, sender_id, body, created_at')
        .eq('conversation_id', cid)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!cancelled) {
        setMessages(((data ?? []) as DMMessage[]).reverse());
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [otherUserId]);

  // Load other user's profile
  useEffect(() => {
    if (!otherUserId) return;
    let cancelled = false;
    supabase.from('profiles').select('full_name, username, avatar_url').eq('user_id', otherUserId).maybeSingle().then(({ data }) => {
      if (cancelled) return;
      const p = data as { full_name: string | null; username: string | null; avatar_url: string | null } | null;
      setOtherUser(p);
      if (p?.avatar_url) resolveAvatarUrl(p.avatar_url).then((url) => { if (!cancelled && url) setOtherUserAvatarUrl(url); });
    });
    return () => { cancelled = true; };
  }, [otherUserId]);

  // Load current user's profile for avatar/initials
  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    supabase.from('profiles').select('full_name, username, avatar_url').eq('user_id', currentUserId).maybeSingle().then(({ data }) => {
      if (cancelled) return;
      const p = data as { full_name: string | null; username: string | null; avatar_url: string | null } | null;
      if (p?.full_name?.trim()) setCurrentUserInitials(p.full_name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2));
      else if (p?.username?.trim()) setCurrentUserInitials(p.username.trim().slice(0, 2).toUpperCase());
      if (p?.avatar_url) resolveAvatarUrl(p.avatar_url).then((url) => { if (!cancelled && url) setCurrentUserAvatarUrl(url); });
    });
    return () => { cancelled = true; };
  }, [currentUserId]);

  // Realtime: append new messages directly — no full refetch
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`dm-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const incoming = payload.new as DMMessage;
          setMessages((prev) => {
            // Already in list (real ID matched — deduplicate)
            if (prev.some((m) => m.id === incoming.id)) return prev;
            // Remove any matching temp message from our own optimistic update
            const filtered = prev.filter(
              (m) => !(m.id.startsWith('temp-') && m.sender_id === incoming.sender_id && m.body === incoming.body)
            );
            return [...filtered, incoming];
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  // Auto-scroll to bottom when new realtime messages arrive (after initial load)
  useEffect(() => {
    if (messages.length > 0 && !loading && hasScrolledInitiallyRef.current) {
      const t = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 60);
      return () => clearTimeout(t);
    }
  }, [messages.length, loading]);

  // Mark conversation as read whenever the screen is focused
  useFocusEffect(
    useCallback(() => {
      if (currentUserId && conversationId) {
        supabase.from('dm_conversation_read').upsert(
          { user_id: currentUserId, conversation_id: conversationId, last_read_at: new Date().toISOString() },
          { onConflict: 'user_id,conversation_id' }
        ).then(() => {});
      }
    }, [currentUserId, conversationId])
  );

  // Trim old messages in background (fire-and-forget, does not block send)
  const trimOldMessages = useCallback(async (cid: string) => {
    try {
      const { count } = await supabase
        .from('dm_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', cid);
      if (count && count > 50) {
        const { data: toDelete } = await supabase
          .from('dm_messages')
          .select('id')
          .eq('conversation_id', cid)
          .order('created_at', { ascending: true })
          .limit(count - 50);
        if (toDelete && toDelete.length > 0) {
          await supabase.from('dm_messages').delete().in('id', toDelete.map((m: any) => m.id));
        }
      }
    } catch { /* swallow — trim is best-effort */ }
  }, []);

  const sendMessage = async () => {
    const text = body.trim();
    if (!text || !currentUserId || !conversationId || sending) return;
    setSending(true);
    setBody('');

    // Optimistic: show message immediately with a temp ID
    const tempId = `temp-${Date.now()}`;
    const tempMsg: DMMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      body: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const { data: inserted } = await supabase
        .from('dm_messages')
        .insert({ conversation_id: conversationId, sender_id: currentUserId, body: text })
        .select('id, conversation_id, sender_id, body, created_at')
        .single();

      if (inserted) {
        // Replace temp with confirmed message (real ID)
        setMessages((prev) => prev.map((m) => m.id === tempId ? (inserted as DMMessage) : m));
      }

      // Trim in background — does not block the UI
      trimOldMessages(conversationId);
    } catch {
      // Revert optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setBody(text); // restore body so user can retry
    } finally {
      setSending(false);
    }
  };

  const listData = useMemo(() => buildMessageList(messages), [messages]);
  const displayName = otherUser?.full_name || otherUser?.username || 'User';
  const otherInitials = otherUser?.full_name?.trim()
    ? otherUser.full_name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : otherUser?.username?.trim()
      ? otherUser.username.trim().slice(0, 2).toUpperCase()
      : '?';

  if (!otherUserId) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.empty}>{t.messages.selectSomeone}</Text>
        <TouchableOpacity style={{ marginTop: spacing.md }} onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.primary }}>{t.common.back}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{displayName}</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            style={styles.list}
            data={listData}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.empty}>{t.messages.noMessages}</Text>}
            onContentSizeChange={() => {
              if (!hasScrolledInitiallyRef.current && messages.length > 0) {
                flatListRef.current?.scrollToEnd({ animated: false });
                hasScrolledInitiallyRef.current = true;
              }
            }}
            renderItem={({ item }) => {
              if ('type' in item && item.type === 'date-header') {
                return (
                  <View style={styles.dateHeaderContainer}>
                    <Text style={styles.dateHeaderText}>{item.label}</Text>
                  </View>
                );
              }
              const msg = item as DMMessage;
              const isSent = msg.sender_id === currentUserId;
              const isPending = msg.id.startsWith('temp-');
              const avatarUrl = isSent ? currentUserAvatarUrl : otherUserAvatarUrl;
              const initials = isSent ? currentUserInitials : otherInitials;
              return (
                <View style={[styles.messageRow, isSent && styles.messageRowSent]}>
                  <View style={styles.messageAvatar}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.messageAvatarImage} />
                    ) : (
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>{initials}</Text>
                    )}
                  </View>
                  <View style={[styles.messageBubble, isSent ? styles.messageBubbleSent : styles.messageBubbleReceived, isPending && styles.messageBubblePending]}>
                    <Text style={[styles.messageText, isSent ? styles.messageTextSent : styles.messageTextReceived]}>{msg.body}</Text>
                    <Text style={isSent ? styles.messageTimeSent : styles.messageTimeReceived}>
                      {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder={t.messages.messagePlaceholder}
            placeholderTextColor={colors.textSecondary}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={1000}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!body.trim() || sending) && { opacity: 0.5 }]}
            onPress={sendMessage}
            disabled={!body.trim() || sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <Ionicons name="send" size={20} color={colors.textOnPrimary} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
