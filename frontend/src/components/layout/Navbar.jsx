import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, Menu, User as UserIcon, ShieldAlert } from 'lucide-react';

export default function Navbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Left: Mobile Toggle & Brand */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
              E
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 tracking-tight">EVARA</span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium text-slate-400">
                Wellbeing Support &amp; Reflection
              </span>
            </div>
          </div>
        </div>

        {/* Center: Non-Clinical Badge (Desktop/Tablet) */}
        <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-medium text-amber-800">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <span>Academic Prototype — Non-Clinical System</span>
        </div>

        {/* Right: User Profile & Logout */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="flex items-center space-x-2 text-right">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center flex-shrink-0">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-slate-800 leading-none truncate max-w-[140px]">
                {user?.name || 'User'}
              </p>
              <p className="text-[11px] text-slate-400 leading-tight truncate max-w-[140px]">
                {user?.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-700 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500"
            aria-label="Log out of application"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
