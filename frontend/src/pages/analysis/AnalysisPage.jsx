import React, { useState, useEffect, useCallback } from 'react';
import conversationService from '../../services/conversationService';
import analysisService from '../../services/analysisService';
import { getErrorMessage } from '../../services/api';
import {
  Sparkles,
  Clock,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  Brain,
  Layers,
  FileCode,
  Tag,
  Activity,
  Heart,
  Target,
  Hash,
  Info,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export default function AnalysisPage() {
  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState('');
  const [loadingList, setLoadingList] = useState(true);

  const [analysis, setAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  // Load conversation list
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

  // Fetch analysis for selected conversation
  const fetchAnalysis = useCallback(async (convId) => {
    if (!convId) return;
    setLoadingAnalysis(true);
    setError(null);
    try {
      const data = await analysisService.getAnalysis(convId);
      setAnalysis(data);
    } catch (err) {
      setAnalysis(null);
      if (err.response?.status !== 404) {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoadingAnalysis(false);
    }
  }, []);

  useEffect(() => {
    if (selectedConvId) {
      fetchAnalysis(selectedConvId);
    }
  }, [selectedConvId, fetchAnalysis]);

  // Run NLP Analysis
  const handleGenerateAnalysis = async () => {
    if (!selectedConvId || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const data = await analysisService.generateAnalysis(selectedConvId);
      setAnalysis(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const selectedConv = conversations.find((c) => c.id === selectedConvId);
  const hasUserMessages = selectedConv ? selectedConv.message_count > 1 : false;

  // Prepare emotion chart data if available
  const emotionChartData =
    analysis?.emotion?.emotion_signal_counts
      ? Object.entries(analysis.emotion.emotion_signal_counts).map(([emotion, count]) => ({
          emotion: emotion.charAt(0).toUpperCase() + emotion.slice(1),
          count,
        }))
      : [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header & Conversation Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">NLP / LMTA Analysis</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Linguistic signals, semantic embeddings, sentiment, and safety evidence.
          </p>
        </div>

        {conversations.length > 0 && (
          <div className="flex items-center space-x-2">
            <label htmlFor="analysis-session-select" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              Session:
            </label>
            <select
              id="analysis-session-select"
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
            onClick={() => fetchAnalysis(selectedConvId)}
            className="text-xs font-semibold underline hover:text-rose-900 ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main View Area */}
      {loadingList ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500">Loading reflection sessions...</p>
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
          <Brain className="w-10 h-10 text-slate-300 mx-auto" />
          <h2 className="text-sm font-bold text-slate-800">No Reflection Sessions Found</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Analysis is computed over user dialogue messages. Start a conversation session first.
          </p>
        </div>
      ) : loadingAnalysis ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500">Retrieving NLP / LMTA analysis...</p>
        </div>
      ) : !analysis ? (
        /* Empty / Not Generated Yet */
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mx-auto border border-purple-100">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">No Analysis Stored for this Session</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Run the Phase 3 NLP/LMTA pipeline over user messages in <span className="font-semibold text-slate-700">"{selectedConv?.title}"</span> to compute tokens, TF-IDF terms, semantic embeddings, and safety evidence.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerateAnalysis}
            disabled={generating}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors disabled:opacity-50"
          >
            {generating ? 'Executing NLP Pipeline...' : 'Run NLP / LMTA Analysis'}
          </button>
        </div>
      ) : (
        /* Full Analysis View */
        <div className="space-y-6">
          {/* Header Overview Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 md:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Phase 3 NLP Pipeline</span>
                <h2 className="text-lg font-bold text-slate-900">{selectedConv?.title || 'Session Analysis'}</h2>
                <div className="flex items-center space-x-2 mt-1 flex-wrap text-xs text-slate-500 gap-y-1">
                  <span>Messages Analyzed: <strong className="text-slate-700">{analysis.source_message_count}</strong></span>
                  <span className="text-slate-300">·</span>
                  <span>Tokens: <strong className="text-slate-700">{analysis.tokens?.length || 0}</strong></span>
                  <span className="text-slate-300">·</span>
                  <span>Sentences: <strong className="text-slate-700">{analysis.sentences?.length || 0}</strong></span>
                  <span className="text-slate-300">·</span>
                  <span className="text-[11px] text-slate-400">
                    Analyzed: {new Date(analysis.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateAnalysis}
                disabled={generating}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                <span>Re-analyze</span>
              </button>
            </div>

            {/* Normalized Text Preview */}
            <div className="mt-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Normalized Input Corpus</h3>
              <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200/80 p-3 rounded-lg font-mono leading-relaxed max-h-24 overflow-y-auto">
                {analysis.normalized_text}
              </p>
            </div>
          </div>

          {/* Core Signal Panels: Sentiment, Emotion & Intent */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sentiment Analysis */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center space-x-2 text-slate-600">
                <Heart className="w-4 h-4 text-rose-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Sentiment Signal</h3>
              </div>
              <div className="flex items-baseline justify-between">
                <span className={`text-xl font-bold capitalize ${
                  analysis.sentiment.label === 'positive'
                    ? 'text-emerald-600'
                    : analysis.sentiment.label === 'negative'
                    ? 'text-rose-600'
                    : 'text-slate-700'
                }`}>
                  {analysis.sentiment.label}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  Score: {analysis.sentiment.score.toFixed(3)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-emerald-50 rounded border border-emerald-100 text-emerald-800">
                  <span className="text-[10px] block font-semibold">Positive Signals</span>
                  <span className="text-sm font-bold">{analysis.sentiment.positive_signal_count}</span>
                </div>
                <div className="p-2 bg-rose-50 rounded border border-rose-100 text-rose-800">
                  <span className="text-[10px] block font-semibold">Negative Signals</span>
                  <span className="text-sm font-bold">{analysis.sentiment.negative_signal_count}</span>
                </div>
              </div>
            </div>

            {/* Emotion Classification */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center space-x-2 text-slate-600">
                <Activity className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Emotion Profile</h3>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold text-slate-800 capitalize">
                  {analysis.emotion.dominant_emotion}
                </span>
                <span className="text-[11px] text-slate-400">Dominant</span>
              </div>
              <div className="pt-2 border-t border-slate-100 h-24">
                {emotionChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={emotionChartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                      <XAxis dataKey="emotion" tick={{ fontSize: 9 }} interval={0} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
                      <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                      <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-slate-400 pt-6 text-center italic">No emotion signals matched.</p>
                )}
              </div>
            </div>

            {/* Intent Detection */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center space-x-2 text-slate-600">
                <Target className="w-4 h-4 text-brand-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Intent Classification</h3>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold text-slate-800 capitalize">
                  {analysis.intent.label}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  {Math.round(analysis.intent.confidence * 100)}% Conf
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-brand-500 h-2 rounded-full"
                    style={{ width: `${Math.round(analysis.intent.confidence * 100)}%` }}
                  ></div>
                </div>
                {analysis.intent.is_low_confidence && (
                  <p className="text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200">
                    Flagged: Low confidence match below threshold.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Extracted Themes & Keywords */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Themes */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center space-x-2 text-slate-600">
                <Tag className="w-4 h-4 text-purple-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Identified Themes ({analysis.themes?.length || 0})</h3>
              </div>
              {analysis.themes && analysis.themes.length > 0 ? (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {analysis.themes.map((theme, i) => (
                    <div key={i} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-800 capitalize">{theme.theme}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {theme.matched_terms?.map((term, idx) => (
                            <span key={idx} className="text-[10px] bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                              {term}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">
                        {theme.match_count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No specific themes detected.</p>
              )}
            </div>

            {/* Top TF-IDF Terms */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center space-x-2 text-slate-600">
                <Hash className="w-4 h-4 text-sky-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Top TF-IDF Terms ({analysis.tfidf?.vocabulary_size || 0} Vocab)</h3>
              </div>
              {analysis.tfidf?.top_terms && analysis.tfidf.top_terms.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                  {analysis.tfidf.top_terms.slice(0, 10).map((termItem, idx) => (
                    <div key={idx} className="p-2 bg-slate-50 rounded border border-slate-100 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 truncate pr-1">{termItem.term}</span>
                      <span className="font-mono text-[10px] text-sky-700 font-bold bg-sky-50 px-1.5 py-0.5 rounded">
                        {termItem.score.toFixed(3)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No TF-IDF terms computed.</p>
              )}
            </div>
          </div>

          {/* Semantic Embeddings & Sentence Coherence */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-slate-700">
                <Layers className="w-4 h-4 text-brand-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Semantic Embeddings &amp; Sentence Coherence</h3>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                  Method: {analysis.embedding?.method || 'N/A'}
                </span>
                {analysis.embedding?.dimensions != null && (
                  <span className="text-[10px] font-semibold bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5 rounded font-mono">
                    Dim: {analysis.embedding.dimensions}
                  </span>
                )}
                {analysis.embedding?.vector_norm != null && (
                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                    Norm: {analysis.embedding.vector_norm.toFixed(3)}
                  </span>
                )}
              </div>
            </div>

            {/* Vector Preview - Strictly API-provided values */}
            {analysis.embedding?.vector_preview && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500 mb-1">
                  Vector Preview ({analysis.embedding.vector_preview.length} components shown):
                </p>
                <div className="p-2.5 bg-slate-900 text-emerald-400 rounded-lg font-mono text-[11px] overflow-x-auto whitespace-nowrap">
                  [{analysis.embedding.vector_preview.map((v) => v.toFixed(5)).join(', ')}, ...]
                </div>
              </div>
            )}

            {/* Semantic Coherence Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Sentence Count</span>
                <span className="text-base font-bold text-slate-800">{analysis.semantics?.sentence_count || 0}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Average Pairwise Similarity</span>
                <span className="text-base font-bold text-slate-800">
                  {analysis.semantics?.average_similarity != null
                    ? analysis.semantics.average_similarity.toFixed(3)
                    : 'N/A'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Most Similar Sentence Pair</span>
                <span className="text-base font-bold text-slate-800">
                  {analysis.semantics?.most_similar_pair
                    ? `${(analysis.semantics.most_similar_pair.similarity * 100).toFixed(1)}% (S${analysis.semantics.most_similar_pair.a + 1} ↔ S${analysis.semantics.most_similar_pair.b + 1})`
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Safety & Reasoning Evidence Trace */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center space-x-2 text-slate-700">
              <ShieldAlert className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Deterministic Safety &amp; Evidence Trace</h3>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">
                  Classification Level:{' '}
                  <span className={`px-2 py-0.5 rounded capitalize font-bold ${
                    analysis.safety.level === 'normal'
                      ? 'bg-emerald-100 text-emerald-800'
                      : analysis.safety.level === 'low_concern'
                      ? 'bg-sky-100 text-sky-800'
                      : analysis.safety.level === 'elevated_concern'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {analysis.safety.level.replace('_', ' ')}
                  </span>
                </span>
                <span className="text-[10px] text-slate-500">
                  Diagnostic Claim: {analysis.safety.is_diagnosis ? 'True' : 'False'}
                </span>
              </div>
              <p className="text-slate-600 leading-relaxed">{analysis.safety.note}</p>

              {analysis.safety.matched_signal_categories && analysis.safety.matched_signal_categories.length > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                    Matched Signal Categories:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {analysis.safety.matched_signal_categories.map((cat, idx) => (
                      <span key={idx} className="text-[10px] bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Evidence Decision Trace */}
            {analysis.evidence?.decision_trace && analysis.evidence.decision_trace.length > 0 && (
              <div className="mt-3">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Decision Trace ({analysis.evidence.decision_trace.length} steps)
                </h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {analysis.evidence.decision_trace.map((step, idx) => (
                    <div key={idx} className="p-2 bg-slate-50 rounded border border-slate-100 text-[11px] text-slate-600 flex items-center justify-between">
                      <span className="font-semibold text-slate-700">{step.step || `Step ${idx + 1}`}</span>
                      <span className="font-mono text-slate-500">{typeof step.outcome === 'object' ? JSON.stringify(step.outcome) : String(step.outcome || '')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Academic Non-Clinical Notice */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start space-x-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p>
              <strong>Academic Natural Language Processing Engine:</strong> Signals displayed here are computational linguistic features extracted for reflection and research evaluation. They do not constitute diagnostic medical tests or psychiatric clinical assessments.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
