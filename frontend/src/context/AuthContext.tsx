import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import type { User, LoginRequest, RegisterRequest, ApiResponse, AuthTokens } from '@hazinahub/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async () => {
    try {
      const response = await api.get<ApiResponse<User>>('/auth/profile');
      if (response.data.success && response.data.data) {
        setUser(response.data.data);
      } else {
        logout();
      }
    } catch (error) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const parseAuthError = (error: any, fallback: string) => {
    const detail = error.response?.data?.detail;
    if (Array.isArray(detail)) {
      return detail.map((item: any) => item.msg || JSON.stringify(item)).join(', ');
    }
    if (typeof detail === 'string') {
      return detail;
    }
    return error.response?.data?.error || error.message || fallback;
  };

  const login = async (data: LoginRequest) => {
    try {
      const response = await api.post<ApiResponse<{ accessToken: string; refreshToken: string; user: User }>>(
        '/auth/login',
        data,
      );

      if (
        response.data.success &&
        response.data.data?.accessToken &&
        response.data.data?.refreshToken &&
        response.data.data?.user
      ) {
        const { accessToken, refreshToken, user: userData } = response.data.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        setUser(userData);
      } else {
        throw new Error(response.data.error || 'Login failed');
      }
    } catch (error: any) {
      const errMsg = parseAuthError(error, 'Login failed');
      throw new Error(errMsg);
    }
  };

  const register = async (data: RegisterRequest) => {
    try {
      const payload = {
        email: data.email,
        password: data.password,
        phone: data.phone,
        first_name: data.firstName,
        last_name: data.lastName,
        business_name: data.businessName,
      };

      const response = await api.post<ApiResponse<{ accessToken: string; refreshToken: string; user: User }>>(
        '/auth/register',
        payload,
      );

      if (
        response.data.success &&
        response.data.data?.accessToken &&
        response.data.data?.refreshToken &&
        response.data.data?.user
      ) {
        const { accessToken, refreshToken, user: userData } = response.data.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        setUser(userData);
      } else {
        throw new Error(response.data.error || 'Registration failed');
      }
    } catch (error: any) {
      const errMsg = parseAuthError(error, 'Registration failed');
      throw new Error(errMsg);
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  const refreshProfile = async () => {
    try {
      const response = await api.get<ApiResponse<User>>('/auth/profile');
      if (response.data.success && response.data.data) {
        setUser(response.data.data);
      }
    } catch (error) {
      console.error('Failed to refresh user profile:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
