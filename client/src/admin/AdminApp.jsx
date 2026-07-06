import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { AdminProvider } from './AdminProvider';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUsagePage from './pages/AdminUsagePage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminDocumentsPage from './pages/AdminDocumentsPage';
import AdminSubscriptionsPage from './pages/AdminSubscriptionsPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import AdminApiPage from './pages/AdminApiPage';
import AdminAuditPage from './pages/AdminAuditPage';

export default function AdminApp({ user, token }) {
  // No token at all → send to login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but not an admin → send to main app
  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <AdminProvider user={user}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="usage" element={<AdminUsagePage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="documents" element={<AdminDocumentsPage />} />
          <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="api" element={<AdminApiPage />} />
          <Route path="audit" element={<AdminAuditPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminProvider>
  );
}
