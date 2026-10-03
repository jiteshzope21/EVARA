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
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header and Conversation Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Wellbeing Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Structured non-clinical reflection summaries, themes, and action-plan commitments.
          </p>
        </div>

        {conversations.length > 0 && (
          <div className="flex items-center space-x-2">
            <label htmlFor="report-session-select" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              Session:
            </label>
            <select
              id="report-session-select"
              value={selectedConvId}
              onChange={(e) => setSelectedConvId(e.target.value)}
              className="text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-slate-800"
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
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchReport(selectedConvId)}
            className="text-xs font-semibold underline hover:text-rose-900 ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main View */}
      {loadingList ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500">Loading reflection sessions...</p>
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <h2 className="text-sm font-bold text-slate-800">No Reflection Sessions Found</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Wellbeing reports are generated from reflection dialogues. Start a dialogue session in Conversations first.
          </p>
        </div>
      ) : loadingReport ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500">Retrieving wellbeing report...</p>
        </div>
      ) : !report ? (
        /* Report Not Generated Yet */
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mx-auto border border-amber-100">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">No Report Generated Yet</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              A report has not been generated for <span className="font-semibold text-slate-700">"{selectedConv?.title}"</span>. Reports synthesize user reflection themes, sentiments, and action plans.
            </p>
          </div>

          {/* Explicit Analysis Requirement Orchestration */}
          {needsAnalysis ? (
            <div className="max-w-md mx-auto p-4 bg-purple-50 border border-purple-200 rounded-xl text-left space-y-3">
              <div className="flex items-start space-x-2 text-purple-900">
                <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold">Step 1 Required: Run NLP / LMTA Analysis</p>
                  <p className="text-purple-700 mt-0.5">
                    Reports are compiled directly from stored linguistic evidence. You must run the NLP analysis pipeline first.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleGenerateAnalysisFirst}
                disabled={generatingAnalysis}
                className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
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
            <div className="max-w-md mx-auto p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-left space-y-3">
              <div className="flex items-start space-x-2 text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold">Step 1 Complete: NLP Analysis Ready</p>
                  <p className="text-emerald-700 mt-0.5">
                    Linguistic features and safety classification are stored. You can now compile the Wellbeing Report.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleGenerateReport}
                disabled={generatingReport}
                className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
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
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors disabled:opacity-50"
            >
              {generatingReport ? 'Generating...' : 'Generate Reflection Report'}
            </button>
          )}
        </div>
      ) : (
        /* Report Display */
        <div className="space-y-6">
          {/* Overview Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reflection Report</span>
                <h2 className="text-lg font-bold text-slate-900">{report.conversation_title}</h2>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs text-slate-500">Stage: <strong className="text-slate-700 capitalize">{report.conversation_stage}</strong></span>
                  <span className="text-slate-300">·</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${
                    report.conversation_status === 'completed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-sky-100 text-sky-800'
                  }`}>
                    {report.conversation_status}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-[11px] text-slate-400">
                    Generated: {new Date(report.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateReport}
                disabled={generatingReport}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${generatingReport ? 'animate-spin' : ''}`} />
                <span>Re-generate</span>
              </button>
            </div>

            {/* Reflection Summary in User's Words */}
            <div className="mt-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">User Reflection Excerpt</h3>
              <p className="text-xs sm:text-sm text-slate-700 bg-slate-50 border border-slate-200/80 p-3.5 rounded-lg italic leading-relaxed">
                "{report.reflection_summary}"
              </p>
            </div>
          </div>

          {/* 4 Core Signals Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center space-x-2 text-slate-500 mb-1">
                <Heart className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-semibold">Dominant Sentiment</span>
              </div>
              <p className={`text-base font-bold capitalize mt-1 ${
                report.dominant_sentiment === 'positive'
                  ? 'text-emerald-600'
                  : report.dominant_sentiment === 'negative'
                  ? 'text-rose-600'
                  : 'text-slate-700'
              }`}>
                {report.dominant_sentiment}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center space-x-2 text-slate-500 mb-1">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-semibold">Dominant Emotion</span>
              </div>
              <p className="text-base font-bold text-slate-800 capitalize mt-1">
                {report.dominant_emotion}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center space-x-2 text-slate-500 mb-1">
                <Target className="w-4 h-4 text-brand-500" />
                <span className="text-xs font-semibold">Reflective Intent</span>
              </div>
              <p className="text-base font-bold text-slate-800 capitalize mt-1">
                {report.intent.label}
              </p>
              <div className="flex items-center space-x-1.5 mt-1">
                <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-brand-500 h-1.5 rounded-full"
                    style={{ width: `${Math.round(report.intent.confidence * 100)}%` }}
                  ></div>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {Math.round(report.intent.confidence * 100)}%
                </span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center space-x-2 text-slate-500 mb-1">
                <ShieldAlert className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-semibold">Safety Classification</span>
              </div>
              <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded capitalize mt-1 ${
                report.safety_level === 'normal'
                  ? 'bg-emerald-100 text-emerald-800'
                  : report.safety_level === 'low_concern'
                  ? 'bg-sky-100 text-sky-800'
                  : report.safety_level === 'elevated_concern'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
              }`}>
                {report.safety_level.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Themes Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <span>Identified Reflection Themes ({report.themes?.length || 0})</span>
            </h3>

            {report.themes && report.themes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {report.themes.map((t, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 capitalize">{t.theme}</span>
                      <span className="text-[10px] font-semibold bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">
                        {t.match_count} match{t.match_count === 1 ? '' : 'es'}
                      </span>
                    </div>
                    {t.matched_terms && t.matched_terms.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {t.matched_terms.map((term, i) => (
                          <span key={i} className="text-[10px] bg-white text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                            {term}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No specific predefined themes detected in this session.</p>
            )}
          </div>

          {/* Action Plan & Safety Note */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Action Plan Section */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                <ListTodo className="w-3.5 h-3.5 text-slate-400" />
                <span>Action Plan Commitments</span>
              </h3>

              {report.action_plan ? (
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs sm:text-sm text-emerald-900 whitespace-pre-wrap leading-relaxed">
                  {report.action_plan}
                </div>
              ) : (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 leading-relaxed">
                  <p className="font-semibold text-slate-700">No closure commitments stored yet.</p>
                  <p className="mt-1">
                    Action plan commitments are recorded when the dialogue completes Stage 8 (Closure). This session is currently in stage: <strong>{report.conversation_stage}</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Safety & Evidence Summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                <span>Safety Classification &amp; Protocol Note</span>
              </h3>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-2">
                <p className="leading-relaxed">{report.safety_note || 'Standard non-clinical reflection session.'}</p>
                {report.evidence_summary && (
                  <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-500">
                    <span className="font-semibold">Evidence Trace:</span>{' '}
                    <span>{typeof report.evidence_summary === 'object' ? JSON.stringify(report.evidence_summary) : String(report.evidence_summary)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Academic Disclaimer */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start space-x-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p>
              <strong>Academic Wellbeing Research Prototype:</strong> This report is derived deterministically from natural language processing signals and user reflection excerpts. It does not provide medical evaluation, psychological diagnosis, or clinical advice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
