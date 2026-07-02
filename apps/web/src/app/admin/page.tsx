'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/lib/use-api';
import { apiRequest } from '@/lib/api';
import {
  Card,
  SectionTitle,
  Badge,
  Button,
  Spinner,
  PageState,
  ErrorState,
} from '@/components/ui';
import { IconUsers, IconBook, IconClipboard, IconCompass } from '@/components/icons';
import type { AdminStats, AdminUser, AiSetting } from '@/lib/types';

export default function AdminPage() {
  const { profile, token, loading: authLoading } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const { data: stats } = useApi<AdminStats>(isAdmin ? '/admin/stats' : null);
  const { data: users, reload: reloadUsers } = useApi<AdminUser[]>(isAdmin ? '/admin/users' : null);
  const { data: settings, reload: reloadSettings } = useApi<AiSetting[]>(isAdmin ? '/admin/ai-settings' : null);

  async function toggleUser(u: AdminUser) {
    await apiRequest(`/admin/users/${u.id}/status`, {
      method: 'PATCH',
      token: token ?? undefined,
      body: { isActive: !u.isActive },
    });
    reloadUsers();
  }

  if (authLoading) return <PageState><Spinner label="Loading…" /></PageState>;
  if (!profile) return <ErrorState message="Please sign in." />;
  if (!isAdmin) return <ErrorState message="Admin access only." />;

  const statCards = [
    { label: 'Users', value: stats?.users, icon: <IconUsers />, tone: 'navy' },
    { label: 'Students', value: stats?.students, icon: <IconUsers />, tone: 'brand' },
    { label: 'Subjects', value: stats?.subjects, icon: <IconBook />, tone: 'emerald' },
    { label: 'Questions', value: stats?.questions, icon: <IconClipboard />, tone: 'navy' },
    { label: 'Documents', value: stats?.documents, icon: <IconBook />, tone: 'brand' },
    { label: 'Careers', value: stats?.careers, icon: <IconCompass />, tone: 'emerald' },
    { label: 'AI queries', value: stats?.aiQueries, icon: <IconClipboard />, tone: 'navy' },
    { label: 'Parents', value: stats?.parents, icon: <IconUsers />, tone: 'brand' },
  ];
  const toneClass: Record<string, string> = {
    navy: 'bg-navy-50 text-navy',
    brand: 'bg-brand-50 text-brand',
    emerald: 'bg-emerald-50 text-emerald',
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Admin console</h1>
        <p className="mt-1 text-sm text-ink-400">Manage users, AI settings and monitor the platform.</p>
      </div>

      <section>
        <SectionTitle title="Overview" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((s) => (
            <Card key={s.label}>
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${toneClass[s.tone]}`}>
                {s.icon}
              </span>
              <p className="mt-3 text-sm font-medium text-ink-400">{s.label}</p>
              <p className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">{s.value ?? '—'}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle title="AI settings" />
        <div className="grid gap-3 sm:grid-cols-2">
          {settings?.map((s) => (
            <SettingRow key={s.id} setting={s} token={token} onSaved={reloadSettings} />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle title="Users" />
        <Card padded={false} className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-300">
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-medium text-ink">{u.email}</td>
                  <td className="px-5 py-3 capitalize text-ink-400">{u.role}</td>
                  <td className="px-5 py-3">
                    {u.isActive ? <Badge tone="emerald">Active</Badge> : <Badge tone="danger">Suspended</Badge>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => void toggleUser(u)}
                      className="text-sm font-semibold text-brand hover:text-brand-600"
                    >
                      {u.isActive ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}

function SettingRow({
  setting,
  token,
  onSaved,
}: {
  setting: AiSetting;
  token: string | null;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(setting.value);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await apiRequest('/admin/ai-settings', {
        method: 'PUT',
        token: token ?? undefined,
        body: { key: setting.key, value },
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex items-center justify-between gap-4">
      <div>
        <p className="font-mono text-sm font-medium text-ink">{setting.key}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-28 rounded-lg border border-line px-2.5 py-1.5 text-sm text-ink focus:border-brand"
        />
        <Button variant="secondary" onClick={save} disabled={saving || value === setting.value}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Card>
  );
}
