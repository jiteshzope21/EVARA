import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#faf9f6] dark:bg-night-950 transition-colors">
        <div className="w-9 h-9 border-3 border-forest-600 dark:border-forest-400 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Loading EVARA...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children ? children : <Outlet />;
}
