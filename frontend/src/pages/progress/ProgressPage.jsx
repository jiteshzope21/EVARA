import React, { useState, useEffect, useCallback } from 'react';
import progressService from '../../services/progressService';
import { getErrorMessage } from '../../services/api';
import {
  TrendingUp,
  CheckCircle2,
  Calendar,
  RefreshCw,
  AlertCircle,
  Clock,
  ShieldAlert,
  Flame,
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
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 rounded-md animate-pulse"></div>
          <div className="h-4 w-72 bg-slate-100 rounded-md animate-pulse"></div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs h-40 animate-pulse"></div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs h-64 animate-pulse"></div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs h-64 animate-pulse"></div>
        </div>
      </div>
    );
  }

  // Error state with retry
  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-rose-200 shadow-xs p-6 md:p-8 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-200">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Unable to load progress data</h2>
          <p className="text-sm text-slate-600 mb-6">{error}</p>
          <button
            type="button"
            onClick={() => fetchProgress()}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  // Plan distribution chart data
  const planDistributionData = [
    { name: 'Completed', count: data?.completed_plans || 0, color: '#10b981' },
    { name: 'Pending', count: data?.pending_plans || 0, color: '#0284c7' },
    { name: 'Cancelled', count: data?.cancelled_plans || 0, color: '#94a3b8' },
  ];

  // Conversation progress chart data (defensively guarding against negative active count)
  const totalConversations = data?.total_conversations || 0;
  const completedConversations = data?.completed_conversations || 0;
  const activeConversations = Math.max(0, totalConversations - completedConversations);

  const conversationProgressData = [
    { name: 'Completed', count: completedConversations, color: '#10b981' },
    { name: 'In Progress', count: activeConversations, color: '#0284c7' },
  ];

  const completionPercentage = data?.completion_percentage || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Progress Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Reflection engagement, commitment follow-through, and session milestones.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchProgress(true)}
          disabled={refreshing}
          className="self-start sm:self-auto flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label="Refresh progress metrics"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Non-Clinical Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-amber-800 leading-relaxed">
        <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold">Academic Reflection Context:</strong> Progress analytics reflect self-reported commitments and completed reflection dialogues. These indicators are not clinical efficacy measures.
        </div>
      </div>

      {/* Completion Overview Hero Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Completion Rate Gauge */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Plan Completion Rate
              </span>
              <span className="text-xl font-bold text-slate-900">{completionPercentage}%</span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden">
              <div
                className="bg-brand-600 h-3.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, completionPercentage))}%` }}
              ></div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Calculated over actionable commitments ({data?.completed_plans || 0} completed of{' '}
              {(data?.completed_plans || 0) + (data?.pending_plans || 0)} actionable). Cancelled items ({data?.cancelled_plans || 0}) are excluded from the denominator.
            </p>
          </div>

          {/* 7-Day Velocity Metric */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center space-x-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Completed Past 7 Days</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">
                {data?.plans_completed_last_7_days || 0}
              </p>
              <p className="text-[11px] text-slate-400">Recent commitment activity</p>
            </div>
          </div>
        </div>
      </div>

      {/* Visualizations Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Action Plan Status Breakdown */}
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-800">Action Plan Breakdown</h2>
            <p className="text-xs text-slate-500">Commitment statuses across all planned items</p>
          </div>

          <div className="flex-1 min-h-[220px] flex items-center justify-center">
            {(data?.total_plans || 0) > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={planDistributionData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value) => [`${value} plans`, 'Count']}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {planDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center p-6 text-slate-400 text-xs">
                <Clock className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p>No action plans created yet.</p>
                <p className="mt-0.5 text-[11px]">Commitments from reflection sessions will appear here.</p>
              </div>
            )}
          </div>
        </div>

        {/* Conversation Progress */}
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-800">Conversation Sessions</h2>
            <p className="text-xs text-slate-500">Completed reflections vs sessions currently active</p>
          </div>

          <div className="flex-1 min-h-[220px] flex items-center justify-center">
            {totalConversations > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={conversationProgressData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value) => [`${value} sessions`, 'Count']}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {conversationProgressData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center p-6 text-slate-400 text-xs">
                <TrendingUp className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p>No conversation sessions created yet.</p>
                <p className="mt-0.5 text-[11px]">Begin a dialogue to track your progress milestones.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Completed Plans */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-800">Recent Completed Commitments</h2>
          <span className="text-xs text-slate-400">Up to 5 latest achievements</span>
        </div>

        {(data?.recent_completed_plans || []).length > 0 ? (
          <div className="divide-y divide-slate-100">
            {data.recent_completed_plans.map((plan) => (
              <div key={plan.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">{plan.action}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Completed: {new Date(plan.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0 text-right">
                  <span className="text-[11px] text-slate-500">
                    {plan.date ? `Target: ${plan.date}` : 'Flexible timing'}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                    Completed
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs">
            <Clock className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p>No completed plans yet.</p>
            <p className="mt-0.5 text-[11px]">When you finish actionable commitments, they will be celebrated here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
