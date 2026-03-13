import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useAppData } from './useAppData';

export function useAppStore() {
  const { authToken, currentUser, handleLogin, handleLogout } = useAuth();
  const data = useAppData(authToken, currentUser, handleLogout);
  const [activeTab, setActiveTab] = useState('clips');

  // Add plaque management to the store
  const addPlaque = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/plaques', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData
      });
      if (res.ok) {
        data.fetchData();
        (e.target as HTMLFormElement).reset();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deletePlaque = async (id: string) => {
    if (!confirm('Удалить эту плашку?')) return;
    try {
      const res = await fetch(`/api/plaques/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) data.fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return {
    authToken,
    setAuthToken: handleLogin,
    currentUser,
    activeTab,
    setActiveTab,
    ...data,
    updateData: data.fetchData,
    handleLogout,
    addPlaque,
    deletePlaque
  };
}
