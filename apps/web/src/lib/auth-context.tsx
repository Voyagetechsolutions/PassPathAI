'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth } from './firebase';
import { apiRequest } from './api';
import type { AuthUser } from './types';

export interface RegisterProfile {
  firstName: string;
  surname: string;
  grade: number;
  province?: string;
}

interface AuthState {
  firebaseUser: User | null;
  profile: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  devLogin: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, profile: RegisterProfile) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let auth;
    try {
      auth = getFirebaseAuth();
    } catch {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const idToken = await user.getIdToken();
        setToken(idToken);
        try {
          const me = await apiRequest<AuthUser>('/auth/me', { token: idToken });
          setProfile(me);
        } catch {
          setProfile(null);
        }
      } else {
        setToken(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
      throw e;
    }
  }, []);

  const devLogin = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const response = await apiRequest<{ token: string; user: AuthUser }>('/auth/dev-login', {
        method: 'POST',
        body: { email, password },
      });
      setToken(response.token);
      setProfile(response.user);
      setFirebaseUser(null); // dev auth doesn't use Firebase
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dev login failed');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, profile: RegisterProfile) => {
      setError(null);
      setLoading(true);
      try {
        const auth = getFirebaseAuth();
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const idToken = await cred.user.getIdToken();
        // Provision the local account, then load the profile.
        await apiRequest('/auth/register', {
          method: 'POST',
          token: idToken,
          body: { role: 'student', ...profile },
        });
        const me = await apiRequest<AuthUser>('/auth/me', { token: idToken });
        setFirebaseUser(cred.user);
        setToken(idToken);
        setProfile(me);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Registration failed');
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
    await signOut(auth);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ firebaseUser, profile, token, loading, error, login, devLogin, register, logout }),
    [firebaseUser, profile, token, loading, error, login, devLogin, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
