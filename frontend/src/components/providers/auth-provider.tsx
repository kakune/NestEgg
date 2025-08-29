'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { User } from '@/types/user';

// Enhanced storage utility with fallbacks
const storage = {
  getItem: (key: string): string | null => {
    try {
      // Try localStorage first
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      // Fallback to sessionStorage
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return window.sessionStorage.getItem(key);
      }
    } catch (error) {
      console.warn('Storage access failed:', error);
    }
    return null;
  },
  
  setItem: (key: string, value: string): boolean => {
    try {
      // Try localStorage first
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return true;
      }
      // Fallback to sessionStorage
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
        return true;
      }
    } catch (error) {
      console.warn('Storage write failed:', error);
    }
    return false;
  },
  
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('Storage removal failed:', error);
    }
  }
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();

  const fetchUser = useCallback(async (retryCount = 0): Promise<User | null> => {
    const maxRetries = 2;
    try {
      const response = await api.get('/auth/me');
      const responseData = response.data.data || response.data;
      // Handle both nested (with .user property) and direct response formats
      const userData = responseData.user || responseData;
      setUser(userData);
      return userData;
    } catch (error) {
      // If it's a network error and we have retries left, try again
      if (retryCount < maxRetries && error instanceof Error && 
          (error.message.includes('Network') || error.message.includes('timeout'))) {
        console.log(`Authentication retry ${retryCount + 1}/${maxRetries}`);
        // Wait briefly before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return fetchUser(retryCount + 1);
      }
      
      // Clear invalid token and reset auth state
      storage.removeItem('accessToken');
      delete api.defaults.headers.common['Authorization'];
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
    // Initialize token from storage and fetch user once on mount
    const initializeAuth = async () => {
      try {
        const token = storage.getItem('accessToken');
        if (token) {
          // Set token in axios headers
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          // Try to fetch user with existing token
          try {
            const userData = await fetchUser();
            if (userData) {
              console.log('Authentication restored from storage');
            }
          } catch {
            // Token is invalid, cleanup already happened in fetchUser
            console.log('Stored token is invalid, user needs to login again');
          }
        } else {
          // No token, user is not authenticated
          setUser(null);
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };
    
    initializeAuth();
  }, [fetchUser]); // Include fetchUser in dependencies since it's used in the effect

  const login = async (username: string, password: string) => {
    const response = await api.post('/auth/login', { username, password });
    const responseData = response.data.data || response.data;
    const { accessToken, user } = responseData;
    
    // Store the token with enhanced storage
    const stored = storage.setItem('accessToken', accessToken);
    if (!stored) {
      console.warn('Failed to store authentication token - session may not persist');
    }
    
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    setUser(user);
    // Don't redirect here - let the calling component handle the redirect
  };

  const register = async (email: string, username: string, password: string, name: string) => {
    const response = await api.post('/auth/register', { 
      email,
      username, 
      password, 
      name
    });
    const responseData = response.data.data || response.data;
    const { accessToken, user } = responseData;
    
    // Store the token with enhanced storage
    const stored = storage.setItem('accessToken', accessToken);
    if (!stored) {
      console.warn('Failed to store authentication token - session may not persist');
    }
    
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
    
    storage.removeItem('accessToken');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    router.push('/auth/signin');
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isInitialized,
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