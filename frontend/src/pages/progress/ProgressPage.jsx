import React, { useState, useEffect, useCallback } from 'react';
import progressService from '../../services/progressService';
import { getErrorMessage } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import {
  TrendingUp,
  CheckCircle2,
  Calendar,
  RefreshCw,
  AlertCircle,
  Clock,
  ShieldAlert,
  Flame,
  Award,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';

export default function ProgressPage() {
  const { isDark } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchProgress = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await progressService.getProgress();
      setData(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  // Loading skeleton state
  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-stone-200 dark:bg-night-800 rounded-lg animate-pulse"></div>
          <div className="h-4 w-72 bg-stone-100 dark:bg-night-800/60 rounded-lg animate-pulse"></div>
        </div>

        <div className="bg-white dark:bg-night-900 p-6 rounded-2xl border border-stone-200/80 dark:border-night-800 shadow-xs h-44 animate-pulse"></div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-night-900 p-6 rounded-2xl border border-stone-200/80 dark:border-night-800 shadow-xs h-72 animate-pulse"></div>
          <div className="bg-white dark:bg-night-900 p-6 rounded-2xl border border-stone-200/80 dark:border-night-800 shadow-xs h-72 animate-pulse"></div>
        </div>
      </div>
    );
  }

  // Error state with retry
  if (error) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="bg-white dark:bg-night-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-xs p-8 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-900/60">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-2">Unable to load progress data</h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 mb-6">{error}</p>
          <button
            type="button"
            onClick={() => fetchProgress()}
            className="px-5 py-2.5 bg-forest-700 hover:bg-forest-800 dark:bg-forest-600 dark:hover:bg-forest-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  // Colors tailored for theme
  const colorForest = isDark ? '#468b64' : '#234a36';
  const colorSage = isDark ? '#6fa588' : '#477c60';
  const colorNeutral = isDark ? '#44403c' : '#a8a29e';

  // Plan distribution chart data
  const planDistributionData = [
    { name: 'Completed', count: data?.completed_plans || 0, color: colorForest },
    { name: 'Pending', count: data?.pending_plans || 0, color: colorSage },
    { name: 'Cancelled', count: data?.cancelled_plans || 0, color: colorNeutral },
  ];

  // Conversation progress chart data (defensively guarding against negative active count)
  const totalConversations = data?.total_conversations || 0;
  const completedConversations = data?.completed_conversations || 0;
  const activeConversations = Math.max(0, totalConversations - completedConversations);

  const conversationProgressData = [
    { name: 'Completed', count: completedConversations, color: colorForest },
    { name: 'In Progress', count: activeConversations, color: colorSage },
  ];

  const completionPercentage = data?.completion_percentage || 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
              Progress Analytics
            </h1>
            <span className="text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-forest-50 dark:bg-forest-900/40 text-forest-700 dark:text-forest-300 border border-forest-200/80 dark:border-forest-800">
              Personal Journey
            </span>
          </div>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Reflection engagement, commitment follow-through, and dialogue milestones.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchProgress(true)}
          disabled={refreshing}
          className="self-start sm:self-auto flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-stone-700 dark:text-stone-200 bg-white hover:bg-stone-50 dark:bg-night-900 dark:hover:bg-night-800 border border-stone-200 dark:border-night-700 rounded-xl shadow-2xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Refresh progress metrics"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Non-Clinical Notice */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 flex items-start space-x-3 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
        <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold">Academic Reflection Context:</strong> Progress analytics reflect self-reported commitments and completed reflection dialogues. These indicators are personal reflective milestones, not clinical efficacy measures.
        </div>
      </div>

      {/* Completion Overview Hero Card */}
      <div className="bg-white dark:bg-night-900 rounded-2xl border border-stone-200/80 dark:border-night-800 shadow-xs p-6 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Completion Rate Gauge */}
          <div className="md:col-span-2 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Plan Completion Rate
              </span>
              <span className="text-2xl font-extrabold text-forest-700 dark:text-forest-400">
                {completionPercentage}%
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-stone-100 dark:bg-night-800 rounded-full h-3.5 overflow-hidden">
              <div
                className="bg-forest-600 dark:bg-forest-500 h-3.5 rounded-full transition-all duration-700 ease-out shadow-xs"
                style={{ width: `${Math.min(100, Math.max(0, completionPercentage))}%` }}
              ></div>
            </div>

            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
              Calculated over actionable commitments (<strong className="text-stone-700 dark:text-stone-300">{data?.completed_plans || 0} completed</strong> of{' '}
              {(data?.completed_plans || 0) + (data?.pending_plans || 0)} actionable). Cancelled items ({data?.cancelled_plans || 0}) are excluded from the denominator.
            </p>
          </div>

          {/* 7-Day Velocity Metric */}
          <div className="bg-stone-50 dark:bg-night-800/60 border border-stone-200/60 dark:border-night-700 rounded-2xl p-5 flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-forest-100 dark:bg-forest-900/60 text-forest-700 dark:text-forest-300 flex items-center justify-center flex-shrink-0">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-stone-500 dark:text-stone-400">Past 7 Days</p>
              <p className="text-2xl font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                {data?.plans_completed_last_7_days || 0}
              </p>
              <p className="text-[11px] text-forest-700 dark:text-forest-400 font-medium">Completed commitments</p>
            </div>
          </div>
        </div>
      </div>

      {/* Visualizations Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Action Plan Status Breakdown */}
        <div className="bg-white dark:bg-night-900 p-6 rounded-2xl border border-stone-200/80 dark:border-night-800 shadow-xs flex flex-col">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">Action Plan Breakdown</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">Commitment statuses across all planned items</p>
          </div>

          <div className="flex-1 min-h-[220px] flex items-center justify-center">
            {(data?.total_plans || 0) > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={planDistributionData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: isDark ? '#a8a29e' : '#57534e' }}
                    stroke={isDark ? '#292524' : '#e7e5e4'}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: isDark ? '#a8a29e' : '#57534e' }}
                    stroke={isDark ? '#292524' : '#e7e5e4'}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#151d19' : '#ffffff',
                      borderColor: isDark ? '#29352e' : '#e7e5e4',
                      color: isDark ? '#f5f5f4' : '#1c1917',
                      borderRadius: '12px',
                      fontSize: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                    formatter={(value) => [`${value} plans`, 'Count']}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {planDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center p-6 text-stone-400 dark:text-stone-500 text-xs">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="font-medium">No action plans created yet.</p>
                <p className="mt-0.5 text-[11px]">Commitments from reflection sessions will appear here.</p>
              </div>
            )}
          </div>
        </div>

        {/* Conversation Progress */}
        <div className="bg-white dark:bg-night-900 p-6 rounded-2xl border border-stone-200/80 dark:border-night-800 shadow-xs flex flex-col">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">Conversation Sessions</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">Completed reflections vs sessions currently active</p>
          </div>

          <div className="flex-1 min-h-[220px] flex items-center justify-center">
            {totalConversations > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={conversationProgressData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: isDark ? '#a8a29e' : '#57534e' }}
                    stroke={isDark ? '#292524' : '#e7e5e4'}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: isDark ? '#a8a29e' : '#57534e' }}
                    stroke={isDark ? '#292524' : '#e7e5e4'}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#151d19' : '#ffffff',
                      borderColor: isDark ? '#29352e' : '#e7e5e4',
                      color: isDark ? '#f5f5f4' : '#1c1917',
                      borderRadius: '12px',
                      fontSize: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                    formatter={(value) => [`${value} sessions`, 'Count']}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {conversationProgressData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center p-6 text-stone-400 dark:text-stone-500 text-xs">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="font-medium">No conversation sessions created yet.</p>
                <p className="mt-0.5 text-[11px]">Begin a dialogue to track your progress milestones.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Completed Plans */}
      <div className="bg-white dark:bg-night-900 rounded-2xl border border-stone-200/80 dark:border-night-800 shadow-xs p-6 md:p-7">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">Recent Completed Commitments</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Up to 5 latest achievements</p>
          </div>
          <Award className="w-5 h-5 text-forest-600 dark:text-forest-400" />
        </div>

        {(data?.recent_completed_plans || []).length > 0 ? (
          <div className="divide-y divide-stone-100 dark:divide-night-800">
            {data.recent_completed_plans.map((plan) => (
              <div key={plan.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-xl bg-forest-50 dark:bg-forest-900/40 text-forest-700 dark:text-forest-300 border border-forest-200/60 dark:border-forest-800 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">{plan.action}</p>
                    <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">
                      Completed: {new Date(plan.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0 text-right">
                  <span className="text-[11px] text-stone-500 dark:text-stone-400">
                    {plan.date ? `Target: ${plan.date}` : 'Flexible timing'}
                  </span>
                  <span className="px-2.5 py-0.5 text-[10px] font-semibold bg-forest-50 dark:bg-forest-900/40 text-forest-700 dark:text-forest-300 border border-forest-200/80 dark:border-forest-800 rounded-md">
                    Completed
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-stone-400 dark:text-stone-500 text-xs">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="font-medium">No completed plans yet.</p>
            <p className="mt-0.5 text-[11px]">When you finish actionable commitments, they will be celebrated here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
