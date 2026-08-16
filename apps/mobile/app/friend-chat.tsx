import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { ChevronRight } from '../src/components/icons';
import { ErrorText } from '../src/components/ui';
import { colors, radius, spacing, text } from '../src/theme';

interface Message { id: string; senderId: string; content: string; createdAt: string }

export default function FriendChat() {
  const router = useRouter();
  const params = useLocalSearchParams<{ friendshipId: string; name: string }>();
  const { token, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let live = true;
    const load = () => apiRequest<Message[]>(`/social/friends/${params.friendshipId}/messages`, { token })
      .then((rows) => { if (live) { setMessages(rows); setError(null); } })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : 'Could not load this chat.'); });
    load(); const timer = setInterval(load, 4000);
    return () => { live = false; clearInterval(timer); };
  }, [params.friendshipId, token]);

  async function send() {
    const value = content.trim(); if (!value) return;
    setSending(true); setError(null);
    try {
      const message = await apiRequest<Message>(`/social/friends/${params.friendshipId}/messages`, { method: 'POST', token, body: { content: value } });
      setContent('');
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your message.');
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={{ padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderColor: colors.line, backgroundColor: colors.white }}>
        <Pressable onPress={() => router.back()} style={{ transform: [{ rotate: '180deg' }] }}><ChevronRight /></Pressable>
        <View><Text style={text.title}>{params.name}</Text><Text style={text.caption}>Study chat</Text></View>
      </View>
      {error ? <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}><ErrorText message={error} /></View> : null}
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })} contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1, justifyContent: 'flex-end' }}>
        {messages.map((message) => {
          const mine = message.senderId === profile?.studentProfileId;
          return <View key={message.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', backgroundColor: mine ? colors.navy : colors.white, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: mine ? 0 : 1, borderColor: colors.line }}>
            <Text style={{ color: mine ? colors.white : colors.ink, fontSize: 14 }}>{message.content}</Text>
          </View>;
        })}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.white }}>
        <TextInput value={content} onChangeText={setContent} placeholder="Message your study friend…" placeholderTextColor={colors.ink300} multiline
          style={{ flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.ink, maxHeight: 100 }} />
        <Pressable disabled={sending || !content.trim()} onPress={send} style={{ alignSelf: 'flex-end', backgroundColor: colors.brand, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 12, opacity: sending || !content.trim() ? 0.5 : 1 }}><Text style={{ color: colors.white, fontFamily: 'Poppins_600SemiBold' }}>{sending ? 'Sending…' : 'Send'}</Text></Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
