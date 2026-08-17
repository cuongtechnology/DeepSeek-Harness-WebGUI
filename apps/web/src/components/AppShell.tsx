'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/store/auth';
import { apiGet } from '@/lib/api';
import { cn } from '@deepseek-harness/ui';
import { Zap, LayoutDashboard, FolderGit2, MessageSquare, Settings, LogOut } from 'lucide-react';

interface Runtime {
  id: string;
  name: string;
  available: boolean;
}

const NAV: { section: string; items: { href: string; label: string; icon: typeof Zap }[] }[] = [
  {
    section: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    section: 'Workspace',
    items: [
      { href: '/projects', label: 'Projects', icon: FolderGit2 },
      { href: '/sessions', label: 'Sessions', icon: MessageSquare },
    ],
  },
  {
    section: 'System',
    items: [{ href: '/settings', label: 'Settings', icon: Settings }],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, fetchMe, logout } = useAuth();
  const [runtime, setRuntime] = useState<Runtime | null>(null);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    apiGet<Runtime[]>('/agents')
      .then((r) => setRuntime(r[0] ?? null))
      .catch(() => undefined);
  }, []);

  return (
    <div className="flex h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900/60">
        <div className="flex h-14 items-center gap-2.5 border-b border-zinc-800 px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500">
            <Zap className="h-4 w-4 text-white" fill="currentColor" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">DeepSeek Harness</div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">WebGUI</div>
          </div>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto p-2">
          {NAV.map((group) => (
            <div key={group.section}>
              <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                {group.section}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                        active
                          ? 'bg-zinc-800 text-zinc-100'
                          : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-2 border-t border-zinc-800 p-3">
          <Link
            href="/settings/agents"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-zinc-800"
            title={runtime?.available ? 'Runtime installed' : 'Runtime not installed — click to install'}
          >
            <span className={cn('h-2 w-2 shrink-0 rounded-full', runtime?.available ? 'bg-emerald-500' : 'bg-amber-500')} />
            <span className="text-zinc-400">DeepSeek Harness</span>
            <span className={cn('ml-auto font-medium', runtime?.available ? 'text-emerald-400' : 'text-amber-400')}>
              {runtime ? (runtime.available ? 'ready' : 'not installed') : '…'}
            </span>
          </Link>

          <div className="flex items-center justify-between gap-2 border-t border-zinc-800/60 pt-2">
            {!loading && user ? (
              <>
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-zinc-200">{user.name}</div>
                  <div className="truncate text-[10px] text-zinc-500">{user.email}</div>
                </div>
                <button
                  onClick={() => void logout()}
                  title="Sign out"
                  className="shrink-0 rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <span className="text-xs text-zinc-600">Loading…</span>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
