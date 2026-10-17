import React, { createContext, useContext, useEffect, useState } from 'react';
import { CurrentActor } from '../types';
import { api } from '../api/client';

interface AuthContextType {
  actor: CurrentActor | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (returnTo?: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  actor: null,
  loading: true,
  refresh: async () => {},
  login: () => {},
  logout: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [actor, setActor] = useState<CurrentActor | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchActor = async () => {
    try {
      const data = await api.getMe();
      setActor(data);
    } catch (e) {
      setActor(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActor();
  }, []);

  const login = (returnTo: string = window.location.pathname) => {
    window.location.href = `/auth/login?return_to=${encodeURIComponent(returnTo)}`;
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {}
    setActor(null);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ actor, loading, refresh: fetchActor, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
