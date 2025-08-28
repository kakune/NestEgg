'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { User } from '@/types/user';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    try {
      const response = await api.get('/auth/me');
      const userData = response.data.data || response.data;
      setUser(userData);
      return userData;
    } catch (error) {
      setUser(null);
      throw error;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetchUser();
    } catch {
      // User is not authenticated
    } finally {
      setIsLoading(false);
    }
  }, [fetchUser]);

  useEffect(() => {
    // Initialize token from localStorage and fetch user once on mount
    const initializeAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
      await refreshUser();
    };
    
    initializeAuth();
  }, []); // Empty dependency array - only run once on mount

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { accessToken, user } = response.data.data;
    
    // Store the token
    localStorage.setItem('accessToken', accessToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    
    setUser(user);
    // Don't redirect here - let the calling component handle the redirect
  };

  const register = async (email: string, password: string, name: string) => {
    const response = await api.post('/auth/register', { 
      email, 
      password, 
      name
    });
    const { accessToken, user } = response.data.data;
    
    // Store the token
    localStorage.setItem('accessToken', accessToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    
    setUser(user);
    // Don't redirect here - let the calling component handle the redirect
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Continue with logout even if API call fails
    }
    
    localStorage.removeItem('accessToken');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    router.push('/auth/signin');
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}