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
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('pr_auth_token');
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('pr_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [workshop, setWorkshop] = useState<WorkshopProfile | null>(() => {
    try {
      const saved = localStorage.getItem('pr_auth_workshop');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(() => {
    try {
      const saved = localStorage.getItem('pr_setup_complete');
      if (saved === 'true') return true;
      if (saved === 'false') return false;
      return null;
    } catch {
      return null;
    }
  });

  // If token and user are already cached, do not block the UI with a full-screen loading spinner
  const [loading, setLoading] = useState<boolean>(() => !localStorage.getItem('pr_auth_token'));

  const fetchWorkshop = async () => {
    try {
      const wp = await apiRequest<WorkshopProfile>('/settings/business');
      setWorkshop(wp);
      try {
        localStorage.setItem('pr_auth_workshop', JSON.stringify(wp));
      } catch {}
    } catch {
      // Keep cached workshop profile if offline or initializing
    }
  };

  const checkSetupAndUser = async () => {
    try {
      const setupRes = await apiRequest<{ is_setup_complete: boolean }>('/auth/setup-status');
      setIsSetupComplete(setupRes.is_setup_complete);
      try {
        localStorage.setItem('pr_setup_complete', String(setupRes.is_setup_complete));
      } catch {}

      const currentToken = localStorage.getItem('pr_auth_token');
      if (currentToken) {
        try {
          const me = await apiRequest<UserProfile>('/auth/me');
          setUser(me);
          try {
            localStorage.setItem('pr_auth_user', JSON.stringify(me));
          } catch {}
          await fetchWorkshop();
        } catch (err: any) {
          // CRITICAL: Only log out if the backend explicitly rejected credentials with 401 Unauthorized.
          // Transient errors, offline states, or server booting must NOT log the user out!
          if (err && err.status === 401) {
            localStorage.removeItem('pr_auth_token');
            localStorage.removeItem('pr_auth_user');
            localStorage.removeItem('pr_auth_workshop');
            setToken(null);
            setUser(null);
            setWorkshop(null);
          }
        }
      }
    } catch (err) {
      // Backend may be starting or offline; keep cached session active
      console.warn('Background setup check note:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSetupAndUser();
  }, [token]);

  const login = (newToken: string, newUser: UserProfile) => {
    try {
      localStorage.setItem('pr_auth_token', newToken);
      localStorage.setItem('pr_auth_user', JSON.stringify(newUser));
      localStorage.setItem('pr_setup_complete', 'true');
    } catch {}
    setToken(newToken);
    setUser(newUser);
    setIsSetupComplete(true);
    fetchWorkshop();
  };

  const logout = () => {
    try {
      localStorage.removeItem('pr_auth_token');
      localStorage.removeItem('pr_auth_user');
      localStorage.removeItem('pr_auth_workshop');
    } catch {}
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
