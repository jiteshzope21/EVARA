import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { UserPlus, AlertCircle, ShieldAlert, Leaf, Sun, Moon, User, Mail, Lock } from 'lucide-react';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const { register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    // Frontend pre-validation adhering to backend constraints
    if (!name.trim()) {
      setFormError('Please enter your name.');
      return;
    }

    if (!email.trim()) {
      setFormError('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    if (password.length > 128) {
      setFormError('Password cannot exceed 128 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setFormError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-10 bg-[#faf9f6] dark:bg-night-950 transition-colors duration-200 relative">
      {/* Top Bar with Theme Switcher */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2.5 text-sage-600 dark:text-sage-300 hover:text-forest-900 dark:hover:text-ivory-100 bg-white dark:bg-night-900 border border-ivory-200 dark:border-night-700/80 rounded-xl shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-forest-500"
          aria-label="Toggle theme"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-forest-700" />}
        </button>
      </div>

      <div className="max-w-md w-full">
        {/* Brand & Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-forest-700 to-forest-900 dark:from-forest-600 dark:to-forest-800 text-ivory-100 shadow-soft mb-3.5">
            <Leaf className="w-6 h-6 text-emerald-300" />
          </div>
          <h1 className="text-2xl font-bold text-forest-950 dark:text-ivory-50 tracking-tight font-display">
            Create an Account
          </h1>
          <p className="text-xs sm:text-sm text-sage-600 dark:text-sage-400 mt-1">
            Join EVARA for reflective wellbeing conversations
          </p>
        </div>

        {/* Academic Non-Clinical Notice */}
        <div className="bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/50 rounded-2xl p-4 text-xs text-amber-900 dark:text-amber-300 mb-6 leading-relaxed shadow-xs">
          <div className="flex items-center space-x-2 font-semibold mb-1">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span>Academic Research Prototype</span>
          </div>
          <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80">
            EVARA is an experimental research system. It does not provide medical services, therapy, or emergency support.
          </p>
        </div>

        {/* Register Card */}
        <div className="bg-white dark:bg-night-900 rounded-2xl shadow-soft border border-ivory-200 dark:border-night-700/70 p-6 sm:p-8 transition-colors duration-200">
          <h2 className="text-base font-semibold text-forest-950 dark:text-ivory-100 mb-4 font-display">
            Register new account
          </h2>

          {formError && (
            <div
              className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-2.5 mb-4"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="register-name" className="block text-xs font-semibold text-sage-700 dark:text-sage-300 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sage-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="register-name"
                  type="text"
                  autoComplete="name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white dark:bg-night-800 text-forest-950 dark:text-ivory-100 border border-ivory-300 dark:border-night-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-500/30 dark:focus:ring-forest-400/30 focus:border-forest-600 dark:focus:border-forest-400 transition-colors disabled:bg-ivory-100 dark:disabled:bg-night-950 disabled:cursor-not-allowed placeholder:text-sage-400"
                  placeholder="Jane Doe"
                />
              </div>
            </div>

            <div>
              <label htmlFor="register-email" className="block text-xs font-semibold text-sage-700 dark:text-sage-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sage-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white dark:bg-night-800 text-forest-950 dark:text-ivory-100 border border-ivory-300 dark:border-night-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-500/30 dark:focus:ring-forest-400/30 focus:border-forest-600 dark:focus:border-forest-400 transition-colors disabled:bg-ivory-100 dark:disabled:bg-night-950 disabled:cursor-not-allowed placeholder:text-sage-400"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="register-password" className="block text-xs font-semibold text-sage-700 dark:text-sage-300 uppercase tracking-wider mb-1.5">
                Password <span className="text-sage-500 dark:text-sage-400 font-normal lowercase">(minimum 8 characters)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sage-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="register-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white dark:bg-night-800 text-forest-950 dark:text-ivory-100 border border-ivory-300 dark:border-night-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-500/30 dark:focus:ring-forest-400/30 focus:border-forest-600 dark:focus:border-forest-400 transition-colors disabled:bg-ivory-100 dark:disabled:bg-night-950 disabled:cursor-not-allowed placeholder:text-sage-400"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-forest-700 to-forest-800 hover:from-forest-800 hover:to-forest-900 text-ivory-50 font-medium text-sm rounded-xl shadow-soft hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-forest-500 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-ivory-100 border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Register</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-ivory-200 dark:border-night-800 text-center text-xs text-sage-600 dark:text-sage-400">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-forest-700 dark:text-emerald-400 hover:text-forest-900 dark:hover:text-emerald-300 transition-colors">
              Log in instead
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

