'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { IconLogout } from './icons';

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-navy text-sm font-bold text-white">
        P
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-navy">PassPath</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, logout } = useAuth();
  const pathname = usePathname();

  const navByRole: Record<string, Array<{ href: string; label: string }>> = {
    student: [{ href: '/dashboard', label: 'Dashboard' }],
    parent: [{ href: '/parent', label: 'My Children' }],
    admin: [{ href: '/admin', label: 'Admin Console' }],
  };
  const nav = profile ? (navByRole[profile.role] ?? []) : [];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-8">
            <Wordmark />
            <nav className="hidden items-center gap-1 sm:flex">
              {nav.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      active ? 'bg-navy-50 text-navy' : 'text-ink-400 hover:text-ink'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {profile ? (
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium leading-tight text-ink">{profile.email}</p>
                <p className="text-xs capitalize text-ink-300">{profile.role}</p>
              </div>
              <button
                onClick={() => void logout()}
                aria-label="Sign out"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line text-ink-400 transition-colors hover:bg-canvas hover:text-ink"
              >
                <IconLogout />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-600"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
