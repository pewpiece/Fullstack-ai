import { useEffect, useState, ReactNode } from 'react';
import { getMe } from '../api';
import { AuthContext, TOKEN_KEY } from './authState';
import type { User } from '../types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));
  const [isAuthReady, setIsAuthReady] = useState(() => !Boolean(localStorage.getItem(TOKEN_KEY)));
  const [user, setUser] = useState<User | null>(null);

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setIsAuthenticated(false);
    setIsAuthReady(true);
    setUser(null);
  };

  const validateSession = async () => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setIsAuthenticated(false);
      setIsAuthReady(true);
      setUser(null);
      return;
    }

    try {
      const me = await getMe();
      setIsAuthenticated(true);
      setUser(me);
    } catch {
      logout();
    } finally {
      setIsAuthReady(true);
    }
  };

  useEffect(() => {
    void validateSession();
  }, []);

  const login = async (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    setIsAuthenticated(true);
    setIsAuthReady(true);

    try {
      const me = await getMe();
      setUser(me);
    } catch {
      logout();
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isAuthReady, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
