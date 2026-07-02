'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, Button, ErrorState } from '@/components/ui';
import { IconChevronRight, IconUser, IconUsers, IconSliders } from '@/components/icons';

const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? 'passpath-demo';
const DEMO_ACCOUNTS = [
  { role: 'student', email: 'student@demo.passpath.app', label: 'Student', sub: 'Dashboard, missions, weak topics', icon: <IconUser /> },
  { role: 'parent', email: 'parent@demo.passpath.app', label: 'Parent', sub: 'Track your child’s progress', icon: <IconUsers /> },
  { role: 'admin', email: 'admin@demo.passpath.app', label: 'Admin', sub: 'Users, settings, platform stats', icon: <IconSliders /> },
];

export default function LoginPage() {
  const { login, devLogin } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  async function demo(demoEmail: string, role: string) {
    setBusy(true);
    setError(null);
    try {
      await devLogin(demoEmail, DEMO_PASSWORD);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : `Demo ${role} login failed`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-6">
      <div className="mb-7 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-navy">Welcome back</h1>
        <p className="mt-1 text-sm text-ink-400">Sign in to keep preparing for your exams.</p>
      </div>

      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <ErrorState message={error} />}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-600">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-300 focus:border-brand"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-600">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-300 focus:border-brand"
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-center text-sm text-ink-400">
        New to PassPath?{' '}
        <Link href="/register" className="font-semibold text-brand hover:text-brand-600">
          Create an account
        </Link>
      </p>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs font-medium uppercase tracking-wide text-ink-300">Or try a demo</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="space-y-2.5">
        {DEMO_ACCOUNTS.map((a) => (
          <button
            key={a.role}
            onClick={() => demo(a.email, a.role)}
            disabled={busy}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-left transition-colors hover:bg-canvas disabled:opacity-50"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy">
              {a.icon}
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-ink">{a.label} account</span>
              <span className="block text-xs text-ink-400">{a.sub}</span>
            </span>
            <IconChevronRight className="text-ink-300" />
          </button>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-ink-300">
        Demo accounts are for evaluation only and are disabled in production.
      </p>
    </div>
  );
}
