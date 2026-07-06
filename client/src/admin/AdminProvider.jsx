import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../lib/api';

const AdminContext = createContext(null);

export function AdminProvider({ children, user }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch the full admin state from the server
  const fetchState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/admin/state');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error ${res.status}`);
      }
      const data = await res.json();
      setState(data);
    } catch (err) {
      setError(err.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const toggleUserStatus = async (userId) => {
    const res = await apiFetch(`/api/admin/users/${userId}/toggle-status`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to toggle user status');
    const data = await res.json();
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        String(u.id) === String(userId) ? { ...u, status: data.status } : u,
      ),
    }));
  };

  const promoteUser = async (userId, plan) => {
    const res = await apiFetch(`/api/admin/users/${userId}/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    if (!res.ok) throw new Error('Failed to promote user');
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        String(u.id) === String(userId) ? { ...u, plan } : u,
      ),
    }));
  };

  const deleteUser = async (userId) => {
    const res = await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete user');
    setState((prev) => ({
      ...prev,
      users: prev.users.filter((u) => String(u.id) !== String(userId)),
    }));
  };

  const updateDocumentStatus = async (docId, status) => {
    const res = await apiFetch(`/api/admin/documents/${docId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update document status');
    setState((prev) => ({
      ...prev,
      documents: prev.documents.map((d) =>
        String(d.id) === String(docId) ? { ...d, status } : d,
      ),
    }));
  };

  const deleteDocument = async (docId) => {
    const res = await apiFetch(`/api/admin/documents/${docId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete document');
    setState((prev) => ({
      ...prev,
      documents: prev.documents.filter((d) => String(d.id) !== String(docId)),
    }));
  };

  const updateSetting = async (key, value) => {
    // Optimistic update
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, [key]: value },
    }));
    const res = await apiFetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
    if (!res.ok) {
      // Rollback on failure – refetch
      await fetchState();
      throw new Error('Failed to save setting');
    }
  };

  const saveSettings = async (settingsObj) => {
    const res = await apiFetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsObj),
    });
    if (!res.ok) throw new Error('Failed to save settings');
    const data = await res.json();
    setState((prev) => ({ ...prev, settings: data.settings }));
  };

  const contextValue = {
    state,
    loading,
    error,
    user,
    actions: {
      toggleUserStatus,
      promoteUser,
      deleteUser,
      updateDocumentStatus,
      deleteDocument,
      updateSetting,
      saveSettings,
      refresh: fetchState,
    },
  };

  return <AdminContext.Provider value={contextValue}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used inside AdminProvider');
  }
  return context;
}
