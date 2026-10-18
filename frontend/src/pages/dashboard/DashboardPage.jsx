import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
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
  ArrowUpRight,
  TrendingUp,
  Smile,
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
  const { isDark } = useTheme();
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
      <div className="space-y-6 animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="h-7 w-48 bg-ivory-200 dark:bg-night-800 rounded-lg"></div>
            <div className="h-4 w-72 bg-ivory-100 dark:bg-night-850 rounded-lg"></div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-night-900 p-5 rounded-2xl border border-ivory-200 dark:border-night-700/60 shadow-xs space-y-3">
              <div className="h-4 w-28 bg-ivory-100 dark:bg-night-800 rounded"></div>
              <div className="h-8 w-16 bg-ivory-200 dark:bg-night-750 rounded"></div>
              <div className="h-3 w-36 bg-ivory-100 dark:bg-night-800 rounded"></div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-night-900 p-6 rounded-2xl border border-ivory-200 dark:border-night-700/60 shadow-xs h-64"></div>
          <div className="bg-white dark:bg-night-900 p-6 rounded-2xl border border-ivory-200 dark:border-night-700/60 shadow-xs h-64"></div>
        </div>
      </div>
    );
  }

  // Error state with retry
  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-night-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-soft p-6 md:p-8 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-900/50">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-forest-950 dark:text-ivory-50 mb-2 font-display">
            Unable to load dashboard
          </h2>
          <p className="text-sm text-sage-600 dark:text-sage-400 mb-6">{error}</p>
          <button
            type="button"
            onClick={() => fetchDashboard()}
            className="px-4 py-2.5 bg-forest-700 hover:bg-forest-800 text-ivory-50 text-sm font-medium rounded-xl shadow-soft transition-colors focus:outline-none focus:ring-2 focus:ring-forest-500"
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

  // Chart text colors based on theme
  const tickStroke = isDark ? '#7d8e85' : '#71886e';
  const tooltipBg = isDark ? '#1a231e' : '#ffffff';
  const tooltipBorder = isDark ? '#293730' : '#e6e9e6';
  const tooltipText = isDark ? '#ecf2ee' : '#192720';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-forest-950 dark:text-ivory-50 tracking-tight font-display">
              Dashboard
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-forest-100 dark:bg-forest-950/80 text-forest-800 dark:text-emerald-300 rounded-md border border-forest-200 dark:border-forest-800">
              Overview
            </span>
          </div>
          <p className="text-sm text-sage-600 dark:text-sage-400 mt-1">
            Welcome back, <span className="font-semibold text-forest-900 dark:text-ivory-200">{user?.name || 'User'}</span>. Academic wellbeing-support overview.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchDashboard(true)}
          disabled={refreshing}
          className="self-start sm:self-auto flex items-center space-x-2 px-3.5 py-2 text-xs font-medium text-sage-700 dark:text-sage-300 hover:text-forest-900 dark:hover:text-ivory-100 bg-white dark:bg-night-900 hover:bg-forest-50/50 dark:hover:bg-night-800 border border-ivory-200 dark:border-night-700/80 rounded-xl shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-forest-500 disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label="Refresh dashboard metrics"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-forest-600' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Non-Clinical Prototype Banner */}
      <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl p-4 flex items-start space-x-3 text-xs text-amber-900 dark:text-amber-300 leading-relaxed shadow-xs">
        <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold">Academic Prototype Notice:</strong> Metrics, themes, and sentiment summaries are deterministic derivations of your reflection sessions. EVARA does not diagnose or provide clinical health evaluations.
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Conversations */}
        <div className="bg-white dark:bg-night-900 p-5 rounded-2xl border border-ivory-200 dark:border-night-700/60 shadow-soft flex flex-col justify-between transition-colors duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sage-600 dark:text-sage-400 uppercase tracking-wider">
              Conversations
            </span>
            <div className="w-9 h-9 rounded-xl bg-forest-50 dark:bg-forest-950/80 text-forest-700 dark:text-emerald-300 flex items-center justify-center border border-forest-100 dark:border-forest-900/60">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-forest-950 dark:text-ivory-50 font-display">
              {data?.conversation_count || 0}
            </p>
            <p className="text-xs text-sage-500 dark:text-sage-400 mt-1">
              {data?.active_conversation_count || 0} active · {data?.completed_conversation_count || 0} completed
            </p>
          </div>
        </div>

        {/* Card 2: Action Plans */}
        <div className="bg-white dark:bg-night-900 p-5 rounded-2xl border border-ivory-200 dark:border-night-700/60 shadow-soft flex flex-col justify-between transition-colors duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sage-600 dark:text-sage-400 uppercase tracking-wider">
              Pending Plans
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/60">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-forest-950 dark:text-ivory-50 font-display">
              {data?.pending_plan_count || 0}
            </p>
            <p className="text-xs text-sage-500 dark:text-sage-400 mt-1">
              {data?.completed_plan_count || 0} completed · {data?.cancelled_plan_count || 0} cancelled
            </p>
          </div>
        </div>

        {/* Card 3: Recent Reports */}
        <div className="bg-white dark:bg-night-900 p-5 rounded-2xl border border-ivory-200 dark:border-night-700/60 shadow-soft flex flex-col justify-between transition-colors duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sage-600 dark:text-sage-400 uppercase tracking-wider">
              Reflection Reports
            </span>
            <div className="w-9 h-9 rounded-xl bg-evarateal-50 dark:bg-evarateal-950/80 text-evarateal-700 dark:text-evarateal-300 flex items-center justify-center border border-evarateal-100 dark:border-evarateal-900/60">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-forest-950 dark:text-ivory-50 font-display">
              {data?.recent_reports?.length || 0}
            </p>
            <p className="text-xs text-sage-500 dark:text-sage-400 mt-1">Generated wellbeing summaries</p>
          </div>
        </div>

        {/* Card 4: Active Commitments */}
        <div className="bg-white dark:bg-night-900 p-5 rounded-2xl border border-ivory-200 dark:border-night-700/60 shadow-soft flex flex-col justify-between transition-colors duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sage-600 dark:text-sage-400 uppercase tracking-wider">
              Active Plans
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 flex items-center justify-center border border-amber-100 dark:border-amber-900/60">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-forest-950 dark:text-ivory-50 font-display">
              {data?.active_plans?.length || 0}
            </p>
            <p className="text-xs text-sage-500 dark:text-sage-400 mt-1">Self-directed action commitments</p>
          </div>
        </div>
      </div>

      {/* Visualizations Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sentiment Distribution */}
        <div className="bg-white dark:bg-night-900 p-5 md:p-6 rounded-2xl border border-ivory-200 dark:border-night-700/60 shadow-soft flex flex-col transition-colors duration-200">
          <div className="mb-4">
            <div className="flex items-center space-x-2">
              <Smile className="w-4 h-4 text-forest-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-forest-950 dark:text-ivory-100 font-display">
                Conversation Sentiment Distribution
              </h2>
            </div>
            <p className="text-xs text-sage-600 dark:text-sage-400 mt-0.5">Aggregate sentiment frequency from analyzed sessions</p>
          </div>

          <div className="flex-1 min-h-[220px] flex items-center justify-center">
            {totalSentimentSignals > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sentimentChartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: tickStroke }} stroke={tickStroke} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: tickStroke }} stroke={tickStroke} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      borderColor: tooltipBorder,
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: tooltipText,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                    formatter={(value) => [`${value} instances`, 'Occurrences']}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {sentimentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center p-6 text-sage-400 dark:text-sage-500 text-xs">
                <Clock className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p>No analyzed sentiments recorded yet.</p>
                <p className="mt-0.5 text-[11px]">Start a conversation to generate sentiment insights.</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Discussion Themes */}
        <div className="bg-white dark:bg-night-900 p-5 md:p-6 rounded-2xl border border-ivory-200 dark:border-night-700/60 shadow-soft flex flex-col transition-colors duration-200">
          <div className="mb-4">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-forest-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-forest-950 dark:text-ivory-100 font-display">
                Top Reflection Themes
              </h2>
            </div>
            <p className="text-xs text-sage-600 dark:text-sage-400 mt-0.5">Frequent topics identified across conversation analyses</p>
          </div>

          <div className="flex-1 min-h-[220px] flex items-center justify-center">
            {topThemesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={topThemesData}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                >
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: tickStroke }} stroke={tickStroke} />
                  <YAxis type="category" dataKey="theme" width={110} tick={{ fontSize: 11, fill: tickStroke }} stroke={tickStroke} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      borderColor: tooltipBorder,
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: tooltipText,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                    formatter={(value) => [`${value} matches`, 'Frequency']}
                  />
                  <Bar dataKey="count" fill="#2d6a4f" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center p-6 text-sage-400 dark:text-sage-500 text-xs">
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
        <div className="bg-white dark:bg-night-900 rounded-2xl border border-ivory-200 dark:border-night-700/60 shadow-soft p-5 md:p-6 transition-colors duration-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-forest-950 dark:text-ivory-100 font-display">
              Recent Conversations
            </h2>
            <span className="text-xs text-sage-500 dark:text-sage-400">Up to 5 latest</span>
          </div>

          {(data?.recent_conversations || []).length > 0 ? (
            <div className="divide-y divide-ivory-200 dark:divide-night-800">
              {data.recent_conversations.map((conv) => (
                <div key={conv.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-forest-950 dark:text-ivory-100 truncate">
                      {conv.title}
                    </p>
                    <p className="text-[11px] text-sage-500 dark:text-sage-400 mt-0.5">
                      Updated {new Date(conv.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className="px-2 py-0.5 text-[10px] font-medium bg-ivory-100 dark:bg-night-800 text-forest-800 dark:text-sage-300 rounded-md border border-ivory-200 dark:border-night-700">
                      {conv.stage.replace(/_/g, ' ')}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-medium rounded-md ${
                        conv.status === 'completed'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-forest-50 dark:bg-forest-950/60 text-forest-800 dark:text-forest-300 border border-forest-200 dark:border-forest-800/60'
                      }`}
                    >
                      {conv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-sage-400 dark:text-sage-500 text-center py-6">
              No conversations created yet.
            </p>
          )}
        </div>

        {/* Active Plans */}
        <div className="bg-white dark:bg-night-900 rounded-2xl border border-ivory-200 dark:border-night-700/60 shadow-soft p-5 md:p-6 transition-colors duration-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-forest-950 dark:text-ivory-100 font-display">
              Active Commitments
            </h2>
            <span className="text-xs text-sage-500 dark:text-sage-400">Pending next steps</span>
          </div>

          {(data?.active_plans || []).length > 0 ? (
            <div className="divide-y divide-ivory-200 dark:divide-night-800">
              {data.active_plans.map((plan) => (
                <div key={plan.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-forest-950 dark:text-ivory-100 truncate">
                      {plan.action}
                    </p>
                    <p className="text-[11px] text-sage-500 dark:text-sage-400 mt-0.5">
                      Target: {plan.date || 'No target date'}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 rounded-md flex-shrink-0">
                    {plan.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-sage-400 dark:text-sage-500 text-center py-6">
              No active plans scheduled.
            </p>
          )}
        </div>
      </div>

      {/* Recent Reports Overview (if any reports exist) */}
      {(data?.recent_reports || []).length > 0 && (
        <div className="bg-white dark:bg-night-900 rounded-2xl border border-ivory-200 dark:border-night-700/60 shadow-soft p-5 md:p-6 transition-colors duration-200">
          <h2 className="text-sm font-bold text-forest-950 dark:text-ivory-100 mb-3 font-display">
            Recent Wellbeing Reports
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {data.recent_reports.map((report) => (
              <div key={report.id} className="p-3.5 bg-ivory-50/70 dark:bg-night-800/70 border border-ivory-200 dark:border-night-700 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-forest-900 dark:text-ivory-100 capitalize">
                    {report.dominant_emotion || 'Neutral'}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                      report.safety_level === 'urgent'
                        ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                        : report.safety_level === 'elevated_concern'
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                        : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {report.safety_level.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-[11px] text-sage-600 dark:text-sage-400">
                  Sentiment: <strong className="capitalize text-forest-800 dark:text-ivory-200">{report.dominant_sentiment}</strong>
                </p>
                <p className="text-[10px] text-sage-400 dark:text-sage-500">
                  {new Date(report.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overall Empty State Prompt */}
      {isOverallEmpty && (
        <div className="bg-ivory-50/80 dark:bg-night-900 border border-ivory-200 dark:border-night-700 rounded-2xl p-6 text-center text-xs text-sage-600 dark:text-sage-400">
          <p className="font-semibold text-forest-950 dark:text-ivory-100 mb-1">Welcome to your reflection space</p>
          <p>You have not created any conversations or commitments yet. Explore the navigation to start your first session.</p>
        </div>
      )}
    </div>
  );
}

