import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, type User } from '../api/client';

interface AuthState {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState & {
  login: (email: string, password: string) => Promise<void>;
  loginWithOrg?: (organizationSlug: string, email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  registerOrg?: (organizationName: string, slug: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setTokens: (access: string, refresh: string) => void;
}>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const setTokens = useCallback((access: string, refresh: string) => {
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  }, []);

  const loadUser = useCallback(async () => {
    if (!localStorage.getItem('accessToken')) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user: u } = await api.auth.me();
      setUser(u);
    } catch {
      setUser(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.auth.login(email, password);
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  }, [setTokens]);

  const loginWithOrg = useCallback(async (organizationSlug: string, email: string, password: string) => {
    const data = await api.auth.loginWithOrg(organizationSlug, email, password);
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  }, [setTokens]);

  const register = useCallback(async (email: string, password: string) => {
    const data = await api.auth.register(email, password);
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  }, [setTokens]);

  const registerOrg = useCallback(async (organizationName: string, slug: string, email: string, password: string) => {
    const data = await api.auth.registerOrg(organizationName, slug, email, password);
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  }, [setTokens]);

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem('refreshToken');
    try {
      await api.auth.logout(refresh || undefined);
    } catch {
      // ignore
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithOrg, register, registerOrg, logout, setTokens }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
