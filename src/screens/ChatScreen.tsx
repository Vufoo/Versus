import { useCallback, useEffect, useMemo, useState } from 'react';
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

function createStyles(colors: ThemeColors) {
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
    messageBubbleReceived: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border },
    messageText: { ...typography.body, fontSize: 15, textAlignVertical: 'center' as any },
    messageTextSent: { color: colors.textOnPrimary },
    messageTextReceived: { color: colors.text },
    messageTime: { ...typography.caption, fontSize: 11, marginTop: 2, opacity: 0.8 },
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
  });
}

export default function ChatScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'Chat'>>();
  const otherUserId = route.params?.userId ?? '';
  const styles = useMemo(() => createStyles(colors), [colors]);

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

  const getOrCreateConversation = useCallback(async (): Promise<string | null> => {
    if (!currentUserId || !otherUserId) return null;
    const u1 = currentUserId < otherUserId ? currentUserId : otherUserId;
    const u2 = currentUserId < otherUserId ? otherUserId : currentUserId;
    const { data: existing } = await supabase
      .from('dm_conversations')
      .select('id')
      .eq('user1_id', u1)
      .eq('user2_id', u2)
      .maybeSingle();
    if (existing?.id) return existing.id;
    const { data: created, error } = await supabase
      .from('dm_conversations')
      .insert({ user1_id: u1, user2_id: u2 })
      .select('id')
      .single();
    if (error || !created?.id) return null;
    return created.id;
  }, [currentUserId, otherUserId]);

  const loadMessages = useCallback(async () => {
    const cid = await getOrCreateConversation();
    if (!cid) {
      setLoading(false);
      return;
    }
    setConversationId(cid);
    const { data } = await supabase
      .from('dm_messages')
      .select('id, conversation_id, sender_id, body, created_at')
      .eq('conversation_id', cid)
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as DMMessage[]);
    setLoading(false);
  }, [getOrCreateConversation]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    })();
  }, []);

  useEffect(() => {
    if (!otherUserId) return;
    supabase.from('profiles').select('full_name, username, avatar_url').eq('user_id', otherUserId).maybeSingle().then(({ data }) => {
      const p = data as { full_name: string | null; username: string | null; avatar_url: string | null } | null;
      setOtherUser(p);
      if (p?.avatar_url) resolveAvatarUrl(p.avatar_url).then((url) => url && setOtherUserAvatarUrl(url));
    });
  }, [otherUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    supabase.from('profiles').select('full_name, username, avatar_url').eq('user_id', currentUserId).maybeSingle().then(({ data }) => {
      const p = data as { full_name: string | null; username: string | null; avatar_url: string | null } | null;
      if (p?.full_name?.trim()) setCurrentUserInitials(p.full_name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2));
      else if (p?.username?.trim()) setCurrentUserInitials(p.username.trim().slice(0, 2).toUpperCase());
      if (p?.avatar_url) resolveAvatarUrl(p.avatar_url).then((url) => url && setCurrentUserAvatarUrl(url));
    });
  }, [currentUserId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`dm-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${conversationId}` },
        () => loadMessages()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, loadMessages]);

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

  const sendMessage = async () => {
    const text = body.trim();
    if (!text || !currentUserId || !conversationId || sending) return;
    setSending(true);
    setBody('');
    try {
      await supabase.from('dm_messages').insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        body: text,
      });
      await loadMessages();
    } catch { /* swallow */ }
    finally { setSending(false); }
  };

  const displayName = otherUser?.full_name || otherUser?.username || 'User';
  const otherInitials = otherUser?.full_name?.trim()
    ? otherUser.full_name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : otherUser?.username?.trim()
      ? otherUser.username.trim().slice(0, 2).toUpperCase()
      : '?';

  if (!otherUserId) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.empty}>Select someone to message</Text>
        <TouchableOpacity style={{ marginTop: spacing.md }} onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.primary }}>Go back</Text>
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
            style={styles.list}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.empty}>No messages yet. Say hi!</Text>}
            renderItem={({ item }) => {
              const isSent = item.sender_id === currentUserId;
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
                  <View style={[styles.messageBubble, isSent ? styles.messageBubbleSent : styles.messageBubbleReceived]}>
                    <Text style={[styles.messageText, isSent ? styles.messageTextSent : styles.messageTextReceived]}>{item.body}</Text>
                    <Text style={[styles.messageTime, isSent && { color: colors.textOnPrimary }]}>
                      {new Date(item.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
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
            placeholder="Message..."
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
