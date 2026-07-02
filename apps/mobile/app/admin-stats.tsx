import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApi } from '../src/lib/use-api';
import { Screen } from '../src/components/screen';
import { Card, StatCard, IconChip, SectionHeader, Loading, ErrorText } from '../src/components/ui';
import { Flame, TrendUp, User, Book } from '../src/components/icons';
import { colors, spacing, text } from '../src/theme';
import type { AdminStats } from '../src/lib/types';

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
      <Text style={text.body}>{label}</Text>
      <Text style={[text.body, { color: colors.ink, fontFamily: 'Poppins_600SemiBold' }]}>{value}</Text>
    </View>
  );
}

export default function AdminStatsScreen() {
  const router = useRouter();
  const { data, loading, error } = useApi<AdminStats>('/admin/stats');

  return (
    <Screen title="Founder dashboard" subtitle="Is it working? The numbers that matter." onBack={() => router.back()}>
      {loading ? <Loading label="Crunching the numbers…" /> : null}
      {error ? <ErrorText message={error} /> : null}

      {data ? (
        <View style={{ gap: spacing.lg }}>
          {/* Retention — the headline */}
          <SectionHeader title="Retention" />
          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            <StatCard
              label="Active today"
              value={`${data.engagement.activeToday}`}
              hint={`${data.engagement.activeThisWeek} this week`}
              icon={<IconChip tone="emerald"><Flame color={colors.emerald} size={20} /></IconChip>}
            />
            <StatCard
              label="Avg streak"
              value={`${data.engagement.avgStreak}d`}
              hint={`Longest ${data.engagement.longestStreak}d`}
              icon={<IconChip tone="warn"><Flame color={colors.warn} size={20} /></IconChip>}
            />
          </View>

          {/* Learning outcomes */}
          <SectionHeader title="Learning" />
          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            <StatCard
              label="Avg quiz score"
              value={`${data.engagement.avgDiagnosticScore}%`}
              hint={`${data.engagement.diagnosticAttempts} attempts`}
              icon={<IconChip tone="brand"><TrendUp color={colors.brand} size={20} /></IconChip>}
            />
            <StatCard
              label="AI questions"
              value={`${data.engagement.aiQueries}`}
              hint="tutor + lessons"
              icon={<IconChip tone="navy"><Book color={colors.navy} size={20} /></IconChip>}
            />
          </View>

          {/* Users funnel */}
          <View>
            <SectionHeader title="Users" />
            <Card>
              <Row label="Total accounts" value={data.users.total} />
              <View style={{ height: 1, backgroundColor: colors.line }} />
              <Row label="Students" value={data.users.students} />
              <View style={{ height: 1, backgroundColor: colors.line }} />
              <Row label="Onboarded" value={`${data.users.onboarded} / ${data.users.students}`} />
              <View style={{ height: 1, backgroundColor: colors.line }} />
              <Row label="Parents" value={data.users.parents} />
            </Card>
          </View>

          {/* Content library */}
          <View>
            <SectionHeader title="Content library" />
            <Card>
              <Row label="Subjects" value={data.content.subjects} />
              <View style={{ height: 1, backgroundColor: colors.line }} />
              <Row label="Lessons" value={data.content.lessons} />
              <View style={{ height: 1, backgroundColor: colors.line }} />
              <Row label="Questions" value={data.content.questions} />
              <View style={{ height: 1, backgroundColor: colors.line }} />
              <Row label="Careers" value={data.content.careers} />
            </Card>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
