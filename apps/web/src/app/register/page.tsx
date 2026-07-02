'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, Button, ErrorState } from '@/components/ui';
import { PROVINCES, GRADES } from '@/lib/sa';

const inputClass =
  'w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-300 focus:border-brand';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: '',
    surname: '',
    email: '',
    password: '',
    confirm: '',
    grade: '10',
    province: 'GAUTENG',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await register(form.email.trim(), form.password, {
        firstName: form.firstName.trim(),
        surname: form.surname.trim(),
        grade: Number(form.grade),
        province: form.province,
      });
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-6">
      <div className="mb-7 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-navy">Create your account</h1>
        <p className="mt-1 text-sm text-ink-400">Your personal exam success system starts here.</p>
      </div>

      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <ErrorState message={error} />}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-600">First name</label>
              <input required value={form.firstName} onChange={set('firstName')} className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-600">Surname</label>
              <input required value={form.surname} onChange={set('surname')} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-600">Email</label>
            <input type="email" required value={form.email} onChange={set('email')} className={inputClass} placeholder="you@example.com" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-600">Grade</label>
              <select value={form.grade} onChange={set('grade')} className={inputClass}>
                {GRADES.map((g) => (
                  <option key={g} value={g}>Grade {g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-600">Province</label>
              <select value={form.province} onChange={set('province')} className={inputClass}>
                {PROVINCES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-600">Password</label>
            <input type="password" required value={form.password} onChange={set('password')} className={inputClass} placeholder="At least 6 characters" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-600">Confirm password</label>
            <input type="password" required value={form.confirm} onChange={set('confirm')} className={inputClass} />
          </div>

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
      </Card>

      <p className="mt-5 text-center text-sm text-ink-400">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand hover:text-brand-600">Sign in</Link>
      </p>
    </div>
  );
}
