import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setToken } from './api';

export type Role = 'ADMIN' | 'BUYER' | 'SELLER';
export type SellerStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface SellerInfo {
  id: string;
  storeName: string;
  status: SellerStatus;
}

interface AuthState {
  user: User | null;
  seller: SellerInfo | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const data = await api<{ user: User; seller: SellerInfo | null }>('/auth/me');
      setUser(data.user);
      setSeller(data.seller);
    } catch {
      setUser(null);
      setSeller(null);
      setToken(null);
    }
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const data = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    await refresh();
  }

  async function register(name: string, email: string, password: string) {
    const data = await api<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    setToken(data.token);
    await refresh();
  }

  function logout() {
    setToken(null);
    setUser(null);
    setSeller(null);
  }

  return (
    <AuthContext.Provider value={{ user, seller, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return ctx;
}
