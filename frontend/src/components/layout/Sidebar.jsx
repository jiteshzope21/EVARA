import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  CheckSquare,
  TrendingUp,
  FileText,
  Sparkles,
  X,
  Info,
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Conversations', path: '/conversations', icon: MessageSquare },
  { name: 'Planner', path: '/planner', icon: CheckSquare },
  { name: 'Progress', path: '/progress', icon: TrendingUp },
  { name: 'Reports', path: '/reports', icon: FileText },
  { name: 'Analysis', path: '/analysis', icon: Sparkles },
];

export default function Sidebar({ isOpen, onClose }) {
  const navContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-64">
      {/* Mobile Drawer Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-100">
        <span className="font-bold text-slate-800 text-sm">Navigation</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-label="Close navigation sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main Navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Sidebar Footer Disclaimer */}
      <div className="p-4 border-t border-slate-100 bg-slate-50">
        <div className="flex items-start space-x-2 text-[11px] text-slate-500 leading-tight">
          <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
          <p>
            EVARA is an academic wellbeing companion. Not intended for clinical or emergency use.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:block w-64 flex-shrink-0 h-[calc(100vh-4rem)] sticky top-16">
        {navContent}
      </aside>

      {/* Mobile Drawer (Modal Slide-over) */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white z-50 shadow-xl">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
