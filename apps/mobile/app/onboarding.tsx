import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApi } from '../src/lib/use-api';
import { useAuth } from '../src/lib/auth';
import { apiRequest } from '../src/lib/api';
import {
  Card,
  IconChip,
  PrimaryButton,
  SecondaryButton,
  ProgressBar,
  Badge,
  Loading,
  ErrorText,
} from '../src/components/ui';
import { Compass, Check } from '../src/components/icons';
import { GRADES, SYLLABI, phaseGrade } from '../src/lib/sa';
import { colors, radius, spacing, text } from '../src/theme';
import type { ProfileSummary, CareerMatch, Subject, Syllabus } from '../src/lib/types';

interface OnboardingResult extends ProfileSummary {
  diagnostics?: Array<{ testId: string; subjectName: string; questionCount: number }>;
}

const STEPS = ['Grade', 'Syllabus', 'Subjects', 'Careers'];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && { backgroundColor: colors.navy, borderColor: colors.navy },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={{ color: active ? colors.white : colors.ink600, fontFamily: 'Poppins_600SemiBold', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const { token } = useAuth();
  const { data: me } = useApi<ProfileSummary>('/profile/me');

  const [step, setStep] = useState(0);
  const [grade, setGrade] = useState<number | null>(null);
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [recs, setRecs] = useState<CareerMatch[] | null>(null);
  const [diagnostics, setDiagnostics] = useState<OnboardingResult['diagnostics']>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveGrade = grade ?? me?.grade ?? null;
  const selected = Object.keys(marks);

  // Subjects offered for the student's grade come from the curriculum (Senior
  // Phase for 8–9, FET for 10–12) — not a hard-coded list.
  const { data: gradeSubjects, loading: subjectsLoading } = useApi<Subject[]>(
    effectiveGrade !== null ? `/curriculum/subjects?grade=${phaseGrade(effectiveGrade)}` : null,
  );

  function toggleSubject(s: string) {
    setMarks((m) => {
      const next = { ...m };
      if (s in next) delete next[s];
      else next[s] = '';
      return next;
    });
  }

  function canAdvance(): boolean {
    if (step === 0) return effectiveGrade !== null;
    if (step === 1) return syllabus !== null;
    if (step === 2) return selected.length > 0 && selected.every((s) => marks[s] !== '');
    return true;
  }

  async function next() {
    setError(null);
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    if (step === 2) {
      // Submit onboarding, then load recommendations.
      setBusy(true);
      try {
        const result = await apiRequest<OnboardingResult>('/profile/onboarding', {
          method: 'POST',
          token,
          body: {
            grade: effectiveGrade,
            syllabus,
            subjects: selected.map((subjectName) => ({ subjectName, mark: Number(marks[subjectName]) || 0 })),
          },
        });
        setDiagnostics(result.diagnostics ?? []);
        const recommended = await apiRequest<CareerMatch[]>('/careers/recommended', { token });
        setRecs(recommended);
        setStep(3);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save your profile.');
      } finally {
        setBusy(false);
      }
      return;
    }
    router.replace('/(tabs)');
  }

  if (!me) {
    return (
      <SafeAreaView style={styles.safe}>
        <Loading label="Setting up…" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerWrap}>
        <Text style={text.section}>Step {step + 1} of {STEPS.length} · {STEPS[step]}</Text>
        <View style={{ marginTop: 8 }}>
          <ProgressBar value={((step + 1) / STEPS.length) * 100} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {error ? <ErrorText message={error} /> : null}

        {step === 0 && (
          <View>
            <Text style={text.h1}>What grade are you in?</Text>
            <Text style={[text.body, { marginTop: 4, marginBottom: spacing.lg }]}>We tailor everything to your grade.</Text>
            <View style={styles.chipRow}>
              {GRADES.map((g) => (
                <Chip key={g} label={`Grade ${g}`} active={effectiveGrade === g} onPress={() => setGrade(g)} />
              ))}
            </View>
          </View>
        )}

        {step === 1 && (
          <View>
            <Text style={text.h1}>Which syllabus?</Text>
            <Text style={[text.body, { marginTop: 4, marginBottom: spacing.lg }]}>This sets your curriculum and exam style.</Text>
            <View style={{ gap: spacing.md }}>
              {SYLLABI.map((s) => {
                const active = syllabus === s.value;
                return (
                  <Pressable key={s.value} onPress={() => setSyllabus(s.value)} style={({ pressed }) => pressed && { opacity: 0.7 }}>
                    <Card style={active ? { borderColor: colors.navy, borderWidth: 1.5 } : undefined}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View>
                          <Text style={text.title}>{s.label}</Text>
                          <Text style={text.caption}>{s.sub}</Text>
                        </View>
                        {active ? <Check color={colors.navy} /> : null}
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={text.h1}>Your subjects & marks</Text>
            <Text style={[text.body, { marginTop: 4, marginBottom: spacing.lg }]}>
              Tap the subjects you take, then add your latest mark.
            </Text>
            {subjectsLoading ? <Loading label="Loading your subjects…" /> : null}
            {!subjectsLoading && (gradeSubjects?.length ?? 0) === 0 ? (
              <Card><Text style={text.body}>No subjects found for this grade yet.</Text></Card>
            ) : null}
            <View style={{ gap: spacing.sm }}>
              {(gradeSubjects ?? []).map((subj) => {
                const s = subj.name;
                const active = s in marks;
                return (
                  <Card key={subj.id} style={{ paddingVertical: spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Pressable onPress={() => toggleSubject(s)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                        <View style={[styles.tick, active && { backgroundColor: colors.navy, borderColor: colors.navy }]}>
                          {active ? <Check color={colors.white} size={16} /> : null}
                        </View>
                        <Text style={[text.body, { color: colors.ink }]}>{s}</Text>
                      </Pressable>
                      {active ? (
                        <TextInput
                          value={marks[s]}
                          onChangeText={(v) => setMarks((m) => ({ ...m, [s]: v.replace(/[^0-9]/g, '').slice(0, 3) }))}
                          keyboardType="number-pad"
                          placeholder="%"
                          placeholderTextColor={colors.ink300}
                          style={styles.markInput}
                        />
                      ) : null}
                    </View>
                  </Card>
                );
              })}
            </View>
          </View>
        )}

        {step === 3 && (
          <View>
            {diagnostics && diagnostics.length > 0 ? (
              <Card style={{ marginBottom: spacing.lg, borderColor: colors.navy, borderWidth: 1.5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <IconChip tone="navy"><Check color={colors.navy} size={20} /></IconChip>
                  <View style={{ flex: 1 }}>
                    <Text style={text.title}>We set up {diagnostics.length} quick check-in{diagnostics.length > 1 ? 's' : ''}</Text>
                    <Text style={text.caption}>
                      For {diagnostics.map((d) => d.subjectName).join(', ')} — short tests to find exactly where to start. Take them in Study.
                    </Text>
                  </View>
                </View>
              </Card>
            ) : null}
            <Text style={text.h1}>Career paths that fit</Text>
            <Text style={[text.body, { marginTop: 4, marginBottom: spacing.lg }]}>
              Based on your subjects and marks — explore these in the Career tab.
            </Text>
            {!recs || recs.length === 0 ? (
              <Card><Text style={text.body}>We’ll suggest careers as more are added to the database.</Text></Card>
            ) : (
              <View style={{ gap: spacing.md }}>
                {recs.map((c) => (
                  <Card key={c.careerId}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                      <IconChip tone={c.eligible ? 'emerald' : 'warn'}>
                        <Compass color={c.eligible ? colors.emerald : colors.warn} size={20} />
                      </IconChip>
                      <View style={{ flex: 1 }}>
                        <Text style={text.title}>{c.title}</Text>
                        <Text style={text.caption}>{Math.round(c.admissionLikelihood * 100)}% fit · APS {c.computedAps}</Text>
                      </View>
                      <Badge tone={c.eligible ? 'emerald' : 'warn'}>{c.eligible ? 'Eligible' : 'Stretch'}</Badge>
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 && step < 3 ? (
          <View style={{ flex: 1 }}><SecondaryButton label="Back" onPress={() => setStep(step - 1)} /></View>
        ) : null}
        <View style={{ flex: 2 }}>
          <PrimaryButton
            label={busy ? 'Saving…' : step === 2 ? 'See my careers' : step === 3 ? 'Start learning' : 'Continue'}
            onPress={next}
            disabled={busy || !canAdvance()}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  headerWrap: { padding: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.white },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  footer: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white },
  chip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tick: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  markInput: { width: 56, textAlign: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 8, fontSize: 15, color: colors.ink, marginLeft: spacing.md },
});
