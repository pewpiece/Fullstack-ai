import { useEffect, useState, ReactNode } from 'react';
import { getMe } from '../api';
import { AuthContext, TOKEN_KEY } from './authState';
import type { User } from '../types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      setIsAuthenticated(true);
      void getMe()
        .then((me) => setUser(me))
        .catch(() => setUser(null));
    }
  }, []);

  const login = (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    setIsAuthenticated(true);
    void getMe()
      .then((me) => setUser(me))
      .catch(() => setUser(null));
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
