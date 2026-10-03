import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import dashboardService from '../../services/dashboardService';
import { getErrorMessage } from '../../services/api';
import {
  MessageSquare,
  CheckSquare,
  FileText,
  Calendar,
  RefreshCw,
  AlertCircle,
  Clock,
  Sparkles,
  ShieldAlert,
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

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await dashboardService.getDashboard();
      setData(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Loading skeleton state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="h-7 w-48 bg-slate-200 rounded-md animate-pulse"></div>
            <div className="h-4 w-72 bg-slate-100 rounded-md animate-pulse"></div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="h-4 w-28 bg-slate-100 rounded animate-pulse"></div>
              <div className="h-8 w-16 bg-slate-200 rounded animate-pulse"></div>
              <div className="h-3 w-36 bg-slate-100 rounded animate-pulse"></div>
            </div>
          ))}
        </div>

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
          <h2 className="text-lg font-bold text-slate-800 mb-2">Unable to load dashboard</h2>
          <p className="text-sm text-slate-600 mb-6">{error}</p>
          <button
            type="button"
            onClick={() => fetchDashboard()}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  // Formatting chart data safely
  const sentimentTrend = data?.sentiment_trend || { positive: 0, negative: 0, neutral: 0 };
  const sentimentChartData = [
    { name: 'Positive', count: sentimentTrend.positive || 0, color: '#10b981' },
    { name: 'Neutral', count: sentimentTrend.neutral || 0, color: '#64748b' },
    { name: 'Negative', count: sentimentTrend.negative || 0, color: '#f43f5e' },
  ];
  const totalSentimentSignals =
    (sentimentTrend.positive || 0) + (sentimentTrend.negative || 0) + (sentimentTrend.neutral || 0);

  const topThemesData = (data?.top_themes || []).map((t) => ({
    theme: t.theme.replace(/_/g, ' '),
    count: t.count,
  }));

  const isOverallEmpty = (data?.conversation_count || 0) === 0 && (data?.pending_plan_count || 0) === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Welcome, <span className="font-semibold text-slate-800">{user?.name || 'User'}</span>. Academic wellbeing-support overview.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchDashboard(true)}
          disabled={refreshing}
          className="self-start sm:self-auto flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label="Refresh dashboard metrics"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Non-Clinical Prototype Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-amber-800 leading-relaxed">
        <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold">Academic Prototype Notice:</strong> Metrics, themes, and sentiment summaries are deterministic derivations of your reflection sessions. EVARA does not diagnose or provide clinical health evaluations.
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Conversations */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Conversations
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{data?.conversation_count || 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {data?.active_conversation_count || 0} active · {data?.completed_conversation_count || 0} completed
            </p>
          </div>
        </div>

        {/* Card 2: Action Plans */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Plans
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{data?.pending_plan_count || 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {data?.completed_plan_count || 0} completed · {data?.cancelled_plan_count || 0} cancelled
            </p>
          </div>
        </div>

        {/* Card 3: Recent Reports */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Reflection Reports
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{data?.recent_reports?.length || 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">Generated wellbeing summaries</p>
          </div>
        </div>

        {/* Card 4: Active Commitments */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Plans
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">{data?.active_plans?.length || 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">Self-directed action commitments</p>
          </div>
        </div>
      </div>

      {/* Visualizations Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sentiment Distribution */}
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-800">Conversation Sentiment Distribution</h2>
            <p className="text-xs text-slate-500">Aggregate sentiment frequency from analyzed sessions</p>
          </div>

          <div className="flex-1 min-h-[220px] flex items-center justify-center">
            {totalSentimentSignals > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sentimentChartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value) => [`${value} instances`, 'Occurrences']}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {sentimentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center p-6 text-slate-400 text-xs">
                <Clock className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p>No analyzed sentiments recorded yet.</p>
                <p className="mt-0.5 text-[11px]">Start a conversation to generate sentiment insights.</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Discussion Themes */}
        <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-800">Top Reflection Themes</h2>
            <p className="text-xs text-slate-500">Frequent topics identified across conversation analyses</p>
          </div>

          <div className="flex-1 min-h-[220px] flex items-center justify-center">
            {topThemesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={topThemesData}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                >
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis type="category" dataKey="theme" width={110} tick={{ fontSize: 11 }} stroke="#64748b" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value) => [`${value} matches`, 'Frequency']}
                  />
                  <Bar dataKey="count" fill="#0284c7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center p-6 text-slate-400 text-xs">
                <Sparkles className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p>No discussion themes identified yet.</p>
                <p className="mt-0.5 text-[11px]">Themes will appear as you explore challenges in conversations.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Lists (2 columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Conversations */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800">Recent Conversations</h2>
            <span className="text-xs text-slate-400">Up to 5 latest</span>
          </div>

          {(data?.recent_conversations || []).length > 0 ? (
            <div className="divide-y divide-slate-100">
              {data.recent_conversations.map((conv) => (
                <div key={conv.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">{conv.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Updated {new Date(conv.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded">
                      {conv.stage.replace(/_/g, ' ')}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                        conv.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-sky-50 text-sky-700 border border-sky-200'
                      }`}
                    >
                      {conv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-6">No conversations created yet.</p>
          )}
        </div>

        {/* Active Plans */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800">Active Commitments</h2>
            <span className="text-xs text-slate-400">Pending next steps</span>
          </div>

          {(data?.active_plans || []).length > 0 ? (
            <div className="divide-y divide-slate-100">
              {data.active_plans.map((plan) => (
                <div key={plan.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">{plan.action}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Target: {plan.date || 'No target date'}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded flex-shrink-0">
                    {plan.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-6">No active plans scheduled.</p>
          )}
        </div>
      </div>

      {/* Recent Reports Overview (if any reports exist) */}
      {(data?.recent_reports || []).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 md:p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-3">Recent Wellbeing Reports</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {data.recent_reports.map((report) => (
              <div key={report.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 capitalize">
                    {report.dominant_emotion || 'Neutral'}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                      report.safety_level === 'urgent'
                        ? 'bg-rose-100 text-rose-700'
                        : report.safety_level === 'elevated_concern'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {report.safety_level.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Sentiment: <strong className="capitalize">{report.dominant_sentiment}</strong>
                </p>
                <p className="text-[10px] text-slate-400">
                  {new Date(report.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overall Empty State Prompt */}
      {isOverallEmpty && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
          <p className="font-semibold text-slate-700 mb-1">Welcome to your reflection space</p>
          <p>You have not created any conversations or commitments yet. Explore the navigation to start your first session.</p>
        </div>
      )}
    </div>
  );
}
