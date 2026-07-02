import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/lib/auth';
import { apiRequest } from '../src/lib/api';
import { Screen } from '../src/components/screen';
import { Card, ScoreRing, Badge, PrimaryButton, Loading, ErrorText } from '../src/components/ui';
import { colors, radius, spacing, text } from '../src/theme';

interface ExamItem {
  examItemId: string;
  marks: number;
  prompt: string;
  type: string;
  options: Array<{ label: string; text: string }>;
}
interface ExamStart {
  attemptId: string;
  title: string;
  durationMins: number;
  totalMarks: number;
  sections: Array<{ title: string; items: ExamItem[] }>;
}
interface ExamResult {
  scorePercent: number;
  marksAwarded: number;
  totalMarks: number;
  sections: Array<{ title: string; awarded: number; total: number }>;
  responses: Array<{ examItemId: string; prompt: string; type: string; marksAwarded: number; maxMarks: number; feedback: string | null }>;
}

export default function ExamPaperScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { paperId, title } = useLocalSearchParams<{ paperId: string; title?: string }>();
  const [exam, setExam] = useState<ExamStart | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);

  useEffect(() => {
    if (!paperId || !token) return;
    apiRequest<ExamStart>(`/exams/${paperId}/start`, { method: 'POST', token })
      .then(setExam)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not start the exam.'));
  }, [paperId, token]);

  async function submit() {
    if (!exam) return;
    setSubmitting(true);
    try {
      const responses = exam.sections.flatMap((s) => s.items).map((it) => ({ examItemId: it.examItemId, response: answers[it.examItemId] ?? '' }));
      const r = await apiRequest<ExamResult>(`/exams/attempts/${exam.attemptId}/submit`, { method: 'POST', token, body: { responses } });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit.');
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <Screen onBack={() => router.back()}><ErrorText message={error} /></Screen>;
  if (!exam) return <Screen onBack={() => router.back()}><Loading label="Setting up your exam…" /></Screen>;

  if (result) {
    return (
      <Screen title="Exam results" subtitle={title ? String(title) : exam.title} onBack={() => router.back()}>
        <Card style={{ alignItems: 'center' }}>
          <ScoreRing value={result.scorePercent} label="Score" size={150} />
          <Text style={[text.body, { marginTop: spacing.md }]}>{result.marksAwarded} / {result.totalMarks} marks</Text>
          <Text style={[text.caption, { marginTop: 4, textAlign: 'center' }]}>
            Every question marked by the AI examiner — including your written answers.
          </Text>
        </Card>

        {result.responses.filter((r) => r.type !== 'MULTIPLE_CHOICE').length > 0 ? (
          <View>
            <Text style={[text.section, { marginBottom: spacing.md }]}>Your written answers</Text>
            <View style={{ gap: spacing.md }}>
              {result.responses
                .filter((r) => r.type !== 'MULTIPLE_CHOICE')
                .map((r) => (
                  <Card key={r.examItemId}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, marginBottom: 6 }}>
                      <Text style={[text.label, { flex: 1 }]} numberOfLines={2}>{r.prompt}</Text>
                      <Badge tone={r.marksAwarded >= r.maxMarks ? 'emerald' : r.marksAwarded > 0 ? 'warn' : 'danger'}>
                        {r.marksAwarded}/{r.maxMarks}
                      </Badge>
                    </View>
                    {r.feedback ? <Text style={text.caption}>{r.feedback}</Text> : null}
                  </Card>
                ))}
            </View>
          </View>
        ) : null}
        <View>
          <Text style={[text.section, { marginBottom: spacing.md }]}>By section</Text>
          <Card>
            {result.sections.map((s, i) => (
              <View key={s.title} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.line }}>
                <Text style={[text.body, { color: colors.ink, flex: 1 }]}>{s.title}</Text>
                <Badge tone="navy">{s.awarded}/{s.total}</Badge>
              </View>
            ))}
          </Card>
        </View>
        <PrimaryButton label="Back to exam centre" onPress={() => router.back()} />
      </Screen>
    );
  }

  let qNo = 0;
  return (
    <Screen title={title ? String(title) : exam.title} subtitle={`${exam.durationMins} min · ${exam.totalMarks} marks`} onBack={() => router.back()}>
      {exam.sections.map((section) => (
        <View key={section.title} style={{ gap: spacing.md }}>
          <Text style={[text.section, { marginTop: spacing.sm }]}>{section.title}</Text>
          {section.items.map((it) => {
            qNo += 1;
            const isMcq = it.type === 'MULTIPLE_CHOICE';
            return (
              <Card key={it.examItemId}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <Text style={text.label}>Question {qNo}</Text>
                  <Badge tone="muted">{it.marks} {it.marks === 1 ? 'mark' : 'marks'}</Badge>
                </View>
                <Text style={[text.body, { color: colors.ink, marginBottom: spacing.md }]}>{it.prompt}</Text>
                {isMcq ? (
                  <View style={{ gap: spacing.sm }}>
                    {it.options.map((o) => {
                      const active = answers[it.examItemId] === o.label;
                      return (
                        <Pressable
                          key={o.label}
                          onPress={() => setAnswers((a) => ({ ...a, [it.examItemId]: o.label }))}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1.5, borderColor: active ? colors.navy : colors.line, backgroundColor: active ? colors.navy50 : colors.white, borderRadius: radius.md, padding: spacing.md }}
                        >
                          <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.navy : colors.canvas }}>
                            <Text style={{ color: active ? colors.white : colors.ink400, fontFamily: 'Poppins_700Bold', fontSize: 12 }}>{o.label}</Text>
                          </View>
                          <Text style={[text.body, { color: colors.ink, flex: 1 }]}>{o.text}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <TextInput
                    value={answers[it.examItemId] ?? ''}
                    onChangeText={(v) => setAnswers((a) => ({ ...a, [it.examItemId]: v }))}
                    placeholder="Write your answer…"
                    placeholderTextColor={colors.ink300}
                    multiline
                    style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, minHeight: 90, textAlignVertical: 'top', fontSize: 15, color: colors.ink, backgroundColor: colors.white }}
                  />
                )}
              </Card>
            );
          })}
        </View>
      ))}
      <PrimaryButton label={submitting ? 'Submitting…' : 'Submit exam'} onPress={submit} disabled={submitting} />
    </Screen>
  );
}
