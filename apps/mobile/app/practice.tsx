import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/lib/auth';
import { apiRequest } from '../src/lib/api';
import { Screen } from '../src/components/screen';
import { Card, IconChip, PrimaryButton, ProgressBar, Badge, Loading, ErrorText } from '../src/components/ui';
import { Bulb, Check, Target } from '../src/components/icons';
import { colors, radius, spacing, text } from '../src/theme';

interface PQuestion {
  questionId: string;
  prompt: string;
  difficulty: string;
  masteryScore: number;
  options: Array<{ label: string; text: string }>;
}
interface PAnswer {
  correct: boolean;
  masteryScore: number;
  message?: string;
  correctLabel?: string | null;
  correctText?: string | null;
  explanation?: string;
}

export default function PracticeScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ topicId: string; topic?: string; subjectName?: string }>();
  const [q, setQ] = useState<PQuestion | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<PAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNext = useCallback(async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setSelected(null);
    setQ(null);
    try {
      const next = await apiRequest<PQuestion>(`/practice/topic/${params.topicId}/next`, { method: 'POST', token });
      setQ(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No practice questions for this topic yet.');
    } finally {
      setBusy(false);
    }
  }, [params.topicId, token]);

  useEffect(() => {
    void loadNext();
  }, [loadNext]);

  async function check() {
    if (!q || !selected) return;
    setBusy(true);
    try {
      const r = await apiRequest<PAnswer>('/practice/answer', { method: 'POST', token, body: { questionId: q.questionId, response: selected } });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check your answer.');
    } finally {
      setBusy(false);
    }
  }

  const mastery = result?.masteryScore ?? q?.masteryScore ?? 0;

  return (
    <Screen title={params.topic ?? 'Practice'} subtitle={params.subjectName} onBack={() => router.back()}>
      {/* Mastery — encouraging, never punishing */}
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Text style={text.label}>Your mastery of this topic</Text>
          <Text style={[text.body, { color: colors.ink, fontFamily: 'Poppins_600SemiBold' }]}>{mastery}%</Text>
        </View>
        <ProgressBar value={mastery} tone={mastery >= 50 ? 'emerald' : 'warn'} />
        <Text style={[text.caption, { marginTop: spacing.sm }]}>Questions adapt to you — get them right and they get tougher.</Text>
      </Card>

      {error ? <ErrorText message={error} /> : null}
      {busy && !q ? <Loading label="Finding the right question for you…" /> : null}

      {q ? (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <Text style={text.label}>Question</Text>
            <Badge tone="muted">{q.difficulty.toLowerCase()}</Badge>
          </View>
          <Text style={[text.h2, { fontSize: 18, marginBottom: spacing.lg }]}>{q.prompt}</Text>

          <View style={{ gap: spacing.sm }}>
            {q.options.map((o) => {
              const isChosen = selected === o.label;
              const isCorrectOpt = result && result.correctLabel === o.label;
              const isWrongChosen = result && !result.correct && isChosen;
              const bg = isCorrectOpt ? '#EAF7EF' : isWrongChosen ? '#FDECEC' : isChosen ? colors.navy50 : colors.white;
              const border = isCorrectOpt ? colors.emerald : isWrongChosen ? colors.danger : isChosen ? colors.navy : colors.line;
              return (
                <Pressable
                  key={o.label}
                  disabled={!!result}
                  onPress={() => setSelected(o.label)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1.5, borderColor: border, backgroundColor: bg, borderRadius: radius.md, padding: spacing.md }}
                >
                  <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: isChosen || isCorrectOpt ? border : colors.canvas }}>
                    <Text style={{ color: isChosen || isCorrectOpt ? colors.white : colors.ink400, fontFamily: 'Poppins_700Bold', fontSize: 12 }}>{o.label}</Text>
                  </View>
                  <Text style={[text.body, { color: colors.ink, flex: 1 }]}>{o.text}</Text>
                </Pressable>
              );
            })}
          </View>

          {!result ? (
            <View style={{ marginTop: spacing.lg }}>
              <PrimaryButton label={busy ? 'Checking…' : 'Check answer'} onPress={check} disabled={busy || !selected} />
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* Result — celebrate, or TEACH (never just fail) */}
      {result ? (
        <View style={{ gap: spacing.lg }}>
          {result.correct ? (
            <Card style={{ backgroundColor: '#EAF7EF', borderColor: colors.emerald, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <IconChip tone="emerald"><Check color={colors.emerald} size={20} /></IconChip>
              <Text style={[text.body, { color: colors.emerald, flex: 1, fontFamily: 'Poppins_600SemiBold' }]}>{result.message}</Text>
            </Card>
          ) : (
            <Card style={{ borderColor: colors.brand, borderWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                <IconChip tone="brand"><Bulb color={colors.brand} size={20} /></IconChip>
                <Text style={text.title}>Let’s understand this</Text>
              </View>
              <Text style={{ fontSize: 15, lineHeight: 23, color: colors.ink600 }}>{result.explanation}</Text>
            </Card>
          )}
          <PrimaryButton
            label={result.correct ? 'Next question' : 'Got it — try another'}
            onPress={loadNext}
            icon={<Target color={colors.white} size={18} />}
          />
        </View>
      ) : null}
    </Screen>
  );
}
