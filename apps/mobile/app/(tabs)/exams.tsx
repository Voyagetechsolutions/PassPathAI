import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApi } from '../../src/lib/use-api';
import { useAuth } from '../../src/lib/auth';
import { apiRequest } from '../../src/lib/api';
import { Screen } from '../../src/components/screen';
import { Card, ProgressBar, LineChart, Loading, EmptyState, ErrorText } from '../../src/components/ui';
import { Clock, GradCap, Book, Timer, Target, ChevronRight } from '../../src/components/icons';
import { colors, radius, spacing, text } from '../../src/theme';
import type { CountdownView, ProfileSummary, PastPaper, PredictionPoint, SubjectTree } from '../../src/lib/types';

interface MasteryRow { topicId: string; masteryScore: number; topic: { id: string; title: string; subjectId: string } }
type Tab = 'Overview' | 'Past Papers' | 'Mock Exams' | 'Quizzes';
const TABS: Tab[] = ['Overview', 'Past Papers', 'Mock Exams', 'Quizzes'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function ExamsTab() {
  const router = useRouter();
  const { token } = useAuth();
  const { data: countdown, loading } = useApi<CountdownView>('/countdown');
  const { data: me } = useApi<ProfileSummary>('/profile/me');
  const { data: papers } = useApi<PastPaper[]>('/past-papers?mine=true');
  const { data: mastery } = useApi<MasteryRow[]>('/weakness/mastery');
  const { data: predictions } = useApi<PredictionPoint[]>('/dashboard/predictions');

  const [tab, setTab] = useState<Tab>('Overview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [premiumBlocked, setPremiumBlocked] = useState(false);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [tree, setTree] = useState<SubjectTree | null>(null);

  const subjects = me?.subjects ?? [];
  const selected = subjects.find((s) => s.id === subjectId) ?? subjects[0];
  const series = (predictions ?? []).map((p) => p.predictedScore);

  useEffect(() => { if (subjects.length > 0 && !subjects.some((s) => s.id === subjectId)) setSubjectId(subjects[0].id); }, [subjects, subjectId]);

  // Load the selected subject's topics (for quizzes).
  useEffect(() => {
    if (!selected) { setTree(null); return; }
    apiRequest<SubjectTree>(`/curriculum/subjects/${selected.id}`, { token }).then(setTree).catch(() => setTree(null));
  }, [selected?.id, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const masteryByTopic = useMemo(() => new Map((mastery ?? []).map((m) => [m.topicId, m.masteryScore])), [mastery]);
  const subjectPapers = useMemo(() => (papers ?? []).filter((p) => p.subject?.id === selected?.id), [papers, selected]);
  const next = countdown?.nextExam ?? null;
  const matric = countdown?.matricFinals ?? null;

  async function generateMock() {
    if (!selected) { setError('Pick a subject first.'); return; }
    setBusy(true); setError(null); setPremiumBlocked(false);
    try {
      const paper = await apiRequest<{ id: string }>('/exams/generate', { method: 'POST', token, body: { subjectId: selected.id, questionCount: 12, durationMins: 60, isMock: true } });
      router.push({ pathname: '/exam-paper', params: { paperId: paper.id, title: `${selected.name} mock exam` } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Not enough questions yet for a mock in this subject.';
      setError(msg);
      setPremiumBlocked(/premium/i.test(msg));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Screen><Loading label="Loading exam centre…" /></Screen>;

  return (
    <Screen>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={text.h1}>Exams</Text>
          <Text style={[text.body, { marginTop: 2 }]}>Practice, test and improve</Text>
        </View>
        <Pressable onPress={() => router.push('/calendar')} hitSlop={8} style={({ pressed }) => [{ marginTop: 6 }, pressed && { opacity: 0.6 }]}>
          <Clock color={colors.ink600} size={24} />
        </Pressable>
      </View>

      {/* Subject selector — scopes everything below */}
      {subjects.length === 0 ? (
        <EmptyState title="No subjects yet" message="Finish onboarding to add your subjects." />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {subjects.map((s) => {
            const active = s.id === (selected?.id ?? '');
            return (
              <Pressable key={s.id} onPress={() => setSubjectId(s.id)} style={{ paddingHorizontal: spacing.lg, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: active ? colors.navy : colors.white, borderWidth: 1, borderColor: active ? colors.navy : colors.line }}>
                <Text style={{ fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: active ? colors.white : colors.ink600 }}>{s.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: colors.navy50, borderRadius: radius.md, padding: 4 }}>
        {TABS.map((t) => {
          const active = t === tab;
          return (
            <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, paddingVertical: 9, borderRadius: radius.sm, backgroundColor: active ? colors.brand : 'transparent', alignItems: 'center' }}>
              <Text style={{ fontSize: 11.5, fontFamily: 'Poppins_600SemiBold', color: active ? colors.white : colors.ink600 }}>{t}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Countdown + mini calendar */}
      {tab === 'Overview' ? (
        <Card>
          <Text style={[text.section, { marginBottom: spacing.md }]}>Exam Countdown</Text>
          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
                <GradCap color={colors.brand} size={28} />
              </View>
              <Text style={text.caption}>{matric ? `Final Exams ${matric.year}` : next?.title ?? 'Next exam'}</Text>
              <Text style={{ fontSize: 40, fontFamily: 'Poppins_700Bold', color: colors.ink, letterSpacing: -1 }}>{matric?.daysRemaining ?? next?.daysRemaining ?? '—'}</Text>
              <Text style={text.caption}>Days left</Text>
            </View>
            <View style={{ flex: 1.1 }}><MiniCalendar /></View>
          </View>
        </Card>
      ) : null}

      {/* Past papers — for the selected subject */}
      {tab === 'Overview' || tab === 'Past Papers' ? (
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <Text style={text.section}>Past Papers · {selected?.name ?? ''}</Text>
            <Pressable onPress={() => router.push('/past-papers')} style={({ pressed }) => pressed && { opacity: 0.6 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: colors.brand }}>View all</Text>
            </Pressable>
          </View>
          {subjectPapers.length === 0 ? (
            <EmptyState title="No papers yet" message={`Past papers for ${selected?.name ?? 'this subject'} will appear here.`} />
          ) : (
            <View style={{ gap: spacing.md }}>
              {(tab === 'Overview' ? subjectPapers.slice(0, 4) : subjectPapers).map((p) => (
                <Pressable key={p.id} onPress={() => router.push('/past-papers')} style={({ pressed }) => pressed && { opacity: 0.7 }}>
                  <Card>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                      <View style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.navy50, alignItems: 'center', justifyContent: 'center' }}><Book color={colors.navy} size={20} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={[text.body, { color: colors.ink, fontFamily: 'Poppins_600SemiBold' }]} numberOfLines={1}>{p.title}</Text>
                        <Text style={text.caption}>{p.year} · {p.kind.replace(/_/g, ' ').toLowerCase()}</Text>
                      </View>
                      <ChevronRight color={colors.ink300} size={18} />
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {/* Mock exam — built from this subject's questions (topics + past papers) */}
      {tab === 'Overview' || tab === 'Mock Exams' ? (
        <View>
          <Text style={[text.section, { marginBottom: spacing.md }]}>Mock Exam · {selected?.name ?? ''}</Text>
          <Card>
            <Text style={[text.caption, { marginBottom: spacing.md }]}>
              A timed paper built from {selected?.name ?? 'this subject'}’s topics and past-paper questions — multiple-choice, short-answer and exam-style, AI-marked.
            </Text>
            {error ? <ErrorText message={error} /> : null}
            {premiumBlocked ? (
              <Pressable onPress={() => router.push('/premium')} style={{ backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }}>
                <Timer color={colors.white} size={18} />
                <Text style={{ color: colors.white, fontSize: 15, fontFamily: 'Poppins_600SemiBold' }}>Unlock Premium</Text>
              </Pressable>
            ) : (
              <Pressable onPress={generateMock} disabled={busy || !selected} style={({ pressed }) => [{ backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }, (pressed || busy) && { opacity: 0.85 }]}>
                <Timer color={colors.white} size={18} />
                <Text style={{ color: colors.white, fontSize: 15, fontFamily: 'Poppins_600SemiBold' }}>{busy ? 'Building…' : `Generate ${selected?.name ?? ''} mock`}</Text>
              </Pressable>
            )}
          </Card>
        </View>
      ) : null}

      {/* Quizzes — the selected subject's topics */}
      {tab === 'Overview' || tab === 'Quizzes' ? (
        <View>
          <Text style={[text.section, { marginBottom: spacing.md }]}>Quizzes · {selected?.name ?? ''}</Text>
          {!tree || tree.topics.length === 0 ? (
            <EmptyState title="No topics yet" message={`Topics for ${selected?.name ?? 'this subject'} are being added.`} />
          ) : (
            <View style={{ backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
              {(tab === 'Overview' ? tree.topics.slice(0, 5) : tree.topics).map((t, i) => {
                const pct = Math.round((masteryByTopic.get(t.id) ?? 0) * 100);
                const tone = pct >= 70 ? colors.emerald : pct >= 45 ? colors.warn : pct > 0 ? colors.danger : colors.ink400;
                const toneBg = pct >= 70 ? colors.emerald50 : pct >= 45 ? colors.warn50 : pct > 0 ? colors.danger50 : colors.navy50;
                return (
                  <Pressable key={t.id} onPress={() => router.push({ pathname: '/practice', params: { topicId: t.id, topic: t.title, subjectName: selected?.name ?? '' } })} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.line }, pressed && { opacity: 0.6 }]}>
                    <View style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: toneBg, alignItems: 'center', justifyContent: 'center' }}><Target color={tone} size={20} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={[text.body, { color: colors.ink, fontFamily: 'Poppins_600SemiBold' }]} numberOfLines={1}>{t.title}</Text>
                      <Text style={text.caption}>{pct > 0 ? 'Adaptive practice' : 'Not started'}</Text>
                    </View>
                    <View style={{ backgroundColor: toneBg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'Poppins_700Bold', color: tone }}>{pct}%</Text>
                    </View>
                    <ChevronRight color={colors.ink300} size={18} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      ) : null}

      {/* Performance */}
      {tab === 'Overview' ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <Text style={text.section}>Exam Performance</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Poppins_700Bold', color: colors.brand }}>{series.length ? `${Math.round(series[series.length - 1])}%` : '—'}</Text>
          </View>
          <LineChart data={series} height={110} />
          <Text style={[text.caption, { marginTop: spacing.sm }]}>Predicted exam score over time</Text>
        </Card>
      ) : null}
    </Screen>
  );
}

function MiniCalendar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const first = new Date(year, month, 1).getDay();
  const lead = (first + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  return (
    <View>
      <Text style={{ fontSize: 13, fontFamily: 'Poppins_700Bold', color: colors.ink, textAlign: 'center', marginBottom: 6 }}>{MONTHS[month]} {year}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => (
          <Text key={i} style={{ width: `${100 / 7}%`, textAlign: 'center', fontSize: 9, fontFamily: 'Poppins_600SemiBold', color: colors.ink300, marginBottom: 2 }}>{w}</Text>
        ))}
        {cells.map((d, i) => (
          <View key={i} style={{ width: `${100 / 7}%`, height: 22, alignItems: 'center', justifyContent: 'center' }}>
            {d !== null ? (
              <View style={{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: d === today ? colors.brand : 'transparent' }}>
                <Text style={{ fontSize: 10, fontFamily: d === today ? 'Poppins_700Bold' : 'Poppins_400Regular', color: d === today ? colors.white : colors.ink600 }}>{d}</Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}
