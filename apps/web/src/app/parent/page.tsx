'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/lib/use-api';
import { apiRequest } from '@/lib/api';
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
import { IconUser, IconFlame, IconTrendUp, IconChevronRight } from '@/components/icons';
import type { ChildSummary, DashboardView } from '@/lib/types';

interface ChildDashboard {
  performance: DashboardView;
  weakSubjects: Array<{ subject: string; weakTopicCount: number; avgWeakness: number }>;
  studyConsistency: { currentStreak: number; longestStreak: number; lastActiveDate: string | null };
}

export default function ParentPage() {
  const { profile, token, loading: authLoading } = useAuth();
  const isParent = profile?.role === 'parent';
  const { data: children, error, reload } = useApi<ChildSummary[]>(isParent ? '/parent/children' : null);
  const [email, setEmail] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const { data: child, loading: childLoading } = useApi<ChildDashboard>(
    selected ? `/parent/children/${selected}/dashboard` : null,
    [selected],
  );

  async function link(e: React.FormEvent) {
    e.preventDefault();
    setLinkError(null);
    try {
      await apiRequest('/parent/children', {
        method: 'POST',
        token: token ?? undefined,
        body: { studentEmail: email },
      });
      setEmail('');
      reload();
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Could not link child');
    }
  }

  if (authLoading) return <PageState><Spinner label="Loading…" /></PageState>;
  if (!profile) return <ErrorState message="Please sign in." />;
  if (!isParent) return <ErrorState message="This area is for parent accounts." />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">My children</h1>
        <p className="mt-1 text-sm text-ink-400">Follow your child’s progress, consistency and exam readiness.</p>
      </div>

      <Card>
        <SectionTitle title="Link a child" />
        <form onSubmit={link} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            placeholder="child@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-xl border border-line px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-300 focus:border-brand"
          />
          <Button type="submit">Link account</Button>
        </form>
        {linkError && <p className="mt-2 text-sm text-danger">{linkError}</p>}
      </Card>

      <section>
        <SectionTitle title="Children" />
        {error ? (
          <ErrorState message={error} />
        ) : !children || children.length === 0 ? (
          <EmptyState title="No children linked" message="Link a child by their account email above." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {children.map((c) => {
              const active = selected === c.id;
              return (
                <button key={c.id} onClick={() => setSelected(c.id)} className="text-left">
                  <Card className={`flex items-center gap-3 transition-shadow hover:shadow-lift ${active ? 'ring-2 ring-navy' : ''}`}>
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy">
                      <IconUser />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-ink">{c.firstName} {c.surname}</p>
                      <p className="text-xs text-ink-400">Grade {c.grade}{c.school ? ` · ${c.school}` : ''}</p>
                    </div>
                    <IconChevronRight className="text-ink-300" />
                  </Card>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selected && (
        <section>
          <SectionTitle title="Performance" />
          {childLoading ? (
            <PageState><Spinner label="Loading child overview…" /></PageState>
          ) : child ? (
            <div className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-3">
                <Card className="flex flex-col items-center justify-center text-center">
                  <p className="mb-3 self-start text-sm font-medium text-ink-400">Exam readiness</p>
                  <ScoreRing value={child.performance.predictedScore} label="Predicted" />
                </Card>
                <Card>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand">
                    <IconTrendUp />
                  </span>
                  <p className="mt-3 text-sm font-medium text-ink-400">Overall mastery</p>
                  <p className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">{child.performance.masteryScore}%</p>
                  <div className="mt-3"><ProgressBar value={child.performance.masteryScore} /></div>
                </Card>
                <Card>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald">
                    <IconFlame />
                  </span>
                  <p className="mt-3 text-sm font-medium text-ink-400">Study consistency</p>
                  <p className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">
                    {child.studyConsistency.currentStreak} <span className="text-base text-ink-300">day streak</span>
                  </p>
                  <p className="mt-1 text-xs text-ink-300">Longest {child.studyConsistency.longestStreak} days</p>
                </Card>
              </div>

              <Card>
                <SectionTitle title="Subjects needing support" />
                {child.weakSubjects.length === 0 ? (
                  <p className="text-sm text-ink-400">No weak subjects flagged right now.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {child.weakSubjects.map((s) => (
                      <li key={s.subject} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                        <span className="text-sm font-medium text-ink">{s.subject}</span>
                        <Badge tone="warn">{s.weakTopicCount} weak {s.weakTopicCount === 1 ? 'topic' : 'topics'}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
