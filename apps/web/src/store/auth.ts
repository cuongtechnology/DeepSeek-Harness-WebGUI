import { create } from 'zustand';
import type { PublicUser } from '@deepseek-harness/shared';
import { apiGet, apiPost } from '../lib/api';

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  error: string | null;
  fetchMe: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,

  fetchMe: async () => {
    try {
      const user = await apiGet<PublicUser>('/auth/me');
      set({ user, loading: false, error: null });
    } catch {
      set({ user: null, loading: false });
    }
  },

  login: async (email, password) => {
    set({ error: null });
    try {
      const user = await apiPost<PublicUser>('/auth/login', { email, password });
      set({ user });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Login failed' });
      throw error;
    }
  },

  register: async (email, password, name) => {
    set({ error: null });
    try {
      const user = await apiPost<PublicUser>('/auth/register', { email, password, name });
      set({ user });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Registration failed' });
      throw error;
    }
  },

  logout: async () => {
    await apiPost('/auth/logout').catch(() => undefined);
    set({ user: null });
  },
}));
