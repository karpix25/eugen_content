import { useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import { User } from '../types';

export function useAuth() {
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const handleLogin = useCallback((token: string, user: User) => {
    setAuthToken(token);
    setCurrentUser(user);
    localStorage.setItem('auth_token', token);
  }, []);

  const handleLogout = useCallback(() => {
    setAuthToken(null);
    setCurrentUser(null);
    localStorage.removeItem('auth_token');
  }, []);

  const verifyAuth = useCallback(async () => {
    if (!authToken) {
      setIsAuthChecking(false);
      return;
    }
    try {
      const data = await api.auth.verify();
      if (data && data.user) {
        setCurrentUser(data.user);
      } else {
        handleLogout();
      }
    } catch (err) {
      console.error("Auth verification failed", err);
      handleLogout();
    } finally {
      setIsAuthChecking(false);
    }
  }, [authToken, handleLogout]);

  useEffect(() => {
    verifyAuth();
  }, []);

  return {
    authToken,
    currentUser,
    isAuthChecking,
    setIsAuthChecking,
    handleLogin,
    handleLogout
  };
}
