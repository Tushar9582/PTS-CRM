
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface AuthLayoutProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'agent' | 'any';
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  requiredRole = 'any'
}) => {
  const { isAuthenticated, isAdmin, isAgent } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole === 'admin' && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requiredRole === 'agent' && !isAgent) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default AuthLayout;
