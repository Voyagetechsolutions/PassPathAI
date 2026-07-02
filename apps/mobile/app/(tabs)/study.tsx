import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { apiRequest } from '../../src/lib/api';
import { useApi } from '../../src/lib/use-api';
import { Screen } from '../../src/components/screen';
import { Card, ScoreRing, ProgressBar, Loading, EmptyState, ErrorText } from '../../src/components/ui';
import { Calculator, Flask, Leaf, Briefcase, BarChart, Book, Compass, Bulb, Target, ChevronRight } from '../../src/components/icons';
import { colors, radius, spacing, text } from '../../src/theme';
import type { ProfileSummary, SubjectTree } from '../../src/lib/types';

interface MasteryRow { topicId: string; masteryScore: number; topic: { id: string; title: string; subjectId: string } }

function subjectIcon(name: string, color: string, size = 24) {
  const n = name.toLowerCase();
  if (n.includes('physical')) return <Flask color={color} size={size} />;
  if (n.includes('life')) return <Leaf color={color} size={size} />;
  if (n.includes('account')) return <Briefcase color={color} size={size} />;
  if (n.includes('business') || n.includes('economic')) return <BarChart color={color} size={size} />;
  if (n.includes('geog')) return <Compass color={color} size={size} />;
  if (n.includes('math')) return <Calculator color={color} size={size} />;
  return <Book color={color} size={size} />;
}

const TOPIC_TONES = [colors.brand, colors.emerald, colors.warn, colors.danger, colors.navy];
const TOPIC_BGS = [colors.brand50, colors.emerald50, colors.warn50, colors.danger50, colors.navy50];

