import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/lib/auth';
import { apiRequest } from '../src/lib/api';
import { Screen } from '../src/components/screen';
import {
  Card,
  ProgressBar,
  ScoreRing,
  Badge,
  PrimaryButton,
  SecondaryButton,
  Loading,
  ErrorText,
} from '../src/components/ui';
import { colors, radius, spacing, text } from '../src/theme';

interface StartQuestion {
  id: string;
  prompt: string;
  type: string;
  marks: number;
  options: Array<{ id: string; label: string; text: string }>;
}
interface StartResponse {
  attemptId: string;
  title: string;
  questions: StartQuestion[];
}
interface SubmitResponse {
  scorePercent: number;
  total: number;
  correctCount: number;
  subjectMark?: number | null;
  topics: Array<{ topicId: string; title: string; total: number; correct: number; weak: boolean }>;
}

export default function QuizScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { testId, title } = useLocalSearchParams<{ testId: string; title?: string }>();

  const [start, setStart] = useState<StartResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResponse | null>(null);

  useEffect(() => {
    if (!testId || !token) return;
    apiRequest<StartResponse>(`/diagnostics/${testId}/start`, { method: 'POST', token, body: {} })
      .then(setStart)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not start the practice.'));
  }, [testId, token]);

  async function submit() {
    if (!start) return;
    setSubmitting(true);
    try {
      const payload = {
        answers: start.questions.map((q) => ({ questionId: q.id, response: answers[q.id] ?? '' })),
      };
      const res = await apiRequest<SubmitResponse>(`/diagnostics/attempts/${start.attemptId}/submit`, {
        method: 'POST',
        token,
        body: payload,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit.');
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <Screen onBack={() => router.back()}><ErrorText message={error} /></Screen>;
  if (!start) return <Screen onBack={() => router.back()}><Loading label="Preparing your questions…" /></Screen>;

  // ── Results view ──────────────────────────────────────────────────────────
  if (result) {
    return (
      <Screen title="Results" subtitle={title ? String(title) : 'Practice complete'} onBack={() => router.back()}>
        <Card style={{ alignItems: 'center' }}>
          <ScoreRing value={result.scorePercent} label="Score" size={150} />
          <Text style={[text.body, { marginTop: spacing.md }]}>
            {result.correctCount} of {result.total} correct
          </Text>
        </Card>

        {result.subjectMark != null ? (
          <Card style={{ backgroundColor: '#EAF7EF', borderColor: colors.emerald, borderWidth: 1, alignItems: 'center' }}>
            <Text style={[text.title, { color: colors.emerald }]}>Subject mark: {result.subjectMark}%</Text>
            <Text style={[text.caption, { textAlign: 'center', marginTop: 4 }]}>
              Keep mastering topics to push it higher.
            </Text>
          </Card>
        ) : null}

        <View>
          <Text style={[text.section, { marginBottom: spacing.md }]}>By topic</Text>
          <Card>
            {result.topics.map((t, i) => (
              <View
                key={t.topicId}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: spacing.md,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.line,
                }}
              >
                <Text style={[text.body, { color: colors.ink, flex: 1 }]}>{t.title}</Text>
                <Badge tone={t.weak ? 'danger' : 'emerald'}>
                  {t.correct}/{t.total} {t.weak ? '· revise' : '· solid'}
                </Badge>
              </View>
            ))}
          </Card>
        </View>

        <PrimaryButton label="Back to Study" onPress={() => router.back()} />
      </Screen>
    );
  }

  // ── Question view ─────────────────────────────────────────────────────────
  const q = start.questions[index];
  const total = start.questions.length;
  const selected = answers[q.id];
  const isLast = index === total - 1;
  const answeredCount = Object.keys(answers).length;

  return (
    <Screen title={title ? String(title) : start.title} onBack={() => router.back()}>
      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Text style={text.label}>Question {index + 1} of {total}</Text>
          <Text style={text.caption}>{answeredCount} answered</Text>
        </View>
        <ProgressBar value={((index + 1) / total) * 100} />
      </View>

      <Card>
        <Text style={[text.h2, { fontSize: 18 }]}>{q.prompt}</Text>
        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          {q.options.map((o) => {
            const active = selected === o.label;
            return (
              <Pressable
                key={o.id}
                onPress={() => setAnswers((a) => ({ ...a, [q.id]: o.label }))}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    borderWidth: 1.5,
                    borderColor: active ? colors.navy : colors.line,
                    backgroundColor: active ? colors.navy50 : colors.white,
                    borderRadius: radius.md,
                    padding: spacing.md,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? colors.navy : colors.canvas,
                  }}
                >
                  <Text style={{ color: active ? colors.white : colors.ink400, fontFamily: 'Poppins_700Bold', fontSize: 12 }}>
                    {o.label}
                  </Text>
                </View>
                <Text style={[text.body, { color: colors.ink, flex: 1 }]}>{o.text}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {index > 0 ? (
          <View style={{ flex: 1 }}>
            <SecondaryButton label="Previous" onPress={() => setIndex((i) => i - 1)} />
          </View>
        ) : null}
        <View style={{ flex: 2 }}>
          {isLast ? (
            <PrimaryButton label={submitting ? 'Submitting…' : 'Submit'} onPress={submit} disabled={submitting} />
          ) : (
            <PrimaryButton label="Next" onPress={() => setIndex((i) => i + 1)} />
          )}
        </View>
      </View>
    </Screen>
  );
}
