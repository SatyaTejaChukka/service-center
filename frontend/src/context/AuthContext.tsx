import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';

export interface UserProfile {
  id: number;
  username: string;
  full_name: string;
  role: 'ADMIN' | 'STAFF';
  is_active: boolean;
}

export interface WorkshopProfile {
  name: string;
  address: string;
  phone: string;
  email?: string;
  gstin?: string;
  upi_id?: string;
  terms?: string;
  footer?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  workshop: WorkshopProfile | null;
  token: string | null;
  isSetupComplete: boolean | null;
  loading: boolean;
  login: (token: string, user: UserProfile) => void;
  logout: () => void;
  refreshSetupStatus: () => Promise<void>;
  refreshWorkshop: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [workshop, setWorkshop] = useState<WorkshopProfile | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('pr_auth_token'));
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchWorkshop = async () => {
    try {
      const wp = await apiRequest<WorkshopProfile>('/settings/business');
      setWorkshop(wp);
    } catch {
      // ignore if unauthenticated or not ready
    }
  };

  const checkSetupAndUser = async () => {
    try {
      setLoading(true);
      const setupRes = await apiRequest<{ is_setup_complete: boolean }>('/auth/setup-status');
      setIsSetupComplete(setupRes.is_setup_complete);

      if (token) {
        try {
          const me = await apiRequest<UserProfile>('/auth/me');
          setUser(me);
          await fetchWorkshop();
        } catch {
          // Token expired or invalid
          localStorage.removeItem('pr_auth_token');
          setToken(null);
          setUser(null);
          setWorkshop(null);
        }
      }
    } catch (err) {
      console.error('Failed to verify status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSetupAndUser();
  }, [token]);

  const login = (newToken: string, newUser: UserProfile) => {
    localStorage.setItem('pr_auth_token', newToken);
    setToken(newToken);
    setUser(newUser);
    setIsSetupComplete(true);
    fetchWorkshop();
  };

  const logout = () => {
    localStorage.removeItem('pr_auth_token');
    setToken(null);
    setUser(null);
    setWorkshop(null);
  };

  const refreshSetupStatus = async () => {
    await checkSetupAndUser();
  };

  const refreshWorkshop = async () => {
    await fetchWorkshop();
  };

  return (
    <AuthContext.Provider value={{ user, workshop, token, isSetupComplete, loading, login, logout, refreshSetupStatus, refreshWorkshop }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
