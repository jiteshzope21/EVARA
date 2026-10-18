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
  ShieldAlert,
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
    <div className="flex flex-col h-full bg-white dark:bg-night-900 border-r border-ivory-200 dark:border-night-700/60 w-64 transition-colors duration-200">
      {/* Mobile Drawer Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-ivory-200 dark:border-night-700/60">
        <span className="font-bold text-forest-950 dark:text-ivory-50 text-sm font-display">Navigation</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-sage-500 hover:text-forest-900 dark:hover:text-ivory-100 rounded-xl hover:bg-forest-50 dark:hover:bg-night-800 focus:outline-none focus:ring-2 focus:ring-forest-500"
          aria-label="Close navigation sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Main Navigation">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-sage-500 dark:text-sage-400">
          Workspaces
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-forest-50 dark:bg-forest-950/70 text-forest-800 dark:text-emerald-300 font-semibold shadow-xs border-l-3 border-forest-600 dark:border-forest-400'
                    : 'text-sage-700 dark:text-sage-300 hover:bg-forest-50/50 dark:hover:bg-night-800/80 hover:text-forest-950 dark:hover:text-ivory-100'
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
      <div className="p-4 border-t border-ivory-200 dark:border-night-700/60 bg-ivory-50/70 dark:bg-night-950/50">
        <div className="flex items-start space-x-2 text-[11px] text-sage-600 dark:text-sage-400 leading-relaxed">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600/80 dark:text-amber-400/80 flex-shrink-0 mt-0.5" />
          <p>
            Academic wellbeing prototype. Built for student self-reflection and LMTA research.
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
            className="fixed inset-0 bg-night-950/50 backdrop-blur-xs transition-opacity duration-200"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-night-900 z-50 shadow-soft-lg animate-in slide-in-from-left duration-200">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}

