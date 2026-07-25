import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { ChevronRight } from '../src/components/icons';
import { colors, radius, spacing, text } from '../src/theme';

interface Message { id: string; senderId: string; content: string; createdAt: string }

export default function FriendChat() {
  const router = useRouter();
  const params = useLocalSearchParams<{ friendshipId: string; name: string }>();
  const { token, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');

  useEffect(() => {
    let live = true;
    const load = () => apiRequest<Message[]>(`/social/friends/${params.friendshipId}/messages`, { token }).then((rows) => live && setMessages(rows)).catch(() => undefined);
    load(); const timer = setInterval(load, 4000);
    return () => { live = false; clearInterval(timer); };
  }, [params.friendshipId, token]);

  async function send() {
    const value = content.trim(); if (!value) return;
    setContent('');
    const message = await apiRequest<Message>(`/social/friends/${params.friendshipId}/messages`, { method: 'POST', token, body: { content: value } });
    setMessages((current) => [...current, message]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderColor: colors.line, backgroundColor: colors.white }}>
        <Pressable onPress={() => router.back()} style={{ transform: [{ rotate: '180deg' }] }}><ChevronRight /></Pressable>
        <View><Text style={text.title}>{params.name}</Text><Text style={text.caption}>Study chat</Text></View>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1, justifyContent: 'flex-end' }}>
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
        <Pressable onPress={send} style={{ alignSelf: 'flex-end', backgroundColor: colors.brand, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 12 }}><Text style={{ color: colors.white, fontFamily: 'Poppins_600SemiBold' }}>Send</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}
