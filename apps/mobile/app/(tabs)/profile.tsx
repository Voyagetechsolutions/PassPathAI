import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
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
  PrimaryButton,
  Loading,
} from '../../src/components/ui';
import { User, Flame, TrendUp, Logout, Bulb, ChevronRight } from '../../src/components/icons';
import { colors, spacing, text } from '../../src/theme';
import type { ProfileSummary, DashboardView, SubscriptionStatus } from '../../src/lib/types';

export default function ProfileTab() {
  const router = useRouter();
  const { profile, logout } = useAuth();
  const { data: me, loading } = useApi<ProfileSummary>('/profile/me');
  const { data: dash } = useApi<DashboardView>('/dashboard');
  const { data: subscription } = useApi<SubscriptionStatus>('/subscription/me');
  const [reminderOn, setReminderOn] = useState(false);

  useEffect(() => {
    isReminderEnabled().then(setReminderOn);
  }, []);

  async function toggleReminder(next: boolean) {
    setReminderOn(await setReminderEnabled(next));
  }

  if (loading) return <Screen><Loading /></Screen>;

  const initials = me ? `${me.firstName[0] ?? ''}${me.surname[0] ?? ''}` : '··';

  return (
    <Screen title="Profile">
      {/* Identity */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <View style={styles_avatar}>
            <Text style={{ color: colors.white, fontFamily: 'Poppins_700Bold', fontSize: 20 }}>{initials.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={text.h2}>{me ? `${me.firstName} ${me.surname}` : profile?.email}</Text>
            <Text style={text.caption}>
              {me ? `Grade ${me.grade}${me.school ? ` · ${me.school}` : ''}` : profile?.role}
            </Text>
          </View>
        </View>
      </Card>

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
                : `Unlimited AI tutoring & mock exams — ${subscription?.priceLabel ?? 'R200/month'}`}
            </Text>
          </View>
          <ChevronRight color="rgba(255,255,255,0.7)" />
        </View>
      </Pressable>

      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: spacing.lg }}>
        <StatCard
          label="Streak"
          value={`${dash?.streak.currentStreak ?? 0} days`}
          icon={<IconChip tone="emerald"><Flame color={colors.emerald} size={20} /></IconChip>}
        />
        <StatCard
          label="Mastery"
          value={`${dash?.masteryScore ?? 0}%`}
          icon={<IconChip tone="brand"><TrendUp color={colors.brand} size={20} /></IconChip>}
        />
      </View>

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
              <TrendUp color={colors.white} size={20} />
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
              <Text style={[text.body, { color: colors.ink }]}>Daily study reminder</Text>
              <Text style={text.caption}>A nudge at 4pm to do today’s topics and keep your streak.</Text>
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
            <Text style={text.body}>Syllabus</Text>
            <Text style={[text.body, { color: colors.ink }]}>{me?.syllabus ?? '—'}</Text>
          </View>
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
            <Text style={text.body}>Role</Text>
            <Text style={[text.body, { color: colors.ink, textTransform: 'capitalize' }]}>{profile?.role}</Text>
          </View>
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
  backgroundColor: colors.navy,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
