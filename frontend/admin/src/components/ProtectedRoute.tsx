import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const ProtectedRoute: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  if (!isAuthenticated || !user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