export default function StudyTab() {
  const router = useRouter();
  const { token } = useAuth();
  const { data: me, loading, error } = useApi<ProfileSummary>('/profile/me');
  const { data: mastery } = useApi<MasteryRow[]>('/weakness/mastery');

  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [tree, setTree] = useState<SubjectTree | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);

  const subjects = me?.subjects ?? [];

  useEffect(() => {
    if (subjects.length > 0 && !subjects.some((s) => s.id === subjectId)) setSubjectId(subjects[0].id);
  }, [subjects, subjectId]);

  useEffect(() => {
    if (!subjectId) { setTree(null); return; }
    setTreeLoading(true);
    apiRequest<SubjectTree>(`/curriculum/subjects/${subjectId}`, { token })
      .then(setTree)
      .catch(() => setTree(null))
      .finally(() => setTreeLoading(false));
  }, [subjectId, token]);

  const masteryByTopic = useMemo(() => new Map((mastery ?? []).map((m) => [m.topicId, m.masteryScore])), [mastery]);
  const selectedSubject = subjects.find((s) => s.id === subjectId);
  const topics = tree?.topics ?? [];
  const continueTopic = useMemo(() => {
    if (topics.length === 0) return null;
    return [...topics].sort((a, b) => (masteryByTopic.get(a.id) ?? 0) - (masteryByTopic.get(b.id) ?? 0))[0];
  }, [topics, masteryByTopic]);

  if (loading) return <Screen><Loading label="Loading your study hub…" /></Screen>;
  if (error) return <Screen><ErrorText message={error} /></Screen>;

  function openTopic(topicId: string, title: string) {
    router.push({ pathname: '/learn', params: { topicId, subjectId: subjectId ?? '', topic: title, subjectName: selectedSubject?.name ?? '' } });
  }

  return (
    <Screen>
      {/* Header */}
      <View>
        <Text style={text.h1}>Study</Text>
        <Text style={[text.body, { marginTop: 2 }]}>Your personalised study hub</Text>
      </View>

      {/* Ask the tutor — the AI entry, front and centre */}
      <Pressable onPress={() => router.push('/tutor')} style={({ pressed }) => pressed && { opacity: 0.9 }}>
        <View style={{ backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
            <Bulb color={colors.white} size={24} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.white, fontSize: 17, fontFamily: 'Poppins_600SemiBold' }}>Ask the tutor</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>Stuck on anything? Get a clear, CAPS-aligned answer.</Text>
          </View>
          <ChevronRight color="rgba(255,255,255,0.7)" />
        </View>
      </Pressable>

      {/* My subjects */}
      {subjects.length === 0 ? (
        <EmptyState title="No subjects yet" message="Finish onboarding to add your subjects." />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.lg, paddingVertical: 2 }}>
          {subjects.map((s) => {
            const active = s.id === subjectId;
            return (
              <Pressable key={s.id} onPress={() => setSubjectId(s.id)} style={{ alignItems: 'center', width: 64 }}>
                <View style={{ width: 56, height: 56, borderRadius: radius.md, backgroundColor: active ? colors.brand : colors.navy50, alignItems: 'center', justifyContent: 'center' }}>
                  {subjectIcon(s.name, active ? colors.white : colors.ink600)}
                </View>
                <Text numberOfLines={2} style={{ fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: active ? colors.brand : colors.ink600, textAlign: 'center', marginTop: 6, lineHeight: 14 }}>{s.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Continue studying */}
      {continueTopic ? (
        <Card>
          <Text style={[text.section, { marginBottom: spacing.md }]}>Continue Studying</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
            <ScoreRing value={Math.round((masteryByTopic.get(continueTopic.id) ?? 0) * 100)} size={84} />
            <View style={{ flex: 1 }}>
              <Text style={text.title} numberOfLines={1}>{continueTopic.title}</Text>
              <Text style={text.caption}>{selectedSubject?.name}</Text>
            </View>
            <Pressable onPress={() => openTopic(continueTopic.id, continueTopic.title)} style={({ pressed }) => [{ backgroundColor: colors.brand, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 11 }, pressed && { opacity: 0.85 }]}>
              <Text style={{ color: colors.white, fontSize: 14, fontFamily: 'Poppins_600SemiBold' }}>Continue</Text>
            </Pressable>
          </View>
        </Card>
      ) : null}

      {/* Topics */}
      <View>
        <Text style={[text.section, { marginBottom: spacing.md }]}>Topics{selectedSubject ? ` · ${selectedSubject.name}` : ''}</Text>
        {treeLoading ? (
          <Loading label="Loading topics…" />
        ) : topics.length === 0 ? (
          <EmptyState title="No topics yet" message="This subject’s topics are being added." />
        ) : (
          <View style={{ gap: spacing.md }}>
            {topics.map((t, i) => {
              const pct = Math.round((masteryByTopic.get(t.id) ?? 0) * 100);
              const tone = pct >= 60 ? 'emerald' : pct >= 33 ? 'warn' : pct > 0 ? 'danger' : 'brand';
              return (
                <Pressable key={t.id} onPress={() => openTopic(t.id, t.title)} style={({ pressed }) => [{ backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, pressed && { opacity: 0.7 }]}>
                  <View style={{ width: 44, height: 44, borderRadius: radius.sm, backgroundColor: TOPIC_BGS[i % TOPIC_BGS.length], alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 16, fontFamily: 'Poppins_700Bold', color: TOPIC_TONES[i % TOPIC_TONES.length] }}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[text.body, { color: colors.ink, fontFamily: 'Poppins_600SemiBold' }]} numberOfLines={1}>{t.title}</Text>
                    <View style={{ marginTop: 6 }}><ProgressBar value={pct} tone={tone} /></View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Poppins_700Bold', color: colors.ink }}>{pct}%</Text>
                    <ChevronRight color={colors.ink300} size={18} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Recommended */}
      {continueTopic ? (
        <View>
          <Text style={[text.section, { marginBottom: spacing.md }]}>Recommended for You</Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Pressable onPress={() => openTopic(continueTopic.id, continueTopic.title)} style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.8 }]}>
              <View style={{ backgroundColor: colors.emerald50, borderRadius: radius.md, padding: spacing.md, minHeight: 120, justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11, fontFamily: 'Poppins_700Bold', color: colors.emerald }}>WEAK AREA</Text>
                <Text style={{ fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: colors.ink, marginTop: 6 }} numberOfLines={2}>{continueTopic.title} revision</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
                  <Bulb color={colors.emerald} size={16} />
                  <Text style={text.caption}>Learn with your tutor</Text>
                </View>
              </View>
            </Pressable>
            <Pressable onPress={() => router.push({ pathname: '/practice', params: { topicId: continueTopic.id, topic: continueTopic.title, subjectName: selectedSubject?.name ?? '' } })} style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.8 }]}>
              <View style={{ backgroundColor: '#EDE9FE', borderRadius: radius.md, padding: spacing.md, minHeight: 120, justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11, fontFamily: 'Poppins_700Bold', color: '#7C3AED' }}>PRACTICE</Text>
                <Text style={{ fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: colors.ink, marginTop: 6 }} numberOfLines={2}>{selectedSubject?.name} mixed questions</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
                  <Target color={'#7C3AED'} size={16} />
                  <Text style={text.caption}>Adaptive to you</Text>
                </View>
              </View>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
