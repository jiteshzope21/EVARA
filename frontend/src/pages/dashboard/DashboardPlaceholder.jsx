import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User, ShieldCheck } from 'lucide-react';

export default function DashboardPlaceholder() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Minimal Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500 text-white font-bold flex items-center justify-center text-sm shadow-sm">
            E
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800">EVARA</h1>
            <p className="text-xs text-slate-400">Phase 6 Step 2 — Authenticated Session</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-slate-700">{user?.name || 'User'}</p>
            <p className="text-xs text-slate-400">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-10">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
            <ShieldCheck className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-bold text-slate-800 mb-2">Authentication Verified</h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
            You are successfully authenticated as <span className="font-semibold text-slate-800">{user?.name}</span> ({user?.email}).
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-left max-w-lg mx-auto text-xs text-slate-600 space-y-1.5 mb-6">
            <p><strong>Session ID:</strong> {user?.id}</p>
            <p><strong>Token Type:</strong> Bearer (JWT stored securely in localStorage)</p>
            <p><strong>Account Created:</strong> {user?.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 text-left max-w-lg mx-auto leading-relaxed">
            <strong>Non-Clinical Notice:</strong> EVARA is an academic reflection and wellbeing prototype. Full dashboard, conversations, and SLM modules will be integrated in subsequent Phase 6 steps.
          </div>
        </div>
      </main>
    </div>
  );
}
