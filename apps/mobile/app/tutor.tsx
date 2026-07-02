import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/lib/auth';
import { apiRequest } from '../src/lib/api';
import { useApi } from '../src/lib/use-api';
import { Screen } from '../src/components/screen';
import { Card, IconChip, PrimaryButton, Badge, ErrorText, EmptyState } from '../src/components/ui';
import { Bulb, Book } from '../src/components/icons';
import { colors, radius, spacing, text } from '../src/theme';
import type { AskResult, ProfileSummary } from '../src/lib/types';

const SUGGESTIONS = [
  'Explain this topic with a worked example.',
  'What does my syllabus say I need to know for this?',
  'Give me an exam-style question on this and mark my answer.',
];

export default function TutorScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { data: me } = useApi<ProfileSummary>('/profile/me');
  const [question, setQuestion] = useState('');
  const [subjectCode, setSubjectCode] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const subjects = useMemo(() => me?.subjects ?? [], [me]);

  async function ask(q?: string) {
    const query = (q ?? question).trim();
    if (query.length < 3) return;
    setQuestion(query);
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiRequest<AskResult>('/ai/ask', {
        method: 'POST',
        token,
        body: { question: query, subjectCode, grade: me?.grade },
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The tutor is unavailable right now.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="AI Tutor" subtitle="Curriculum-grounded help, scoped to your subjects." onBack={() => router.back()}>
      <Card>
        {subjects.length > 0 ? (
          <>
            <Text style={text.label}>Subject</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6, marginBottom: spacing.md }}>
              <Pill label="Any subject" active={!subjectCode} onPress={() => setSubjectCode(undefined)} />
              {subjects.map((s) => (
                <Pill key={s.id} label={s.name} active={subjectCode === s.code} onPress={() => setSubjectCode(s.code)} />
              ))}
            </ScrollView>
          </>
        ) : null}

        <Text style={text.label}>Your question</Text>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder="e.g. Explain photosynthesis with an example."
          placeholderTextColor={colors.ink300}
          multiline
          style={styles_input}
        />
        <PrimaryButton label={busy ? 'Thinking…' : 'Ask the tutor'} onPress={() => ask()} disabled={busy} icon={<Bulb color={colors.white} size={18} />} />
      </Card>

      {error ? <ErrorText message={error} /> : null}

      {!result && !error ? (
        <View style={{ gap: spacing.md }}>
          <Text style={text.section}>Try asking</Text>
          {SUGGESTIONS.map((s) => (
            <Card key={s}>
              <Text style={[text.body, { color: colors.ink }]} onPress={() => ask(s)}>
                {s}
              </Text>
            </Card>
          ))}
        </View>
      ) : null}

      {result ? (
        result.answered ? (
          <View style={{ gap: spacing.lg }}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                <IconChip tone="brand"><Bulb color={colors.brand} size={20} /></IconChip>
                <Text style={text.title}>Explanation</Text>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Badge tone={result.grounded ? 'emerald' : 'muted'}>
                    {result.grounded ? 'From CAPS sources' : 'CAPS-aligned'}
                  </Badge>
                </View>
              </View>
              <Text style={styles_answer}>{result.answer}</Text>
            </Card>

            {result.citations.length > 0 ? (
              <View>
                <Text style={[text.section, { marginBottom: spacing.md }]}>Curriculum sources</Text>
                <View style={{ gap: spacing.md }}>
                  {result.citations.map((c, i) => (
                    <Card key={c.chunkId}>
                      <View style={{ flexDirection: 'row', gap: spacing.md }}>
                        <IconChip tone="navy"><Book color={colors.navy} size={18} /></IconChip>
                        <View style={{ flex: 1 }}>
                          <Badge tone="muted">Source {i + 1}</Badge>
                          <Text style={[text.caption, { marginTop: 6 }]}>{c.preview}…</Text>
                        </View>
                      </View>
                    </Card>
                  ))}
                </View>
              </View>
            ) : null}

            <PrimaryButton label="Ask another question" onPress={() => { setResult(null); setQuestion(''); }} />
          </View>
        ) : (
          <EmptyState title="Let’s keep it to schoolwork" message={result.answer} />
        )
      ) : null}
    </Screen>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        borderRadius: radius.pill ?? 999,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.line,
        backgroundColor: active ? colors.brand : colors.white,
        marginRight: spacing.sm,
      }}
    >
      <Text style={{ fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: active ? colors.white : colors.ink600 }}>{label}</Text>
    </Pressable>
  );
}

const styles_input = {
  backgroundColor: colors.white,
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: radius.md,
  padding: spacing.md,
  minHeight: 80,
  textAlignVertical: 'top' as const,
  fontSize: 15,
  color: colors.ink,
  marginTop: 6,
  marginBottom: spacing.md,
};

const styles_answer = {
  fontSize: 15,
  lineHeight: 23,
  color: colors.ink600,
};
