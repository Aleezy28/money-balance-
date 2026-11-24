import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import api, { setAuthToken, setUnauthorizedHandler } from '../api/axios';
import type { CurrencyCode, User } from '../types';

export interface RegisterResult {
  requiresVerification: boolean;
  email: string;
  user: User;
  verificationPreviewCode?: string;
  message: string;
}

export interface SendVerificationResult {
  alreadyVerified?: boolean;
  email: string;
  verificationPreviewCode?: string;
  message: string;
}

interface AuthContextValue {
  user: User | null;
  currency: CurrencyCode;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    currency?: CurrencyCode
  ) => Promise<RegisterResult>;
  sendVerificationCode: (
    email: string,
    password: string
  ) => Promise<SendVerificationResult>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get<{ user: User }>('/auth/me');
      setUserState(response.data.user);
    } catch {
      setAuthToken(null);
      setUserState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuthToken(null);
      setUserState(null);
    });
    void refreshUser();
    return () => setUnauthorizedHandler(null);
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<{ token: string; user: User }>('/auth/login', {
      email,
      password,
    });
    setAuthToken(response.data.token);
    setUserState(response.data.user);
  }, []);

  const register = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      currency: CurrencyCode = 'PKR'
    ): Promise<RegisterResult> => {
      const response = await api.post<RegisterResult>('/auth/register', {
        name,
        email,
        password,
        currency,
      });
      return response.data;
    },
    []
  );

  const sendVerificationCode = useCallback(
    async (email: string, password: string): Promise<SendVerificationResult> => {
      const response = await api.post<SendVerificationResult>(
        '/auth/send-verification',
        { email, password }
      );
      return response.data;
    },
    []
  );

  const verifyEmail = useCallback(async (email: string, code: string) => {
    const response = await api.post<{ token: string; user: User }>(
      '/auth/verify-email',
      { email, code }
    );
    setAuthToken(response.data.token);
    setUserState(response.data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on sign out
    }
    setAuthToken(null);
    setUserState(null);
  }, []);

  const setUser = useCallback((updated: User) => {
    setUserState(updated);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        currency: user?.currency ?? 'PKR',
        loading,
        isAuthenticated: Boolean(user),
        login,
        register,
        sendVerificationCode,
        verifyEmail,
        logout,
        setUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}
