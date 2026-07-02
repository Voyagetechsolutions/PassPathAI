import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/lib/auth';
import { apiRequest } from '../src/lib/api';
import { ChevronRight, Target, Check, Bulb } from '../src/components/icons';
import { colors, radius, spacing, text } from '../src/theme';
import type { TutorStart, TutorStarter, TutorMessage, TutorReply, TutorRating } from '../src/lib/types';

export default function LearnScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ topicId: string; topic?: string; subjectName?: string }>();
  const topicId = params.topicId;

  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [starters, setStarters] = useState<TutorStarter[]>([]);
  const [understanding, setUnderstanding] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExplain, setShowExplain] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [requiresPremium, setRequiresPremium] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const start = await apiRequest<TutorStart>(`/tutor/topic/${topicId}/start`, { method: 'POST', token });
      setMessages(start.messages);
      setStarters(start.starters);
      setUnderstanding(start.understandingScore);
      setRemaining(start.messagesRemaining);
      setLimitReached(start.limitReached);
      setRequiresPremium(start.requiresPremium);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t open this lesson. Try again.');
    } finally {
      setLoading(false);
    }
  }, [topicId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = useCallback(
    async (opts: { content?: string; starter?: string; display: string }) => {
      setMessages((m) => [...m, { role: 'user', content: opts.display }]);
      setSending(true);
      try {
        const r = await apiRequest<TutorReply>(`/tutor/topic/${topicId}/message`, {
          method: 'POST',
          token,
          body: { content: opts.content, starter: opts.starter },
        });
        if (r.requiresPremium) {
          setRequiresPremium(true);
        } else {
          setMessages((m) => [...m, { role: 'assistant', content: r.reply }]);
        }
        setRemaining(r.messagesRemaining);
        setLimitReached(r.limitReached);
      } catch {
        setMessages((m) => [...m, { role: 'assistant', content: 'I had trouble answering just then — say that again?' }]);
      } finally {
        setSending(false);
      }
    },
    [topicId, token],
  );

  function onSend() {
    const t = input.trim();
    if (!t || sending) return;
    setInput('');
    void send({ content: t, display: t });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.white }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <View style={{ transform: [{ rotate: '180deg' }] }}><ChevronRight color={colors.ink400} size={22} /></View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontFamily: 'Poppins_700Bold', color: colors.ink }} numberOfLines={1}>{params.topic ?? 'Lesson'}</Text>
          {params.subjectName ? <Text style={text.caption} numberOfLines={1}>{params.subjectName} · Your tutor</Text> : null}
        </View>
        {understanding !== null ? (
          <View style={{ backgroundColor: understanding >= 7 ? '#EAF7EF' : colors.navy50, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ fontSize: 12, fontFamily: 'Poppins_700Bold', color: understanding >= 7 ? colors.emerald : colors.navy }}>{understanding}/10</Text>
          </View>
        ) : null}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={{ paddingTop: spacing.xxl, alignItems: 'center', gap: spacing.md }}>
              <ActivityIndicator color={colors.brand} />
              <Text style={text.caption}>Your tutor is getting ready…</Text>
            </View>
          ) : null}
          {error ? (
            <View style={{ paddingTop: spacing.xl, alignItems: 'center', gap: spacing.md }}>
              <Text style={[text.body, { color: colors.danger, textAlign: 'center' }]}>{error}</Text>
              <Pressable onPress={load} style={{ paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.navy }}>
                <Text style={{ color: colors.white, fontFamily: 'Poppins_600SemiBold' }}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} content={m.content} />
          ))}
          {sending ? <TypingBubble /> : null}
        </ScrollView>

        {/* Footer: paywall takes priority, then the budget notice, then normal input */}
        {!loading && !error && requiresPremium ? (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white, padding: spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' }}>
                <Bulb color={colors.brand} size={20} />
              </View>
              <Text style={[text.body, { color: colors.ink, fontFamily: 'Poppins_600SemiBold', flex: 1 }]}>You’ve used your free tutor messages</Text>
            </View>
            <Text style={{ fontSize: 14, lineHeight: 20, color: colors.ink600 }}>
              Upgrade to PassPath Premium for unlimited AI tutoring, unlimited mock exams, and full career guidance.
            </Text>
            <Pressable onPress={() => router.push('/premium')} style={{ backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: colors.white, fontSize: 15, fontFamily: 'Poppins_700Bold' }}>Unlock Premium</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && !requiresPremium && limitReached ? (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white, padding: spacing.lg, gap: spacing.md }}>
            <Text style={{ fontSize: 14, lineHeight: 20, color: colors.ink600, textAlign: 'center' }}>
              You’ve done a lot of learning on this topic! Show what you know — or practise it.
            </Text>
            <Pressable onPress={() => setShowExplain(true)} style={{ backgroundColor: colors.navy, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }}>
              <Bulb color={colors.white} size={18} />
              <Text style={{ color: colors.white, fontSize: 15, fontFamily: 'Poppins_600SemiBold' }}>Explain it back</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && !requiresPremium && !limitReached ? (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white, paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
              {starters.map((s) => (
                <Pressable
                  key={s.key}
                  disabled={sending}
                  onPress={() => send({ starter: s.key, display: s.label })}
                  style={({ pressed }) => [{ borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8 }, (pressed || sending) && { opacity: 0.55 }]}
                >
                  <Text style={{ fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: colors.ink600 }}>{s.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Reply, or ask anything…"
                placeholderTextColor={colors.ink300}
                multiline
                style={{ flex: 1, maxHeight: 110, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingTop: 10, paddingBottom: 10, fontSize: 15, color: colors.ink }}
              />
              <Pressable
                onPress={onSend}
                disabled={sending || !input.trim()}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: input.trim() ? colors.navy : colors.ink300, alignItems: 'center', justifyContent: 'center' }}
              >
                <View style={{ transform: [{ rotate: '-90deg' }] }}><ChevronRight color={colors.white} size={22} /></View>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, marginTop: spacing.sm }}>
              <Pressable onPress={() => setShowExplain(true)} style={({ pressed }) => pressed && { opacity: 0.6 }}>
                <Text style={{ fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: colors.brand }}>
                  Think you’ve got it? Explain it back →
                </Text>
              </Pressable>
              {remaining !== null && remaining <= 6 ? (
                <Text style={text.caption}>· {remaining} left</Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <ExplainModal
        visible={showExplain}
        topic={params.topic ?? 'this topic'}
        topicId={topicId}
        token={token}
        onClose={() => setShowExplain(false)}
        onRated={(rating) => {
          setUnderstanding(rating.understandingScore);
          setMessages((m) => [...m, { role: 'assistant', content: rating.feedback }]);
        }}
        onPractise={() => {
          setShowExplain(false);
          router.push({ pathname: '/practice', params: { topicId, topic: params.topic ?? 'Practice', subjectName: params.subjectName ?? '' } });
        }}
      />
    </SafeAreaView>
  );
}

function Bubble({ role, content }: { role: 'assistant' | 'user'; content: string }) {
  const isUser = role === 'user';
  return (
    <View style={{ flexDirection: 'row', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <View
        style={{
          maxWidth: '86%',
          backgroundColor: isUser ? colors.navy : colors.white,
          borderWidth: isUser ? 0 : 1,
          borderColor: colors.line,
          borderRadius: radius.lg,
          borderBottomRightRadius: isUser ? 6 : radius.lg,
          borderBottomLeftRadius: isUser ? radius.lg : 6,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm + 2,
        }}
      >
        <Text style={{ fontSize: 15, lineHeight: 22, color: isUser ? colors.white : colors.ink }}>{content}</Text>
      </View>
    </View>
  );
}

function TypingBubble() {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-start' }}>
      <View style={{ backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, borderBottomLeftRadius: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <ActivityIndicator size="small" color={colors.ink300} />
        <Text style={text.caption}>tutor is typing…</Text>
      </View>
    </View>
  );
}

function ExplainModal({
  visible,
  topic,
  topicId,
  token,
  onClose,
  onRated,
  onPractise,
}: {
  visible: boolean;
  topic: string;
  topicId: string;
  token: string | null;
  onClose: () => void;
  onRated: (r: TutorRating) => void;
  onPractise: () => void;
}) {
  const [text_, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TutorRating | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    setText('');
    setResult(null);
    setErr(null);
    setBusy(false);
  }

  async function submit() {
    if (text_.trim().length < 10 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await apiRequest<TutorRating>(`/tutor/topic/${topicId}/rate`, { method: 'POST', token, body: { explanation: text_.trim() } });
      setResult(r);
      onRated(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Couldn’t rate that just now — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { reset(); onClose(); }}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ backgroundColor: colors.canvas, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xl, maxHeight: '88%' }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: spacing.lg }} />

            {!result ? (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.navy50, alignItems: 'center', justifyContent: 'center' }}>
                    <Target color={colors.navy} size={20} />
                  </View>
                  <Text style={[text.h2, { fontSize: 19 }]}>Explain it back</Text>
                </View>
                <Text style={[text.body, { marginBottom: spacing.lg }]}>
                  Teach {topic} to me in your own words, like you’re explaining it to a friend. I’ll tell you how well you’ve got it — out of 10.
                </Text>
                <TextInput
                  value={text_}
                  onChangeText={setText}
                  placeholder="In my own words, this topic is about…"
                  placeholderTextColor={colors.ink300}
                  multiline
                  style={{ minHeight: 150, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, fontSize: 15, lineHeight: 22, color: colors.ink, textAlignVertical: 'top' }}
                />
                {err ? <Text style={[text.body, { color: colors.danger, marginTop: spacing.sm }]}>{err}</Text> : null}
                <Pressable
                  onPress={submit}
                  disabled={busy || text_.trim().length < 10}
                  style={{ marginTop: spacing.lg, backgroundColor: text_.trim().length < 10 ? colors.ink300 : colors.navy, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }}
                >
                  {busy ? <ActivityIndicator color={colors.white} size="small" /> : <Bulb color={colors.white} size={18} />}
                  <Text style={{ color: colors.white, fontSize: 15, fontFamily: 'Poppins_600SemiBold' }}>{busy ? 'Marking…' : 'Get my score'}</Text>
                </Pressable>
                <Pressable onPress={() => { reset(); onClose(); }} style={{ marginTop: spacing.md, alignItems: 'center' }}>
                  <Text style={[text.caption, { color: colors.ink400 }]}>Not yet — keep learning</Text>
                </Pressable>
              </ScrollView>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
                  <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: result.score >= 7 ? '#EAF7EF' : colors.navy50, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 30, fontFamily: 'Poppins_700Bold', color: result.score >= 7 ? colors.emerald : colors.navy }}>{result.score}</Text>
                    <Text style={{ fontSize: 12, color: result.score >= 7 ? colors.emerald : colors.navy, marginTop: -2 }}>out of 10</Text>
                  </View>
                  <Text style={[text.h2, { fontSize: 19, marginTop: spacing.md }]}>
                    {result.score >= 8 ? 'You’ve nailed it! 🎉' : result.score >= 6 ? 'Solid — nearly there' : 'Good start — let’s firm it up'}
                  </Text>
                </View>

                <View style={{ backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md, marginBottom: spacing.md }}>
                  <Text style={{ fontSize: 15, lineHeight: 22, color: colors.ink600 }}>{result.feedback}</Text>
                </View>

                {result.strengths.length > 0 ? (
                  <View style={{ marginBottom: spacing.md }}>
                    <Text style={[text.label, { marginBottom: spacing.sm }]}>You understood</Text>
                    <View style={{ gap: spacing.sm }}>
                      {result.strengths.map((s, i) => (
                        <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
                          <View style={{ marginTop: 2 }}><Check color={colors.emerald} size={16} /></View>
                          <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: colors.ink600 }}>{s}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {result.gaps.length > 0 ? (
                  <View style={{ marginBottom: spacing.md }}>
                    <Text style={[text.label, { marginBottom: spacing.sm }]}>Worth another look</Text>
                    <View style={{ gap: spacing.sm }}>
                      {result.gaps.map((g, i) => (
                        <Text key={i} style={{ fontSize: 14, lineHeight: 20, color: colors.ink600 }}>• {g}</Text>
                      ))}
                    </View>
                  </View>
                ) : null}

                <Pressable onPress={onPractise} style={{ backgroundColor: colors.navy, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }}>
                  <Target color={colors.white} size={18} />
                  <Text style={{ color: colors.white, fontSize: 15, fontFamily: 'Poppins_600SemiBold' }}>Practise this topic</Text>
                </Pressable>
                <Pressable onPress={() => { reset(); onClose(); }} style={{ marginTop: spacing.md, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: colors.brand }}>Back to my tutor</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
