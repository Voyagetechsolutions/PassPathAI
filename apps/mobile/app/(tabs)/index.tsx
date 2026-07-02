import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApi } from '../../src/lib/use-api';
import { Screen } from '../../src/components/screen';
import { Card, ScoreRing, ProgressBar, LineChart, Loading, EmptyState, ErrorText } from '../../src/components/ui';
import { Bell, Target, Check, Book, FileText, Timer, Briefcase, GradCap, User, ChevronRight } from '../../src/components/icons';
import { colors, radius, spacing, text } from '../../src/theme';
import type { DashboardView, ProfileSummary, CountdownView, DailyGoal, PredictionPoint } from '../../src/lib/types';

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const PURPLE = '#7C3AED';
const PURPLE_BG = '#EDE9FE';

export default function HomeTab() {
  const router = useRouter();
  const { data, loading, error } = useApi<DashboardView>('/dashboard');
  const { data: me } = useApi<ProfileSummary>('/profile/me');
  const { data: countdown } = useApi<CountdownView>('/countdown');
  const { data: today } = useApi<DailyGoal>('/roadmap/today');
  const { data: predictions } = useApi<PredictionPoint[]>('/dashboard/predictions');

  if (loading) return <Screen><Loading label="Loading your dashboard…" /></Screen>;
  if (error) return <Screen><ErrorText message={error} /></Screen>;
  if (!data) return <Screen><EmptyState title="No data yet" message="Take a diagnostic to begin." /></Screen>;

  const matric = countdown?.matricFinals ?? null;
  const days = matric?.daysRemaining ?? countdown?.nextExam?.daysRemaining ?? null;
  const mission = today?.tasks?.[0];
  const series = (predictions ?? []).map((p) => p.predictedScore);
  const readiness = data.predictedScore;
  const readinessWord = readiness >= 75 ? 'Excellent' : readiness >= 60 ? 'Good' : readiness >= 40 ? 'Getting there' : 'Keep going';

  const actions = [
    { label: 'Continue\nStudying', icon: <Book color={colors.brand} size={22} />, bg: colors.brand50, to: '/study' as const },
    { label: 'Practice\nQuestions', icon: <FileText color={colors.emerald} size={22} />, bg: colors.emerald50, to: '/study' as const },
    { label: 'Mock\nExam', icon: <Timer color={PURPLE} size={22} />, bg: PURPLE_BG, to: '/exams' as const },
    { label: 'Career\nGuidance', icon: <Briefcase color={colors.warn} size={22} />, bg: colors.warn50, to: '/career' as const },
  ];

  return (
    <Screen>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={text.h1}>{greeting()}{me ? `, ${me.firstName}` : ''}</Text>
          <Text style={[text.body, { marginTop: 2 }]}>Keep up the great work!</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 4 }}>
          <Pressable onPress={() => router.push('/profile')} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
            <View>
              <Bell color={colors.ink600} size={24} />
              <View style={{ position: 'absolute', top: -1, right: -1, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brand, borderWidth: 1.5, borderColor: colors.canvas }} />
            </View>
          </Pressable>
          <Pressable onPress={() => router.push('/profile')} style={({ pressed }) => pressed && { opacity: 0.7 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.white, fontSize: 16, fontFamily: 'Poppins_700Bold' }}>{me?.firstName?.[0]?.toUpperCase() ?? <User color={colors.white} size={20} />}</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Final exams countdown hero */}
      <View style={{ backgroundColor: colors.brand, borderRadius: radius.lg, padding: spacing.xl, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontFamily: 'Poppins_600SemiBold' }}>Final Exams Countdown</Text>
            <Text style={{ color: colors.white, fontSize: 52, fontFamily: 'Poppins_700Bold', letterSpacing: -1, marginTop: 4 }}>{days ?? '—'}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontFamily: 'Poppins_500Medium' }}>Days left</Text>
          </View>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <GradCap color={colors.white} size={42} />
          </View>
        </View>
      </View>

      {/* Readiness + Today's mission */}
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' }}>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[text.label, { alignSelf: 'flex-start' }]}>Exam Readiness</Text>
          <View style={{ marginVertical: spacing.md }}>
            <ScoreRing value={readiness} size={120} label={readinessWord} />
          </View>
          <Text style={[text.caption, { textAlign: 'center' }]}>You’re on the right track!</Text>
          <Pressable onPress={() => router.push('/exams')} style={({ pressed }) => [{ marginTop: spacing.sm }, pressed && { opacity: 0.6 }]}>
            <Text style={{ fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: colors.brand }}>View full breakdown ›</Text>
          </Pressable>
        </Card>

        <Card style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm }}>
            <Target color={colors.emerald} size={18} />
            <Text style={text.label}>Today’s Mission</Text>
          </View>
          <Text style={[text.title, { marginBottom: spacing.sm }]} numberOfLines={2}>
            {mission?.title ?? 'You’re all caught up'}
          </Text>
          {mission?.subjectName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md }}>
              <Book color={colors.ink400} size={15} />
              <Text style={text.caption}>{mission.subjectName}</Text>
            </View>
          ) : null}
          {today && today.goalCount > 0 ? (
            <>
              <ProgressBar value={(today.completedCount / today.goalCount) * 100} tone="emerald" />
              <Text style={[text.caption, { marginTop: spacing.sm, marginBottom: spacing.md }]}>{today.completedCount} of {today.goalCount} tasks completed</Text>
            </>
          ) : null}
          <Pressable
            onPress={() => mission?.topicId ? router.push({ pathname: '/learn', params: { topicId: mission.topicId, topic: mission.title, subjectName: mission.subjectName ?? '' } }) : router.push('/study')}
            style={({ pressed }) => [{ backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginTop: 'auto' }, pressed && { opacity: 0.85 }]}
          >
            <Text style={{ color: colors.white, fontSize: 14, fontFamily: 'Poppins_600SemiBold' }}>{today?.allDone ? 'Review' : 'Continue'}</Text>
          </Pressable>
        </Card>
      </View>

      {/* Quick actions */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <Text style={text.section}>Quick Actions</Text>
          <Pressable onPress={() => router.push('/calendar')} style={({ pressed }) => pressed && { opacity: 0.6 }}>
            <Text style={{ fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: colors.brand }}>See all</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {actions.map((a) => (
            <Pressable key={a.label} onPress={() => router.push(a.to)} style={({ pressed }) => [{ alignItems: 'center', width: '23%' }, pressed && { opacity: 0.6 }]}>
              <View style={{ width: 56, height: 56, borderRadius: radius.md, backgroundColor: a.bg, alignItems: 'center', justifyContent: 'center' }}>{a.icon}</View>
              <Text style={{ fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: colors.ink600, textAlign: 'center', marginTop: spacing.sm, lineHeight: 15 }}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Weak topics + recent performance */}
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' }}>
        <Card style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <Text style={[text.section, { fontSize: 15 }]}>Weak Topics</Text>
            <Pressable onPress={() => router.push('/study')} style={({ pressed }) => pressed && { opacity: 0.6 }}>
              <Text style={{ fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: colors.brand }}>See all</Text>
            </Pressable>
          </View>
          {data.weakTopics.length === 0 ? (
            <Text style={text.caption}>Nothing flagged — great work.</Text>
          ) : (
            <View style={{ gap: spacing.md }}>
              {data.weakTopics.slice(0, 4).map((t) => {
                const strength = Math.max(0, 100 - Math.round(t.weaknessScore * 100));
                const tone = strength >= 70 ? 'emerald' : strength >= 55 ? 'warn' : 'danger';
                const dot = strength >= 70 ? colors.emerald : strength >= 55 ? colors.warn : colors.danger;
                return (
                  <View key={t.topicId}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
                      <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Poppins_500Medium', color: colors.ink }} numberOfLines={1}>{t.title}</Text>
                      <Text style={{ fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: colors.ink400 }}>{strength}%</Text>
                    </View>
                    <ProgressBar value={strength} tone={tone} />
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        <Card style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <Text style={[text.section, { fontSize: 15 }]}>Performance</Text>
            <Text style={{ fontSize: 12, fontFamily: 'Poppins_700Bold', color: colors.brand }}>{Math.round(readiness)}%</Text>
          </View>
          <LineChart data={series} height={96} />
          <Text style={[text.caption, { marginTop: spacing.sm }]}>Predicted exam score over time</Text>
        </Card>
      </View>
    </Screen>
  );
}
