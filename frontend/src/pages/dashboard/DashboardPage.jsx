import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Clock } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Welcome back, {user?.name || 'User'}. Here is your wellbeing overview.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 md:p-8 text-center">
        <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center mx-auto mb-4 border border-brand-100">
          <LayoutDashboard className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Dashboard Overview</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto mb-4">
          The full dashboard metrics, recent conversations, active plans, and sentiment trends will be integrated in Phase 6 Step 4.
        </p>
        <div className="inline-flex items-center space-x-2 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
          <Clock className="w-3.5 h-3.5" />
          <span>Scheduled for Step 4 Implementation</span>
        </div>
      </div>
    </div>
  );
}
