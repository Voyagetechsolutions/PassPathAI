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
  profile: AuthUser | null;
  token: string | null;
  loading: boolean;
  authError: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, profile: RegisterProfile) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let auth;
    try {
      auth = getFirebaseAuth();
    } catch {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        const idToken = await user.getIdToken();
        setToken(idToken);
        try {
          setProfile(await apiRequest<AuthUser>('/auth/me', { token: idToken }));
          setAuthError(null);
        } catch (e) {
          setProfile(null);
          setAuthError(
            e instanceof Error && /network|fetch|timeout/i.test(e.message)
              ? 'Signed in, but couldn’t reach the PassPath server. Check your connection and try again.'
              : 'We couldn’t load your profile. Pull to refresh or sign in again.',
          );
        }
      } else {
        setToken(null);
        setProfile(null);
        setAuthError(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const register = useCallback(
    async (email: string, password: string, profile: RegisterProfile) => {
      setLoading(true);
      try {
        const auth = getFirebaseAuth();
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const idToken = await cred.user.getIdToken();
        await apiRequest('/auth/register', {
          method: 'POST',
          token: idToken,
          body: { role: 'student', ...profile },
        });
        const me = await apiRequest<AuthUser>('/auth/me', { token: idToken });
        setToken(idToken);
        setProfile(me);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    await signOut(getFirebaseAuth());
  }, []);

  const value = useMemo<AuthState>(
    () => ({ profile, token, loading, authError, login, register, logout }),
    [profile, token, loading, authError, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
