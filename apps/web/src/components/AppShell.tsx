'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/store/auth';
import { cn } from '@deepseek-harness/ui';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/sessions', label: 'Sessions' },
  { href: '/settings', label: 'Settings' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, fetchMe, logout } = useAuth();

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  return (
    <div className="flex h-screen">
      <aside className="flex w-52 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900/60">
        <div className="flex h-12 items-center gap-2 border-b border-zinc-800 px-4">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-sm font-semibold">dsh WebGUI</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
                pathname.startsWith(item.href) && 'bg-zinc-800 text-zinc-100',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-zinc-800 p-3 text-xs">
          {!loading && user ? (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-zinc-400">{user.name}</span>
              <button onClick={() => void logout()} className="text-zinc-500 hover:text-zinc-200">
                Sign out
              </button>
            </div>
          ) : (
            <span className="text-zinc-600">Loading…</span>
          )}
        </div>
      </aside>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
