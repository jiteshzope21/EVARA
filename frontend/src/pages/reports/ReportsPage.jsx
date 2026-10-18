import React, { useState, useEffect, useCallback } from 'react';
import conversationService from '../../services/conversationService';
import reportService from '../../services/reportService';
import analysisService from '../../services/analysisService';
import { getErrorMessage } from '../../services/api';
import {
  FileText,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Tag,
  Heart,
  TrendingUp,
  Target,
  ListTodo,
} from 'lucide-react';

export default function ReportsPage() {
  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState('');
  const [loadingList, setLoadingList] = useState(true);

  const [report, setReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generatingAnalysis, setGeneratingAnalysis] = useState(false);
  const [analysisCompleted, setAnalysisCompleted] = useState(false);

  const [error, setError] = useState(null);
  const [needsAnalysis, setNeedsAnalysis] = useState(false);

  // Load conversation list for selector
  useEffect(() => {
    async function fetchConversations() {
      setLoadingList(true);
      try {
        const list = await conversationService.listConversations();
        setConversations(list);
        if (list.length > 0) {
          setSelectedConvId(list[0].id);
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoadingList(false);
      }
    }
    fetchConversations();
  }, []);

  // Fetch report for selected conversation
  const fetchReport = useCallback(async (convId) => {
    if (!convId) return;
    setLoadingReport(true);
    setError(null);
    setNeedsAnalysis(false);
    setAnalysisCompleted(false);

    try {
      const data = await reportService.getReport(convId);
      setReport(data);
    } catch (err) {
      // 404 indicates no report generated yet
      setReport(null);
      if (err.response?.status !== 404) {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoadingReport(false);
    }
  }, []);

  useEffect(() => {
    if (selectedConvId) {
      fetchReport(selectedConvId);
    }
  }, [selectedConvId, fetchReport]);

  // Step 1: Explicitly generate analysis first if required
  const handleGenerateAnalysisFirst = async () => {
    if (!selectedConvId || generatingAnalysis) return;
    setGeneratingAnalysis(true);
    setError(null);

    try {
      await analysisService.generateAnalysis(selectedConvId);
      setAnalysisCompleted(true);
      setNeedsAnalysis(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setGeneratingAnalysis(false);
    }
  };

  // Step 2: Generate report
  const handleGenerateReport = async () => {
    if (!selectedConvId || generatingReport) return;
    setGeneratingReport(true);
    setError(null);

    try {
      const newReport = await reportService.generateReport(selectedConvId);
      setReport(newReport);
      setNeedsAnalysis(false);
      setAnalysisCompleted(false);
    } catch (err) {
      const msg = getErrorMessage(err);
      // Check if backend indicates analysis must precede report
      if (err.response?.status === 404 && msg.toLowerCase().includes('analysis')) {
        setNeedsAnalysis(true);
      } else {
        setError(msg);
      }
    } finally {
      setGeneratingReport(false);
    }
  };

  const selectedConv = conversations.find((c) => c.id === selectedConvId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 transition-colors">
      {/* Header and Conversation Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
              Wellbeing Reports
            </h1>
            <span className="text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-forest-50 dark:bg-forest-900/40 text-forest-700 dark:text-forest-300 border border-forest-200/80 dark:border-forest-800">
              Session Synthesis
            </span>
          </div>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Structured non-clinical reflection summaries, themes, and action-plan commitments.
          </p>
        </div>

        {conversations.length > 0 && (
          <div className="flex items-center space-x-2.5">
            <label htmlFor="report-session-select" className="text-xs font-semibold text-stone-600 dark:text-stone-400 whitespace-nowrap">
              Session:
            </label>
            <select
              id="report-session-select"
              value={selectedConvId}
              onChange={(e) => setSelectedConvId(e.target.value)}
              className="text-xs bg-white dark:bg-night-900 border border-stone-200 dark:border-night-700 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-forest-500 font-medium text-stone-800 dark:text-stone-200 shadow-2xs"
            >
              {conversations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.stage})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-2.5">
          <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchReport(selectedConvId)}
            className="text-xs font-semibold underline hover:text-rose-900 dark:hover:text-rose-200 ml-2 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main View */}
      {loadingList ? (
        <div className="bg-white dark:bg-night-900 rounded-2xl border border-stone-200/80 dark:border-night-800 p-12 text-center">
          <div className="w-7 h-7 border-2 border-forest-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs font-medium text-stone-500 dark:text-stone-400">Loading reflection sessions...</p>
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-white dark:bg-night-900 rounded-2xl border border-stone-200/80 dark:border-night-800 p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-night-800 text-stone-400 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">No Reflection Sessions Found</h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto leading-relaxed">
            Wellbeing reports are generated from reflection dialogues. Start a dialogue session in Conversations first.
          </p>
        </div>
      ) : loadingReport ? (
        <div className="bg-white dark:bg-night-900 rounded-2xl border border-stone-200/80 dark:border-night-800 p-12 text-center">
          <div className="w-7 h-7 border-2 border-forest-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs font-medium text-stone-500 dark:text-stone-400">Retrieving wellbeing report...</p>
        </div>
      ) : !report ? (
        /* Report Not Generated Yet */
        <div className="bg-white dark:bg-night-900 rounded-2xl border border-stone-200/80 dark:border-night-800 p-10 text-center space-y-4">
          <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-200/60 dark:border-amber-900/60">
            <FileText className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">No Report Generated Yet</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto mt-1 leading-relaxed">
              A report has not been generated for <span className="font-semibold text-stone-700 dark:text-stone-300">"{selectedConv?.title}"</span>. Reports synthesize user reflection themes, sentiments, and action plans.
            </p>
          </div>

          {/* Explicit Analysis Requirement Orchestration */}
          {needsAnalysis ? (
            <div className="max-w-md mx-auto p-5 bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60 rounded-2xl text-left space-y-3">
              <div className="flex items-start space-x-2.5 text-purple-900 dark:text-purple-200">
                <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold">Step 1 Required: Run NLP / LMTA Analysis</p>
                  <p className="text-purple-700 dark:text-purple-300 mt-1 leading-relaxed">
                    Reports are compiled directly from stored linguistic evidence. You must run the NLP analysis pipeline first.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleGenerateAnalysisFirst}
                disabled={generatingAnalysis}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {generatingAnalysis ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Running NLP Pipeline...</span>
                  </>
                ) : (
                  <>
                    <span>Generate NLP Analysis First</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          ) : analysisCompleted ? (
            <div className="max-w-md mx-auto p-5 bg-forest-50/80 dark:bg-forest-950/30 border border-forest-200 dark:border-forest-900/60 rounded-2xl text-left space-y-3">
              <div className="flex items-start space-x-2.5 text-forest-900 dark:text-forest-200">
                <CheckCircle2 className="w-5 h-5 text-forest-600 dark:text-forest-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold">Step 1 Complete: NLP Analysis Ready</p>
                  <p className="text-forest-700 dark:text-forest-300 mt-1 leading-relaxed">
                    Linguistic features and safety classification are stored. You can now compile the Wellbeing Report.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleGenerateReport}
                disabled={generatingReport}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-forest-700 hover:bg-forest-800 dark:bg-forest-600 dark:hover:bg-forest-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {generatingReport ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Compiling Report...</span>
                  </>
                ) : (
                  <span>Step 2: Generate Wellbeing Report</span>
                )}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={generatingReport}
              className="px-5 py-2.5 bg-forest-700 hover:bg-forest-800 dark:bg-forest-600 dark:hover:bg-forest-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {generatingReport ? 'Generating...' : 'Generate Reflection Report'}
            </button>
          )}
        </div>
      ) : (
        /* Report Display */
        <div className="space-y-6">
          {/* Overview Card */}
          <div className="bg-white dark:bg-night-900 rounded-2xl border border-stone-200/80 dark:border-night-800 shadow-xs p-6 md:p-7">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-stone-100 dark:border-night-800 gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-forest-700 dark:text-forest-400">
                  Reflection Report
                </span>
                <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                  {report.conversation_title}
                </h2>
                <div className="flex items-center space-x-2 mt-1.5 flex-wrap gap-y-1">
                  <span className="text-xs text-stone-500 dark:text-stone-400">
                    Stage: <strong className="text-stone-700 dark:text-stone-300 capitalize">{report.conversation_stage}</strong>
                  </span>
                  <span className="text-stone-300 dark:text-stone-700">·</span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md capitalize border ${
                      report.conversation_status === 'completed'
                        ? 'bg-forest-50 dark:bg-forest-900/40 text-forest-700 dark:text-forest-300 border-forest-200 dark:border-forest-800'
                        : 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900/60'
                    }`}
                  >
                    {report.conversation_status}
                  </span>
                  <span className="text-stone-300 dark:text-stone-700">·</span>
                  <span className="text-[11px] text-stone-400 dark:text-stone-500">
                    Generated: {new Date(report.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateReport}
                disabled={generatingReport}
                className="flex items-center space-x-2 px-3.5 py-2 bg-stone-50 hover:bg-stone-100 dark:bg-night-800 dark:hover:bg-night-700 text-stone-700 dark:text-stone-200 border border-stone-200/80 dark:border-night-700 rounded-xl text-xs font-semibold transition-colors self-start sm:self-auto cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${generatingReport ? 'animate-spin' : ''}`} />
                <span>Re-generate</span>
              </button>
            </div>

            {/* Reflection Summary in User's Words */}
            <div className="mt-5">
              <h3 className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">
                User Reflection Excerpt
              </h3>
              <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 bg-stone-50 dark:bg-night-800/60 border border-stone-200/60 dark:border-night-700 p-4 rounded-xl italic leading-relaxed">
                "{report.reflection_summary}"
              </p>
            </div>
          </div>

          {/* 4 Core Signals Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-night-900 rounded-2xl border border-stone-200/80 dark:border-night-800 p-5 shadow-xs">
              <div className="flex items-center space-x-2 text-stone-500 dark:text-stone-400 mb-1.5">
                <Heart className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-semibold">Dominant Sentiment</span>
              </div>
              <p
                className={`text-base font-bold capitalize mt-1 ${
                  report.dominant_sentiment === 'positive'
                    ? 'text-forest-700 dark:text-forest-400'
                    : report.dominant_sentiment === 'negative'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-stone-700 dark:text-stone-300'
                }`}
              >
                {report.dominant_sentiment}
              </p>
            </div>

            <div className="bg-white dark:bg-night-900 rounded-2xl border border-stone-200/80 dark:border-night-800 p-5 shadow-xs">
              <div className="flex items-center space-x-2 text-stone-500 dark:text-stone-400 mb-1.5">
                <TrendingUp className="w-4 h-4 text-forest-600 dark:text-forest-400" />
                <span className="text-xs font-semibold">Dominant Emotion</span>
              </div>
              <p className="text-base font-bold text-stone-900 dark:text-stone-100 capitalize mt-1">
                {report.dominant_emotion}
              </p>
            </div>

            <div className="bg-white dark:bg-night-900 rounded-2xl border border-stone-200/80 dark:border-night-800 p-5 shadow-xs">
              <div className="flex items-center space-x-2 text-stone-500 dark:text-stone-400 mb-1.5">
                <Target className="w-4 h-4 text-forest-600 dark:text-forest-400" />
                <span className="text-xs font-semibold">Reflective Intent</span>
              </div>
              <p className="text-base font-bold text-stone-900 dark:text-stone-100 capitalize mt-1">
                {report.intent.label}
              </p>
              <div className="flex items-center space-x-2 mt-2">
                <div className="flex-1 bg-stone-100 dark:bg-night-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-forest-600 dark:bg-forest-500 h-1.5 rounded-full"
                    style={{ width: `${Math.round(report.intent.confidence * 100)}%` }}
                  ></div>
                </div>
                <span className="text-[10px] text-stone-500 dark:text-stone-400 font-mono">
                  {Math.round(report.intent.confidence * 100)}%
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-night-900 rounded-2xl border border-stone-200/80 dark:border-night-800 p-5 shadow-xs">
              <div className="flex items-center space-x-2 text-stone-500 dark:text-stone-400 mb-1.5">
                <ShieldAlert className="w-4 h-4 text-forest-600 dark:text-forest-400" />
                <span className="text-xs font-semibold">Safety Classification</span>
              </div>
              <span
                className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-md capitalize mt-1 border ${
                  report.safety_level === 'normal'
                    ? 'bg-forest-50 dark:bg-forest-900/40 text-forest-700 dark:text-forest-300 border-forest-200 dark:border-forest-800'
                    : report.safety_level === 'low_concern'
                    ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900/60'
                    : report.safety_level === 'elevated_concern'
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
                }`}
              >
                {report.safety_level.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Themes Breakdown */}
          <div className="bg-white dark:bg-night-900 rounded-2xl border border-stone-200/80 dark:border-night-800 p-6 shadow-xs">
            <h3 className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-4 flex items-center space-x-2">
              <Tag className="w-4 h-4 text-stone-400" />
              <span>Identified Reflection Themes ({report.themes?.length || 0})</span>
            </h3>

            {report.themes && report.themes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {report.themes.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-stone-50 dark:bg-night-800/60 rounded-xl border border-stone-200/60 dark:border-night-700 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-200 capitalize">
                        {t.theme}
                      </span>
                      <span className="text-[10px] font-semibold bg-white dark:bg-night-800 border border-stone-200/80 dark:border-night-700 px-2 py-0.5 rounded text-stone-600 dark:text-stone-300">
                        {t.match_count} match{t.match_count === 1 ? '' : 'es'}
                      </span>
                    </div>
                    {t.matched_terms && t.matched_terms.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {t.matched_terms.map((term, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-white dark:bg-night-800 text-stone-600 dark:text-stone-300 px-2 py-0.5 rounded border border-stone-200/80 dark:border-night-700"
                          >
                            {term}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-400 dark:text-stone-500 italic">No specific predefined themes detected in this session.</p>
            )}
          </div>

          {/* Action Plan & Safety Note */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Action Plan Section */}
            <div className="bg-white dark:bg-night-900 rounded-2xl border border-stone-200/80 dark:border-night-800 p-6 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center space-x-2">
                <ListTodo className="w-4 h-4 text-forest-600 dark:text-forest-400" />
                <span>Action Plan Commitments</span>
              </h3>

              {report.action_plan ? (
                <div className="p-4 bg-forest-50/80 dark:bg-forest-950/40 border border-forest-200/80 dark:border-forest-900/60 rounded-xl text-xs sm:text-sm text-forest-900 dark:text-forest-200 whitespace-pre-wrap leading-relaxed">
                  {report.action_plan}
                </div>
              ) : (
                <div className="p-4 bg-stone-50 dark:bg-night-800/60 border border-stone-200/80 dark:border-night-700 rounded-xl text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                  <p className="font-semibold text-stone-700 dark:text-stone-300">No closure commitments stored yet.</p>
                  <p className="mt-1">
                    Action plan commitments are recorded when the dialogue completes Stage 8 (Closure). This session is currently in stage: <strong className="text-stone-700 dark:text-stone-300">{report.conversation_stage}</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Safety & Evidence Summary */}
            <div className="bg-white dark:bg-night-900 rounded-2xl border border-stone-200/80 dark:border-night-800 p-6 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-forest-600 dark:text-forest-400" />
                <span>Safety Classification &amp; Protocol Note</span>
              </h3>

              <div className="p-4 bg-stone-50 dark:bg-night-800/60 border border-stone-200/80 dark:border-night-700 rounded-xl text-xs text-stone-700 dark:text-stone-300 space-y-2.5">
                <p className="leading-relaxed">{report.safety_note || 'Standard non-clinical reflection session.'}</p>
                {report.evidence_summary && (
                  <div className="pt-2.5 border-t border-stone-200/60 dark:border-night-700 text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                    <span className="font-semibold text-stone-700 dark:text-stone-300">Evidence Trace:</span>{' '}
                    <span>{typeof report.evidence_summary === 'object' ? JSON.stringify(report.evidence_summary) : String(report.evidence_summary)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Academic Disclaimer */}
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl text-[11px] text-amber-900 dark:text-amber-200 flex items-start space-x-3">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Academic Wellbeing Research Prototype:</strong> This report is derived deterministically from natural language processing signals and user reflection excerpts. It does not provide medical evaluation, psychological diagnosis, or clinical advice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
