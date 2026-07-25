'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiRequest } from './api';
import type { AuthUser } from './types';

export interface RegisterProfile { firstName: string; surname: string; grade: number; province?: string }
interface SessionResponse { token: string; user: AuthUser }
interface AuthState {
  profile: AuthUser | null; token: string | null; loading: boolean; error: string | null;
  login: (email: string, password: string) => Promise<void>;
  devLogin: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, profile: RegisterProfile) => Promise<void>;
  logout: () => Promise<void>;
}

const STORAGE_KEY = 'passpath.accessToken';
const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const acceptSession = useCallback((session: SessionResponse) => {
    localStorage.setItem(STORAGE_KEY, session.token);
    setToken(session.token);
    setProfile(session.user);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) { setLoading(false); return; }
    setToken(saved);
    apiRequest<AuthUser>('/auth/me', { token: saved })
      .then(setProfile)
      .catch(() => { localStorage.removeItem(STORAGE_KEY); setToken(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try { acceptSession(await apiRequest<SessionResponse>('/auth/login', { method: 'POST', body: { email, password } })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Login failed'); throw e; }
  }, [acceptSession]);

  const devLogin = useCallback(async (email: string, password: string) => {
    setError(null); setLoading(true);
    try { acceptSession(await apiRequest<SessionResponse>('/auth/dev-login', { method: 'POST', body: { email, password } })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Dev login failed'); throw e; }
    finally { setLoading(false); }
  }, [acceptSession]);

  const register = useCallback(async (email: string, password: string, profileData: RegisterProfile) => {
    setError(null); setLoading(true);
    try {
      acceptSession(await apiRequest<SessionResponse>('/auth/register', {
        method: 'POST', body: { email, password, role: 'student', ...profileData },
      }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Registration failed'); throw e; }
    finally { setLoading(false); }
  }, [acceptSession]);

  const logout = useCallback(async () => {
    if (token) await apiRequest('/auth/logout', { method: 'POST', token }).catch(() => undefined);
    localStorage.removeItem(STORAGE_KEY); setToken(null); setProfile(null);
  }, [token]);

  const value = useMemo<AuthState>(() => ({ profile, token, loading, error, login, devLogin, register, logout }),
    [profile, token, loading, error, login, devLogin, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
