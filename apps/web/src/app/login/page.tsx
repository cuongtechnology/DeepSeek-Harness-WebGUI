'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';
import { Button, Input, Label, Spinner } from '@deepseek-harness/ui';
import { Zap } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, register, error } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, name);
      const next = new URLSearchParams(window.location.search).get('next');
      router.replace(next && next.startsWith('/') ? next : '/dashboard');
    } catch {
      /* error surfaced via store */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-4">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/4 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-[320px] w-[420px] rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-lg shadow-indigo-500/25">
            <Zap className="h-6 w-6 text-white" fill="currentColor" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">DeepSeek Harness WebGUI</h1>
            <p className="mt-1 text-sm text-zinc-500">Self-hosted control plane for AI coding agents</p>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl backdrop-blur">
          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Your name"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
              />
            </div>

            {error && <p className="rounded-md bg-red-500/10 p-2 text-xs text-red-300">{error}</p>}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <button
            type="button"
            className="mt-4 w-full text-center text-xs text-zinc-500 hover:text-zinc-300"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-zinc-600">
          Independent open-source project · AGPL-3.0
          <br />
          Not affiliated with or endorsed by DeepSeek.
        </p>
      </div>
    </div>
  );
}
