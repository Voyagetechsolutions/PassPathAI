import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiRequest } from './api';
import type { AuthUser } from './types';

export interface RegisterProfile { firstName: string; surname: string; grade: number; province?: string }
interface SessionResponse { token: string; user: AuthUser }
interface AuthState {
  profile: AuthUser | null; token: string | null; loading: boolean; authError: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, profile: RegisterProfile) => Promise<void>;
  logout: () => Promise<void>;
}

const STORAGE_KEY = 'passpath.accessToken';
const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const acceptSession = useCallback(async (session: SessionResponse) => {
    await AsyncStorage.setItem(STORAGE_KEY, session.token);
    setToken(session.token); setProfile(session.user); setAuthError(null);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(async (saved) => {
      if (!saved) return;
      setToken(saved);
      try { setProfile(await apiRequest<AuthUser>('/auth/me', { token: saved })); }
      catch { await AsyncStorage.removeItem(STORAGE_KEY); setToken(null); }
    }).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    try { await acceptSession(await apiRequest<SessionResponse>('/auth/login', { method: 'POST', body: { email, password } })); }
    catch (e) { setAuthError(e instanceof Error ? e.message : 'Sign-in failed'); throw e; }
  }, [acceptSession]);

  const register = useCallback(async (email: string, password: string, profileData: RegisterProfile) => {
    setLoading(true); setAuthError(null);
    try {
      await acceptSession(await apiRequest<SessionResponse>('/auth/register', {
        method: 'POST', body: { email, password, role: 'student', ...profileData },
      }));
    } catch (e) { setAuthError(e instanceof Error ? e.message : 'Registration failed'); throw e; }
    finally { setLoading(false); }
  }, [acceptSession]);

  const logout = useCallback(async () => {
    if (token) await apiRequest('/auth/logout', { method: 'POST', token }).catch(() => undefined);
    await AsyncStorage.removeItem(STORAGE_KEY); setToken(null); setProfile(null); setAuthError(null);
  }, [token]);

  const value = useMemo<AuthState>(() => ({ profile, token, loading, authError, login, register, logout }),
    [profile, token, loading, authError, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
