import { createContext } from 'react';
import type { User } from '../types';

export interface AuthContextType {
  isAuthenticated: boolean;
  isAuthReady: boolean;
  user: User | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

export const TOKEN_KEY = 'inventrack_token';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);