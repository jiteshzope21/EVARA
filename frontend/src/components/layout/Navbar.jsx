import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { LogOut, Menu, User as UserIcon, ShieldAlert, Sun, Moon, Leaf } from 'lucide-react';

export default function Navbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="bg-white/90 dark:bg-night-900/90 backdrop-blur-md border-b border-ivory-200 dark:border-night-700/60 sticky top-0 z-30 transition-colors duration-200">
      <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Left: Mobile Toggle & Brand */}
        <div className="flex items-center space-x-3.5">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden p-2 text-sage-600 dark:text-sage-300 hover:text-forest-800 dark:hover:text-white hover:bg-forest-50 dark:hover:bg-night-800 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-forest-500"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-forest-700 to-forest-900 dark:from-forest-600 dark:to-forest-800 text-ivory-100 flex items-center justify-center shadow-soft">
              <Leaf className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-base font-bold text-forest-950 dark:text-ivory-50 tracking-tight font-display">
                  EVARA
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold bg-forest-100 dark:bg-forest-950 text-forest-800 dark:text-forest-300 rounded-md border border-forest-200 dark:border-forest-800/80">
                  AI
                </span>
              </div>
              <p className="hidden sm:block text-[11px] font-medium text-sage-600 dark:text-sage-400">
                Wellbeing &amp; Reflection Prototype
              </p>
            </div>
          </div>
        </div>

        {/* Center: Non-Clinical Badge (Desktop/Tablet) */}
        <div className="hidden lg:flex items-center space-x-2 px-3.5 py-1 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/50 rounded-full text-xs font-medium text-amber-900 dark:text-amber-300 shadow-xs">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span>Academic Research Prototype — Non-Clinical System</span>
        </div>

        {/* Right: Theme Toggle, User Profile & Logout */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Theme Switcher Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 text-sage-600 dark:text-sage-300 hover:text-forest-900 dark:hover:text-ivory-100 hover:bg-forest-50 dark:hover:bg-night-800 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-forest-500"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle visual theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-forest-700 transition-transform duration-300 rotate-0 hover:-rotate-12" />
            )}
          </button>

          {/* User Profile Chip */}
          <div className="flex items-center space-x-2.5 px-2.5 py-1 bg-ivory-100 dark:bg-night-800/90 border border-ivory-200 dark:border-night-700 rounded-xl">
            <div className="w-7 h-7 rounded-lg bg-forest-600 dark:bg-forest-700 text-ivory-50 flex items-center justify-center font-semibold text-xs shadow-xs">
              {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-forest-950 dark:text-ivory-100 leading-none truncate max-w-[130px]">
                {user?.name || 'User'}
              </p>
              <p className="text-[10px] text-sage-600 dark:text-sage-400 leading-tight truncate max-w-[130px] mt-0.5">
                {user?.email}
              </p>
            </div>
          </div>

          {/* Logout Button */}
          <button
            type="button"
            onClick={logout}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-sage-700 dark:text-sage-300 hover:text-rose-700 dark:hover:text-rose-300 bg-white dark:bg-night-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-ivory-200 dark:border-night-700 hover:border-rose-200 dark:hover:border-rose-900 rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-rose-500"
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

