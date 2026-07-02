'use client';

import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/lib/use-api';
import { apiRequest } from '@/lib/api';
import { useState } from 'react';
import {
  Card,
  SectionTitle,
  ScoreRing,
  ProgressBar,
  Badge,
  Button,
  Spinner,
  PageState,
  ErrorState,
  EmptyState,
} from '@/components/ui';
import { IconFlame, IconClock, IconTarget, IconCheck, IconTrendUp } from '@/components/icons';
import type { DashboardView, ProfileSummary, CountdownView, TodayMission } from '@/lib/types';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function StudentDashboard() {
  const { profile, token, loading: authLoading } = useAuth();
  const isStudent = profile?.role === 'student';
  const { data, loading, error } = useApi<DashboardView>(isStudent ? '/dashboard' : null);
  const { data: me } = useApi<ProfileSummary>(isStudent ? '/profile/me' : null);
  const { data: countdown } = useApi<CountdownView>(isStudent ? '/countdown' : null);
  const { data: missions, reload } = useApi<TodayMission[]>(isStudent ? '/roadmap/missions/today' : null);
  const [completing, setCompleting] = useState<string | null>(null);

  async function complete(id: string) {
    setCompleting(id);
    try {
      await apiRequest(`/roadmap/missions/${id}`, {
        method: 'PATCH',
        token: token ?? undefined,
        body: { status: 'COMPLETED' },
      });
      reload();
    } finally {
      setCompleting(null);
    }
  }

  if (authLoading) return <PageState><Spinner label="Loading…" /></PageState>;
  if (!profile) return <ErrorState message="Please sign in to view your dashboard." />;
  if (!isStudent) return <ErrorState message="The performance dashboard is for student accounts." />;
  if (loading) return <PageState><Spinner label="Loading your dashboard…" /></PageState>;
  if (error) return <ErrorState message={error} />;
  if (!data) return <EmptyState title="No data yet" message="Take a diagnostic to get started." />;

  const nextExam = countdown?.exams?.[0];
  const daysToExam = nextExam?.daysRemaining ?? countdown?.yearEnd.daysRemaining;
  const examLabel = nextExam ? nextExam.title : 'until year-end';

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {greeting()}{me ? `, ${me.firstName}` : ''}.
        </h1>
        <p className="mt-1 text-sm text-ink-400">
          {me ? `Grade ${me.grade}` : 'Here’s where you stand'} — keep a steady pace and the score follows.
        </p>
      </div>

      {/* Hero row: readiness + countdown + streak */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center text-center">
          <p className="mb-3 self-start text-sm font-medium text-ink-400">Exam readiness</p>
          <ScoreRing value={data.predictedScore} label="Predicted score" />
          <p className="mt-3 text-xs text-ink-300">
            Confidence {Math.round(data.predictionConfidence * 100)}%
          </p>
        </Card>

        <Card>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-warn-50 text-warn">
            <IconClock />
          </span>
          <p className="mt-3 text-sm font-medium text-ink-400">Countdown</p>
          <p className="mt-0.5 text-3xl font-semibold tracking-tight text-ink">{daysToExam ?? '—'} days</p>
          <p className="mt-1 text-xs text-ink-300">{examLabel}</p>
          {nextExam?.subject && (
            <div className="mt-3">
              <Badge tone="muted">{nextExam.subject.name}</Badge>
            </div>
          )}
        </Card>

        <Card>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald">
            <IconFlame />
          </span>
          <p className="mt-3 text-sm font-medium text-ink-400">Study streak</p>
          <p className="mt-0.5 text-3xl font-semibold tracking-tight text-ink">
            {data.streak.currentStreak} <span className="text-lg text-ink-300">days</span>
          </p>
          <p className="mt-1 text-xs text-ink-300">Longest {data.streak.longestStreak} days</p>
        </Card>
      </div>

      {/* Secondary stats */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ink-400">Overall mastery</p>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand">
              <IconTrendUp width={18} height={18} />
            </span>
          </div>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">{data.masteryScore}%</p>
          <div className="mt-3"><ProgressBar value={data.masteryScore} /></div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ink-400">Topics mastered</p>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy">
              <IconCheck width={18} height={18} />
            </span>
          </div>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            {data.completedTopics}
            <span className="text-lg text-ink-300"> / {data.totalTrackedTopics}</span>
          </p>
          <div className="mt-3">
            <ProgressBar
              tone="emerald"
              value={data.totalTrackedTopics ? (data.completedTopics / data.totalTrackedTopics) * 100 : 0}
            />
          </div>
        </Card>
      </div>

      {/* Today's missions */}
      <section>
        <SectionTitle title="Today’s missions" />
        {!missions || missions.length === 0 ? (
          <EmptyState title="No missions today" message="Generate a study plan to get personalised daily missions." />
        ) : (
          <div className="space-y-3">
            {missions.map((m) => {
              const done = m.status === 'COMPLETED';
              return (
                <Card key={m.id} className="flex items-center gap-4">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      done ? 'bg-emerald-50 text-emerald' : 'bg-navy-50 text-navy'
                    }`}
                  >
                    {done ? <IconCheck /> : <IconTarget />}
                  </span>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${done ? 'text-ink-300 line-through' : 'text-ink'}`}>
                      {m.title}
                    </p>
                    {m.description && <p className="text-xs text-ink-400">{m.description}</p>}
                  </div>
                  {done ? (
                    <Badge tone="emerald">Done</Badge>
                  ) : (
                    <Button variant="secondary" onClick={() => complete(m.id)} disabled={completing === m.id}>
                      {completing === m.id ? 'Saving…' : 'Mark done'}
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Weak topics */}
      <section>
        <SectionTitle title="Weak topics" action={<span className="text-xs text-ink-300">Prioritised by your roadmap</span>} />
        {data.weakTopics.length === 0 ? (
          <EmptyState title="No weak topics" message="Great work — nothing flagged right now." />
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {data.weakTopics.map((t) => {
                const weakPct = Math.round(t.weaknessScore * 100);
                return (
                  <li key={t.topicId} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-ink">{t.title}</p>
                      <div className="mt-1.5 max-w-xs">
                        <ProgressBar value={100 - weakPct} tone={weakPct >= 50 ? 'danger' : 'warn'} />
                      </div>
                    </div>
                    <Badge tone={weakPct >= 50 ? 'danger' : 'warn'}>{weakPct}% to improve</Badge>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
