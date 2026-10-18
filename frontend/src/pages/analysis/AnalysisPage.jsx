import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../context/ThemeContext';
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
  const { isDark } = useTheme();
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

  const tickColor = isDark ? '#7d8e85' : '#71886e';
  const tooltipBg = isDark ? '#1a231e' : '#ffffff';
  const tooltipBorder = isDark ? '#293730' : '#e6e9e6';
  const tooltipText = isDark ? '#ecf2ee' : '#192720';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header & Conversation Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-forest-950 dark:text-ivory-50 tracking-tight font-display">
              NLP / LMTA Analysis
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-forest-100 dark:bg-forest-950/80 text-forest-800 dark:text-emerald-300 rounded-md border border-forest-200 dark:border-forest-800">
              Linguistic Engine
            </span>
          </div>
          <p className="text-sm text-sage-600 dark:text-sage-400 mt-1">
            Linguistic signals, semantic embeddings, sentiment, and safety evidence.
          </p>
        </div>

        {conversations.length > 0 && (
          <div className="flex items-center space-x-2">
            <label htmlFor="analysis-session-select" className="text-xs font-semibold text-sage-700 dark:text-sage-300 whitespace-nowrap">
              Session:
            </label>
            <select
              id="analysis-session-select"
              value={selectedConvId}
              onChange={(e) => setSelectedConvId(e.target.value)}
              className="text-xs bg-white dark:bg-night-900 border border-ivory-300 dark:border-night-700 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-600 dark:focus:border-forest-400 font-medium text-forest-950 dark:text-ivory-100 shadow-xs"
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
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-2.5">
          <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchAnalysis(selectedConvId)}
            className="text-xs font-semibold underline hover:text-rose-900 dark:hover:text-rose-200 ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main View Area */}
      {loadingList ? (
        <div className="bg-white dark:bg-night-900 rounded-2xl border border-ivory-200 dark:border-night-700/60 p-8 text-center shadow-soft">
          <div className="w-6 h-6 border-2 border-forest-600 dark:border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-sage-500 dark:text-sage-400">Loading reflection sessions...</p>
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-white dark:bg-night-900 rounded-2xl border border-ivory-200 dark:border-night-700/60 p-8 text-center space-y-3 shadow-soft">
          <Brain className="w-10 h-10 text-sage-300 dark:text-sage-600 mx-auto" />
          <h2 className="text-sm font-bold text-forest-950 dark:text-ivory-100 font-display">No Reflection Sessions Found</h2>
          <p className="text-xs text-sage-500 dark:text-sage-400 max-w-sm mx-auto">
            Analysis is computed over user dialogue messages. Start a conversation session first.
          </p>
        </div>
      ) : loadingAnalysis ? (
        <div className="bg-white dark:bg-night-900 rounded-2xl border border-ivory-200 dark:border-night-700/60 p-8 text-center shadow-soft">
          <div className="w-6 h-6 border-2 border-forest-600 dark:border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-sage-500 dark:text-sage-400">Retrieving NLP / LMTA analysis...</p>
        </div>
      ) : !analysis ? (
        /* Empty / Not Generated Yet */
        <div className="bg-white dark:bg-night-900 rounded-2xl border border-ivory-200 dark:border-night-700/60 p-8 text-center space-y-4 shadow-soft">
          <div className="w-12 h-12 bg-forest-50 dark:bg-forest-950/80 text-forest-700 dark:text-emerald-300 rounded-2xl flex items-center justify-center mx-auto border border-forest-200 dark:border-forest-800">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-forest-950 dark:text-ivory-100 font-display">No Analysis Stored for this Session</h2>
            <p className="text-xs text-sage-600 dark:text-sage-400 max-w-md mx-auto mt-1">
              Run the Phase 3 NLP/LMTA pipeline over user messages in <span className="font-semibold text-forest-900 dark:text-ivory-200">"{selectedConv?.title}"</span> to compute tokens, TF-IDF terms, semantic embeddings, and safety evidence.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerateAnalysis}
            disabled={generating}
            className="px-4 py-2.5 bg-gradient-to-r from-forest-700 to-forest-800 hover:from-forest-800 hover:to-forest-900 text-ivory-50 rounded-xl text-xs font-medium shadow-soft transition-colors disabled:opacity-50"
          >
            {generating ? 'Executing NLP Pipeline...' : 'Run NLP / LMTA Analysis'}
          </button>
        </div>
      ) : (
        /* Full Analysis View */
        <div className="space-y-6">
          {/* Header Overview Card */}
          <div className="bg-white dark:bg-night-900 rounded-2xl border border-ivory-200 dark:border-night-700/60 p-5 md:p-6 shadow-soft transition-colors duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-ivory-200 dark:border-night-800 gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-forest-700 dark:text-emerald-400">
                  Phase 3 NLP Pipeline
                </span>
                <h2 className="text-lg font-bold text-forest-950 dark:text-ivory-50 font-display">
                  {selectedConv?.title || 'Session Analysis'}
                </h2>
                <div className="flex items-center space-x-2 mt-1 flex-wrap text-xs text-sage-600 dark:text-sage-400 gap-y-1">
                  <span>Messages Analyzed: <strong className="text-forest-900 dark:text-ivory-200">{analysis.source_message_count}</strong></span>
                  <span className="text-sage-300 dark:text-sage-700">·</span>
                  <span>Tokens: <strong className="text-forest-900 dark:text-ivory-200">{analysis.tokens?.length || 0}</strong></span>
                  <span className="text-sage-300 dark:text-sage-700">·</span>
                  <span>Sentences: <strong className="text-forest-900 dark:text-ivory-200">{analysis.sentences?.length || 0}</strong></span>
                  <span className="text-sage-300 dark:text-sage-700">·</span>
                  <span className="text-[11px] text-sage-400 dark:text-sage-500">
                    Analyzed: {new Date(analysis.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateAnalysis}
                disabled={generating}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-ivory-50 dark:bg-night-800 hover:bg-forest-50 dark:hover:bg-night-700 text-forest-800 dark:text-sage-300 border border-ivory-200 dark:border-night-700 rounded-xl text-xs font-medium transition-colors self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin text-forest-600' : ''}`} />
                <span>Re-analyze</span>
              </button>
            </div>

            {/* Normalized Text Preview */}
            <div className="mt-4">
              <h3 className="text-xs font-bold text-sage-600 dark:text-sage-400 uppercase tracking-wider mb-1.5">
                Normalized Input Corpus
              </h3>
              <p className="text-xs text-forest-900 dark:text-ivory-200 bg-ivory-50/70 dark:bg-night-950/70 border border-ivory-200 dark:border-night-800 p-3.5 rounded-xl font-mono leading-relaxed max-h-24 overflow-y-auto">
                {analysis.normalized_text}
              </p>
            </div>
          </div>

          {/* Core Signal Panels: Sentiment, Emotion & Intent */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sentiment Analysis */}
            <div className="bg-white dark:bg-night-900 rounded-2xl border border-ivory-200 dark:border-night-700/60 p-5 shadow-soft space-y-3 transition-colors duration-200">
              <div className="flex items-center space-x-2 text-sage-600 dark:text-sage-400">
                <Heart className="w-4 h-4 text-rose-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Sentiment Signal</h3>
              </div>
              <div className="flex items-baseline justify-between">
                <span className={`text-xl font-bold capitalize font-display ${
                  analysis.sentiment.label === 'positive'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : analysis.sentiment.label === 'negative'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-forest-800 dark:text-ivory-200'
                }`}>
                  {analysis.sentiment.label}
                </span>
                <span className="text-xs font-mono text-sage-500 dark:text-sage-400">
                  Score: {analysis.sentiment.score.toFixed(3)}
                </span>
              </div>
              <div className="pt-2 border-t border-ivory-200 dark:border-night-800 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                  <span className="text-[10px] block font-semibold">Positive Signals</span>
                  <span className="text-base font-bold">{analysis.sentiment.positive_signal_count}</span>
                </div>
                <div className="p-2.5 bg-rose-50/80 dark:bg-rose-950/40 rounded-xl border border-rose-200/80 dark:border-rose-900/40 text-rose-800 dark:text-rose-300">
                  <span className="text-[10px] block font-semibold">Negative Signals</span>
                  <span className="text-base font-bold">{analysis.sentiment.negative_signal_count}</span>
                </div>
              </div>
            </div>

            {/* Emotion Classification */}
            <div className="bg-white dark:bg-night-900 rounded-2xl border border-ivory-200 dark:border-night-700/60 p-5 shadow-soft space-y-3 transition-colors duration-200">
              <div className="flex items-center space-x-2 text-sage-600 dark:text-sage-400">
                <Activity className="w-4 h-4 text-forest-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Emotion Profile</h3>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold text-forest-950 dark:text-ivory-50 capitalize font-display">
                  {analysis.emotion.dominant_emotion}
                </span>
                <span className="text-[11px] text-sage-400 dark:text-sage-500">Dominant</span>
              </div>
              <div className="pt-2 border-t border-ivory-200 dark:border-night-800 h-24">
                {emotionChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={emotionChartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                      <XAxis dataKey="emotion" tick={{ fontSize: 9, fill: tickColor }} interval={0} stroke={tickColor} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: tickColor }} stroke={tickColor} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: tooltipBg,
                          borderColor: tooltipBorder,
                          borderRadius: '8px',
                          fontSize: '11px',
                          color: tooltipText,
                        }}
                      />
                      <Bar dataKey="count" fill="#2d6a4f" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-sage-400 dark:text-sage-500 pt-6 text-center italic">No emotion signals matched.</p>
                )}
              </div>
            </div>

            {/* Intent Detection */}
            <div className="bg-white dark:bg-night-900 rounded-2xl border border-ivory-200 dark:border-night-700/60 p-5 shadow-soft space-y-3 transition-colors duration-200">
              <div className="flex items-center space-x-2 text-sage-600 dark:text-sage-400">
                <Target className="w-4 h-4 text-forest-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Intent Classification</h3>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold text-forest-950 dark:text-ivory-50 capitalize font-display">
                  {analysis.intent.label}
                </span>
                <span className="text-xs font-mono text-sage-500 dark:text-sage-400">
                  {Math.round(analysis.intent.confidence * 100)}% Conf
                </span>
              </div>
              <div className="pt-2 border-t border-ivory-200 dark:border-night-800 space-y-2 text-xs">
                <div className="w-full bg-ivory-100 dark:bg-night-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-forest-600 dark:bg-emerald-500 h-2 rounded-full"
                    style={{ width: `${Math.round(analysis.intent.confidence * 100)}%` }}
                  ></div>
                </div>
                {analysis.intent.is_low_confidence && (
                  <p className="text-[10px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-800/50">
                    Flagged: Low confidence match below threshold.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Extracted Themes & Keywords */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Themes */}
            <div className="bg-white dark:bg-night-900 rounded-2xl border border-ivory-200 dark:border-night-700/60 p-5 shadow-soft space-y-3 transition-colors duration-200">
              <div className="flex items-center space-x-2 text-sage-600 dark:text-sage-400">
                <Tag className="w-4 h-4 text-forest-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Identified Themes ({analysis.themes?.length || 0})
                </h3>
              </div>
              {analysis.themes && analysis.themes.length > 0 ? (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {analysis.themes.map((theme, i) => (
                    <div key={i} className="p-3 bg-ivory-50/70 dark:bg-night-800/70 rounded-xl border border-ivory-200 dark:border-night-700 flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold text-forest-950 dark:text-ivory-100 capitalize">{theme.theme}</span>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {theme.matched_terms?.map((term, idx) => (
                            <span key={idx} className="text-[10px] bg-white dark:bg-night-900 border border-ivory-200 dark:border-night-700 text-forest-800 dark:text-sage-300 px-2 py-0.5 rounded-md">
                              {term}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold bg-white dark:bg-night-900 border border-ivory-200 dark:border-night-700 px-2 py-0.5 rounded-md text-forest-700 dark:text-emerald-300">
                        {theme.match_count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-sage-400 dark:text-sage-500 italic">No specific themes detected.</p>
              )}
            </div>

            {/* Top TF-IDF Terms */}
            <div className="bg-white dark:bg-night-900 rounded-2xl border border-ivory-200 dark:border-night-700/60 p-5 shadow-soft space-y-3 transition-colors duration-200">
              <div className="flex items-center space-x-2 text-sage-600 dark:text-sage-400">
                <Hash className="w-4 h-4 text-forest-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Top TF-IDF Terms ({analysis.tfidf?.vocabulary_size || 0} Vocab)
                </h3>
              </div>
              {analysis.tfidf?.top_terms && analysis.tfidf.top_terms.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                  {analysis.tfidf.top_terms.slice(0, 10).map((termItem, idx) => (
                    <div key={idx} className="p-2.5 bg-ivory-50/70 dark:bg-night-800/70 rounded-xl border border-ivory-200 dark:border-night-700 flex items-center justify-between text-xs">
                      <span className="font-semibold text-forest-950 dark:text-ivory-100 truncate pr-1">{termItem.term}</span>
                      <span className="font-mono text-[10px] text-forest-800 dark:text-emerald-300 font-bold bg-forest-100 dark:bg-forest-950/80 px-1.5 py-0.5 rounded-md">
                        {termItem.score.toFixed(3)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-sage-400 dark:text-sage-500 italic">No TF-IDF terms computed.</p>
              )}
            </div>
          </div>

          {/* Semantic Embeddings & Sentence Coherence */}
          <div className="bg-white dark:bg-night-900 rounded-2xl border border-ivory-200 dark:border-night-700/60 p-5 shadow-soft space-y-4 transition-colors duration-200">
            <div className="flex items-center justify-between border-b border-ivory-200 dark:border-night-800 pb-3 flex-wrap gap-2">
              <div className="flex items-center space-x-2 text-forest-900 dark:text-ivory-100">
                <Layers className="w-4 h-4 text-forest-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Semantic Embeddings &amp; Sentence Coherence</h3>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-semibold bg-ivory-100 dark:bg-night-800 text-forest-800 dark:text-sage-300 px-2 py-0.5 rounded-md border border-ivory-200 dark:border-night-700">
                  Method: {analysis.embedding?.method || 'N/A'}
                </span>
                {analysis.embedding?.dimensions != null && (
                  <span className="text-[10px] font-semibold bg-forest-100 dark:bg-forest-950/80 text-forest-800 dark:text-emerald-300 border border-forest-200 dark:border-forest-800 px-2 py-0.5 rounded-md font-mono">
                    Dim: {analysis.embedding.dimensions}
                  </span>
                )}
                {analysis.embedding?.vector_norm != null && (
                  <span className="text-[10px] font-semibold bg-ivory-100 dark:bg-night-800 text-sage-700 dark:text-sage-300 px-2 py-0.5 rounded-md font-mono border border-ivory-200 dark:border-night-700">
                    Norm: {analysis.embedding.vector_norm.toFixed(3)}
                  </span>
                )}
              </div>
            </div>

            {/* Vector Preview - Strictly API-provided values */}
            {analysis.embedding?.vector_preview && (
              <div>
                <p className="text-[11px] font-semibold text-sage-600 dark:text-sage-400 mb-1.5">
                  Vector Preview ({analysis.embedding.vector_preview.length} components shown):
                </p>
                <div className="p-3 bg-night-950 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto whitespace-nowrap border border-night-800">
                  [{analysis.embedding.vector_preview.map((v) => v.toFixed(5)).join(', ')}, ...]
                </div>
              </div>
            )}

            {/* Semantic Coherence Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3.5 bg-ivory-50/70 dark:bg-night-800/70 rounded-xl border border-ivory-200 dark:border-night-700">
                <span className="text-[10px] text-sage-500 dark:text-sage-400 block font-semibold uppercase">Sentence Count</span>
                <span className="text-base font-bold text-forest-950 dark:text-ivory-100 font-display">{analysis.semantics?.sentence_count || 0}</span>
              </div>
              <div className="p-3.5 bg-ivory-50/70 dark:bg-night-800/70 rounded-xl border border-ivory-200 dark:border-night-700">
                <span className="text-[10px] text-sage-500 dark:text-sage-400 block font-semibold uppercase">Average Pairwise Similarity</span>
                <span className="text-base font-bold text-forest-950 dark:text-ivory-100 font-display">
                  {analysis.semantics?.average_similarity != null
                    ? analysis.semantics.average_similarity.toFixed(3)
                    : 'N/A'}
                </span>
              </div>
              <div className="p-3.5 bg-ivory-50/70 dark:bg-night-800/70 rounded-xl border border-ivory-200 dark:border-night-700">
                <span className="text-[10px] text-sage-500 dark:text-sage-400 block font-semibold uppercase">Most Similar Sentence Pair</span>
                <span className="text-base font-bold text-forest-950 dark:text-ivory-100 font-display">
                  {analysis.semantics?.most_similar_pair
                    ? `${(analysis.semantics.most_similar_pair.similarity * 100).toFixed(1)}% (S${analysis.semantics.most_similar_pair.a + 1} ↔ S${analysis.semantics.most_similar_pair.b + 1})`
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Safety & Reasoning Evidence Trace */}
          <div className="bg-white dark:bg-night-900 rounded-2xl border border-ivory-200 dark:border-night-700/60 p-5 shadow-soft space-y-3 transition-colors duration-200">
            <div className="flex items-center space-x-2 text-forest-900 dark:text-ivory-100">
              <ShieldAlert className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Deterministic Safety &amp; Evidence Trace</h3>
            </div>

            <div className="p-4 bg-ivory-50/70 dark:bg-night-800/70 rounded-xl border border-ivory-200 dark:border-night-700 text-xs space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-semibold text-forest-950 dark:text-ivory-100">
                  Classification Level:{' '}
                  <span className={`px-2 py-0.5 rounded-md capitalize font-bold ${
                    analysis.safety.level === 'normal'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                      : analysis.safety.level === 'low_concern'
                      ? 'bg-forest-100 dark:bg-forest-950 text-forest-800 dark:text-forest-300'
                      : analysis.safety.level === 'elevated_concern'
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                      : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                  }`}>
                    {analysis.safety.level.replace('_', ' ')}
                  </span>
                </span>
                <span className="text-[10px] text-sage-500 dark:text-sage-400">
                  Diagnostic Claim: {analysis.safety.is_diagnosis ? 'True' : 'False'}
                </span>
              </div>
              <p className="text-sage-700 dark:text-sage-300 leading-relaxed">{analysis.safety.note}</p>

              {analysis.safety.matched_signal_categories && analysis.safety.matched_signal_categories.length > 0 && (
                <div className="pt-2 border-t border-ivory-200 dark:border-night-700">
                  <span className="text-[10px] font-semibold text-sage-500 dark:text-sage-400 uppercase block mb-1.5">
                    Matched Signal Categories:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.safety.matched_signal_categories.map((cat, idx) => (
                      <span key={idx} className="text-[10px] bg-white dark:bg-night-900 border border-ivory-200 dark:border-night-700 text-forest-800 dark:text-sage-300 px-2 py-0.5 rounded-md">
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
                <h4 className="text-[11px] font-bold text-sage-600 dark:text-sage-400 uppercase tracking-wider mb-2">
                  Decision Trace ({analysis.evidence.decision_trace.length} steps)
                </h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {analysis.evidence.decision_trace.map((step, idx) => (
                    <div key={idx} className="p-2.5 bg-ivory-50/70 dark:bg-night-800/70 rounded-xl border border-ivory-200 dark:border-night-700 text-[11px] text-sage-700 dark:text-sage-300 flex items-center justify-between">
                      <span className="font-semibold text-forest-950 dark:text-ivory-100">{step.step || `Step ${idx + 1}`}</span>
                      <span className="font-mono text-sage-500 dark:text-sage-400">{typeof step.outcome === 'object' ? JSON.stringify(step.outcome) : String(step.outcome || '')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Academic Non-Clinical Notice */}
          <div className="p-4 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/50 rounded-2xl text-[11px] text-amber-900 dark:text-amber-300 flex items-start space-x-2.5 shadow-xs">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p>
              <strong>Academic Natural Language Processing Engine:</strong> Signals displayed here are computational linguistic features extracted for reflection and research evaluation. They do not constitute diagnostic medical tests or psychiatric clinical assessments.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

