import { createContext } from 'react';
import type { User } from '../types';

export interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (token: string) => void;
  logout: () => void;
}

export const TOKEN_KEY = 'inventrack_token';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);