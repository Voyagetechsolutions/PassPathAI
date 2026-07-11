import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApi } from '../../src/lib/use-api';
import { useAuth } from '../../src/lib/auth';
import { isReminderEnabled, setReminderEnabled } from '../../src/lib/notifications';
import { Screen } from '../../src/components/screen';
import {
  Card,
  IconChip,
  SectionHeader,
  Badge,
  StatCard,
  ProgressBar,
  PrimaryButton,
  SkeletonCard,
} from '../../src/components/ui';
import { Flame, TrendUp, Logout, Bulb, GradCap, Target, ChevronRight } from '../../src/components/icons';
import { careerEmoji } from '../../src/lib/careers';
import { colors, radius, spacing, text } from '../../src/theme';
import type { ProfileSummary, DashboardView, SubscriptionStatus, CareerMatch } from '../../src/lib/types';

interface MasteryRow { topicId: string; masteryScore: number; topic: { id: string; title: string; subjectId: string } }

const SITE = 'https://www.passpathai.com';

export default function ProfileTab() {
  const router = useRouter();
  const { profile, logout } = useAuth();
  const { data: me, loading } = useApi<ProfileSummary>('/profile/me');
  const { data: dash } = useApi<DashboardView>('/dashboard');
  const { data: subscription } = useApi<SubscriptionStatus>('/subscription/me');
  const { data: careers } = useApi<CareerMatch[]>('/careers/recommended');
  const { data: mastery } = useApi<MasteryRow[]>('/weakness/mastery');
  const [reminderOn, setReminderOn] = useState(false);

  useEffect(() => {
    isReminderEnabled().then(setReminderOn);
  }, []);

  async function toggleReminder(next: boolean) {
    setReminderOn(await setReminderEnabled(next));
  }

  const topCareer = careers?.[0] ?? null;

  // Average mastery per subject the learner is taking.
  const subjectMastery = useMemo(() => {
    if (!me || !mastery) return [];
    return me.subjects
      .map((s) => {
        const rows = mastery.filter((m) => m.topic.subjectId === s.id);
        const avg = rows.length ? rows.reduce((sum, r) => sum + r.masteryScore, 0) / rows.length : 0;
        return { name: s.name, pct: Math.round(avg * 100), touched: rows.length };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [me, mastery]);

  const touchedTopics = mastery?.length ?? 0;
  const masteredTopics = (mastery ?? []).filter((m) => m.masteryScore >= 0.7).length;
  const streak = dash?.streak.currentStreak ?? 0;
  const longest = dash?.streak.longestStreak ?? 0;

  const achievements = [
    { emoji: '🚀', label: 'Journey started', done: Boolean(me?.onboarded) },
    { emoji: '🔥', label: '3-day streak', done: longest >= 3 },
    { emoji: '🧠', label: 'Topic mastered', done: masteredTopics >= 1 },
    { emoji: '🗺️', label: '5 topics explored', done: touchedTopics >= 5 },
    { emoji: '🎯', label: 'Exam ready (60%+)', done: (dash?.masteryScore ?? 0) >= 60 },
    { emoji: '⭐', label: 'Premium supporter', done: Boolean(subscription?.isPremium) },
  ];

  if (loading)
    return (
      <Screen title="Profile">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </Screen>
    );

  const initials = me ? `${me.firstName[0] ?? ''}${me.surname[0] ?? ''}` : '··';

  return (
    <Screen title="Profile">
      {/* Identity hero */}
      <Card style={{ backgroundColor: colors.navy }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <View style={styles_avatar}>
            <Text style={{ color: colors.navy, fontFamily: 'Poppins_700Bold', fontSize: 20 }}>{initials.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.white, fontSize: 19, fontFamily: 'Poppins_700Bold' }}>
              {me ? `${me.firstName} ${me.surname}` : profile?.email}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
              {me ? `Grade ${me.grade}${me.school ? ` · ${me.school}` : ''}` : profile?.role}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
          <View style={styles_chip}>
            <Text style={{ color: colors.white, fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' }}>🔥 {streak}-day streak</Text>
          </View>
          <View style={[styles_chip, subscription?.isPremium && { backgroundColor: colors.brand }]}>
            <Text style={{ color: colors.white, fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' }}>
              {subscription?.isPremium ? '⭐ Premium' : 'Free plan'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Future me */}
      {topCareer ? (
        <Pressable
          onPress={() => router.push({ pathname: '/career-detail', params: { careerId: topCareer.careerId } })}
          style={({ pressed }) => pressed && { opacity: 0.9 }}
        >
          <Card style={{ borderColor: colors.brand, borderWidth: 1.5 }}>
            <Text style={[text.label, { color: colors.brand }]}>FUTURE YOU</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
              <Text style={{ fontSize: 34 }}>{careerEmoji(topCareer.title, topCareer.faculty)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={text.title}>{topCareer.title}</Text>
                <Text style={text.caption}>
                  {Math.round(topCareer.admissionLikelihood * 100)}% match · APS {topCareer.computedAps}
                </Text>
              </View>
              <ChevronRight color={colors.ink300} />
            </View>
            <Text style={[text.caption, { marginTop: spacing.sm }]}>
              Every topic you master this week moves you closer. See what stands between you and this.
            </Text>
          </Card>
        </Pressable>
      ) : null}

      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <StatCard
          label="Streak"
          value={`${streak}d`}
          icon={<IconChip tone="emerald"><Flame color={colors.emerald} size={20} /></IconChip>}
        />
        <StatCard
          label="Mastered"
          value={`${masteredTopics}`}
          icon={<IconChip tone="brand"><Target color={colors.brand} size={20} /></IconChip>}
        />
        <StatCard
          label="Readiness"
          value={`${dash?.masteryScore ?? 0}%`}
          icon={<IconChip tone="navy"><TrendUp color={colors.navy} size={20} /></IconChip>}
        />
      </View>

      {/* Achievements */}
      <View>
        <SectionHeader title="Achievements" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {achievements.map((a) => (
            <View
              key={a.label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: a.done ? colors.brand50 : colors.white,
                borderWidth: 1,
                borderColor: a.done ? colors.brand : colors.line,
                borderRadius: radius.pill,
                paddingHorizontal: 12,
                paddingVertical: 8,
                opacity: a.done ? 1 : 0.55,
              }}
            >
              <Text style={{ fontSize: 14 }}>{a.emoji}</Text>
              <Text style={{ fontSize: 12.5, fontFamily: 'Poppins_600SemiBold', color: a.done ? colors.brand : colors.ink400 }}>
                {a.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Study analytics */}
      {subjectMastery.length > 0 ? (
        <View>
          <SectionHeader title="Subject mastery" />
          <Card style={{ gap: spacing.md }}>
            {subjectMastery.map((s) => (
              <View key={s.name}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={[text.body, { color: colors.ink, fontFamily: 'Poppins_500Medium' }]} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Poppins_700Bold', color: colors.ink }}>{s.pct}%</Text>
                </View>
                <ProgressBar value={s.pct} tone={s.pct >= 60 ? 'emerald' : s.pct >= 33 ? 'warn' : s.pct > 0 ? 'danger' : 'brand'} />
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {/* Subscription */}
      <Pressable onPress={() => router.push('/premium')} style={({ pressed }) => pressed && { opacity: 0.85 }}>
        <View style={{ backgroundColor: subscription?.isPremium ? colors.navy : colors.brand, borderRadius: 14, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
            <Bulb color={colors.white} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.white, fontSize: 16, fontFamily: 'Poppins_600SemiBold' }}>
              {subscription?.isPremium ? 'PassPath Premium' : 'Upgrade to Premium'}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
              {subscription?.isPremium
                ? subscription.cancelAtPeriodEnd ? 'Cancels at the end of this period' : 'Unlimited tutor, mock exams & more'
                : `Unlimited AI tutoring & mock exams — ${subscription?.priceLabel ?? 'R99/month'}`}
            </Text>
          </View>
          <ChevronRight color="rgba(255,255,255,0.7)" />
        </View>
      </Pressable>

      {/* Subjects & marks */}
      <View>
        <SectionHeader title="Subjects & marks" />
        <Card>
          {me && me.marks.length > 0 ? (
            me.marks.map((m, i) => (
              <View
                key={m.subjectName}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: spacing.sm,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.line,
                }}
              >
                <Text style={[text.body, { color: colors.ink }]}>{m.subjectName}</Text>
                <Badge tone={m.mark >= 60 ? 'emerald' : m.mark >= 40 ? 'warn' : 'danger'}>{m.mark}%</Badge>
              </View>
            ))
          ) : (
            <Text style={text.caption}>No subjects yet — complete onboarding to add them.</Text>
          )}
        </Card>
      </View>

      {/* Founder dashboard (admins only) */}
      {profile?.role === 'admin' ? (
        <Pressable onPress={() => router.push('/admin-stats')} style={({ pressed }) => pressed && { opacity: 0.85 }}>
          <View style={{ backgroundColor: colors.navy, borderRadius: 14, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <GradCap color={colors.white} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.white, fontSize: 16, fontFamily: 'Poppins_600SemiBold' }}>Founder dashboard</Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>Retention, outcomes and content stats.</Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18 }}>›</Text>
          </View>
        </Pressable>
      ) : null}

      {/* Reminders */}
      <View>
        <SectionHeader title="Reminders" />
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm }}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Text style={[text.body, { color: colors.ink }]}>Study & exam reminders</Text>
              <Text style={text.caption}>A daily 4pm nudge, plus a heads-up one week and one day before each exam on your calendar.</Text>
            </View>
            <Switch value={reminderOn} onValueChange={toggleReminder} trackColor={{ true: colors.navy, false: colors.line }} />
          </View>
        </Card>
      </View>

      {/* Account */}
      <View>
        <SectionHeader title="Account" />
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
            <Text style={text.body}>Email</Text>
            <Text style={[text.body, { color: colors.ink }]}>{profile?.email}</Text>
          </View>
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
            <Text style={text.body}>Grade</Text>
            <Text style={[text.body, { color: colors.ink }]}>{me ? `Grade ${me.grade}` : '—'}</Text>
          </View>
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <Pressable onPress={() => void Linking.openURL(`${SITE}/privacy.html`)} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
            <Text style={text.body}>Privacy policy</Text>
            <ChevronRight color={colors.ink300} size={18} />
          </Pressable>
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <Pressable onPress={() => void Linking.openURL(`${SITE}/delete-account.html`)} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
            <Text style={[text.body, { color: colors.danger }]}>Delete my account</Text>
            <ChevronRight color={colors.ink300} size={18} />
          </Pressable>
        </Card>
      </View>

      <PrimaryButton label="Sign out" onPress={() => void logout()} icon={<Logout color={colors.white} size={18} />} />
    </Screen>
  );
}

const styles_avatar = {
  width: 56,
  height: 56,
  borderRadius: 28,
  backgroundColor: colors.white,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const styles_chip = {
  backgroundColor: 'rgba(255,255,255,0.14)',
  borderRadius: 999,
  paddingHorizontal: 12,
  paddingVertical: 6,
};
