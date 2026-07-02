'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Card, ScoreRing, Spinner, Badge } from '@/components/ui';
import { IconTarget, IconBook, IconTrendUp } from '@/components/icons';

const FEATURES = [
  { icon: <IconTarget />, title: 'Diagnose', body: 'Pinpoint weak topics with adaptive, curriculum-aligned diagnostics.' },
  { icon: <IconBook />, title: 'Learn', body: 'Grounded explanations from your CAPS material — never invented, always cited.' },
  { icon: <IconTrendUp />, title: 'Predict', body: 'Track mastery and a live exam-readiness score as you improve.' },
];

export default function HomePage() {
  const { profile, loading } = useAuth();
  const home: Record<string, string> = { student: '/dashboard', parent: '/parent', admin: '/admin' };

  return (
    <div className="space-y-14">
      <section className="grid items-center gap-10 pt-6 lg:grid-cols-2">
        <div>
          <Badge tone="navy">For Grades 8–12 · CAPS aligned</Badge>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-navy sm:text-5xl">
            Your personal exam success system.
          </h1>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-600">
            Learn, revise, practise and prepare for every exam — calm, structured and built
            around your curriculum. Not another feed. Not a chatbot.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {loading ? (
              <Spinner label="Checking your session…" />
            ) : profile ? (
              <Link
                href={home[profile.role] ?? '/'}
                className="rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white hover:bg-navy-600"
              >
                Go to your dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white hover:bg-navy-600"
                >
                  Get started
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink-600 hover:bg-canvas"
                >
                  I already have an account
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Calm preview card — a glimpse of the planner aesthetic. */}
        <div className="relative">
          <Card className="mx-auto max-w-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink-400">Exam readiness</p>
                <p className="text-lg font-semibold text-ink">Grade 10 · Mathematics</p>
              </div>
              <Badge tone="emerald">On track</Badge>
            </div>
            <div className="mt-4 flex justify-center">
              <ScoreRing value={74} label="Readiness" />
            </div>
            <div className="mt-5 space-y-3">
              {[
                ['Today’s mission', 'Revise: Algebraic Expressions'],
                ['Next exam', '102 days'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between rounded-xl bg-canvas px-4 py-3">
                  <span className="text-sm text-ink-400">{k}</span>
                  <span className="text-sm font-semibold text-ink">{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title}>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy">
              {f.icon}
            </span>
            <h3 className="mt-4 text-base font-semibold text-ink">{f.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-400">{f.body}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
