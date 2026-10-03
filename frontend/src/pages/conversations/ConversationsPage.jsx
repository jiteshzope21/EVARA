import React, { useState, useEffect, useRef, useCallback } from 'react';
import conversationService from '../../services/conversationService';
import slmService from '../../services/slmService';
import { getErrorMessage } from '../../services/api';
import {
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ArrowLeft,
  ChevronRight,
  Info,
  Sparkles,
  Copy,
  Check,
  X,
} from 'lucide-react';

const STAGE_ORDER = [
  'opening',
  'problem_exploration',
  'cause_reflection',
  'prioritization',
  'strategy_exploration',
  'action_planning',
  'time_frequency',
  'closure',
];

const STAGE_LABELS = {
  opening: 'Opening',
  problem_exploration: 'Problem Exploration',
  cause_reflection: 'Cause Reflection',
  prioritization: 'Prioritization',
  strategy_exploration: 'Strategy Exploration',
  action_planning: 'Action Planning',
  time_frequency: 'Time & Frequency',
  closure: 'Closure',
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);

  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [inputContent, setInputContent] = useState('');
  const [error, setError] = useState(null);
  const [sendError, setSendError] = useState(null);

  // SLM Assistant state
  const [slmLoading, setSlmLoading] = useState(false);
  const [slmResult, setSlmResult] = useState(null);
  const [slmError, setSlmError] = useState(null);
  const [showSlmPanel, setShowSlmPanel] = useState(false);
  const [copiedSlm, setCopiedSlm] = useState(false);

  // Mobile view toggle: 'list' or 'chat'
  const [mobileView, setMobileView] = useState('list');

  // Delete confirmation modal state
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const messagesEndRef = useRef(null);

  // Auto-scroll to newest message
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // Fetch all conversation summaries
  const loadConversations = useCallback(async (selectFirst = false) => {
    setLoadingList(true);
    setError(null);
    try {
      const list = await conversationService.listConversations();
      setConversations(list);
      if (selectFirst && list.length > 0) {
        setSelectedId(list[0].id);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Fetch active conversation detail when selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setActiveConversation(null);
      setSlmResult(null);
      setShowSlmPanel(false);
      setSlmError(null);
      return;
    }

    let isMounted = true;
    async function fetchDetail() {
      setLoadingDetail(true);
      setSendError(null);
      setSlmResult(null);
      setShowSlmPanel(false);
      setSlmError(null);
      try {
        const detail = await conversationService.getConversation(selectedId);
        if (isMounted) {
          setActiveConversation(detail);
          setTimeout(() => scrollToBottom(false), 50);
        }
      } catch (err) {
        if (isMounted) {
          setSelectedId(null);
          loadConversations();
        }
      } finally {
        if (isMounted) {
          setLoadingDetail(false);
        }
      }
    }

    fetchDetail();

    return () => {
      isMounted = false;
    };
  }, [selectedId, loadConversations]);

  // Initial load
  useEffect(() => {
    loadConversations(true);
  }, [loadConversations]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (activeConversation?.messages) {
      scrollToBottom(true);
    }
  }, [activeConversation?.messages]);

  // Count user messages to guard SLM trigger
  const userMessages = activeConversation?.messages?.filter((m) => m.role === 'user') || [];
  const hasUserMessages = userMessages.length > 0;

  // Create new conversation session
  const handleCreateSession = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const newSession = await conversationService.createConversation();
      setConversations((prev) => [
        {
          id: newSession.id,
          title: newSession.title,
          stage: newSession.stage,
          status: newSession.status,
          message_count: newSession.messages.length,
          created_at: newSession.created_at,
          updated_at: newSession.updated_at,
        },
        ...prev,
      ]);
      setSelectedId(newSession.id);
      setActiveConversation(newSession);
      setMobileView('chat');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  // Send message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const trimmed = inputContent.trim();
    if (!trimmed || sending || !selectedId) return;

    setSending(true);
    setSendError(null);

    try {
      const updated = await conversationService.sendMessage(selectedId, trimmed);
      setActiveConversation(updated);
      setInputContent('');

      // Update metadata in conversation list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === updated.id
            ? {
                ...c,
                title: updated.title,
                stage: updated.stage,
                status: updated.status,
                message_count: updated.messages.length,
                updated_at: updated.updated_at,
              }
            : c
        )
      );
    } catch (err) {
      setSendError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  // Keyboard shortcut: Enter to send, Shift+Enter for newline
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // SLM Generation Handler
  const handleGenerateSLM = async () => {
    if (!selectedId || slmLoading || !hasUserMessages) return;
    setShowSlmPanel(true);
    setSlmLoading(true);
    setSlmError(null);
    try {
      const result = await slmService.generate(selectedId, false);
      setSlmResult(result);
    } catch (err) {
      setSlmError(getErrorMessage(err));
    } finally {
      setSlmLoading(false);
    }
  };

  const handleCopySLM = async () => {
    if (!slmResult?.text) return;
    try {
      await navigator.clipboard.writeText(slmResult.text);
      setCopiedSlm(true);
      setTimeout(() => setCopiedSlm(false), 2000);
    } catch (err) {
      // Ignore clipboard write error
    }
  };

  const handleUseInComposer = () => {
    if (!slmResult?.text) return;
    setInputContent((prev) => (prev ? `${prev}\n\n${slmResult.text}` : slmResult.text));
  };

  // Delete conversation
  const handleDeleteConversation = async (idToDelete) => {
    setDeletingId(idToDelete);
    try {
      await conversationService.deleteConversation(idToDelete);
      const remaining = conversations.filter((c) => c.id !== idToDelete);
      setConversations(remaining);

      if (selectedId === idToDelete) {
        if (remaining.length > 0) {
          setSelectedId(remaining[0].id);
        } else {
          setSelectedId(null);
          setActiveConversation(null);
          setMobileView('list');
        }
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
  };

  // Helper for stage progress (1-based index out of 8)
  const getStageNumber = (stage) => {
    const idx = STAGE_ORDER.indexOf(stage);
    return idx >= 0 ? idx + 1 : 1;
  };

  return (
    <div className="h-[calc(100vh-7.5rem)] flex flex-col">
      {/* Page Title & New Session Bar */}
      <div className="flex items-center justify-between pb-3 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Conversations</h1>
          <p className="text-xs text-slate-500">Reflective dialogue sessions &amp; stage progression</p>
        </div>

        <button
          type="button"
          onClick={handleCreateSession}
          disabled={creating}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg shadow-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-label="Start a new reflection session"
        >
          {creating ? (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Plus className="w-4 h-4" />
          )}
          <span>New Session</span>
        </button>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="mb-3 bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700 flex items-start space-x-2 flex-shrink-0">
          <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadConversations()}
            className="text-xs font-semibold underline hover:text-rose-900 ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Master-Detail Container */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex min-h-0">
        {/* Left Panel: Conversation List */}
        <div
          className={`${
            mobileView === 'chat' ? 'hidden md:flex' : 'flex'
          } w-full md:w-80 border-r border-slate-200 flex-col flex-shrink-0 h-full bg-slate-50/50`}
        >
          <div className="p-3 border-b border-slate-200 bg-white">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Your Sessions ({conversations.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingList ? (
              <div className="p-4 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2 p-2">
                    <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4"></div>
                    <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 space-y-3">
                <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">No conversation sessions yet.</p>
                <p className="text-[11px] text-slate-400">
                  Start a new session to begin your structured reflection dialogue.
                </p>
                <button
                  type="button"
                  onClick={handleCreateSession}
                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  Start First Session
                </button>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = selectedId === conv.id;
                const isCompleted = conv.status === 'completed';

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      setSelectedId(conv.id);
                      setMobileView('chat');
                    }}
                    className={`p-3.5 cursor-pointer transition-colors flex items-start justify-between group ${
                      isSelected
                        ? 'bg-brand-50/80 border-l-4 border-brand-600'
                        : 'hover:bg-slate-100/70 border-l-4 border-transparent'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className={`text-xs font-semibold truncate ${isSelected ? 'text-brand-900' : 'text-slate-800'}`}>
                        {conv.title}
                      </p>
                      <div className="flex items-center space-x-2 mt-1.5 flex-wrap gap-y-1">
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded">
                          {STAGE_LABELS[conv.stage] || conv.stage}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                            isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {conv.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(conv.updated_at).toLocaleDateString()} · {conv.message_count} msgs
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(conv.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all focus:opacity-100"
                      aria-label={`Delete conversation ${conv.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Active Conversation View */}
        <div
          className={`${
            mobileView === 'list' ? 'hidden md:flex' : 'flex'
          } flex-1 flex-col h-full bg-white min-w-0`}
        >
          {selectedId && activeConversation ? (
            <>
              {/* Conversation Header */}
              <div className="p-3.5 border-b border-slate-200 bg-white flex items-center justify-between gap-3 flex-shrink-0">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobileView('list')}
                    className="md:hidden p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded focus:outline-none"
                    aria-label="Back to sessions list"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-900 truncate">
                      {activeConversation.title}
                    </h2>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="text-[11px] font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                        Stage {getStageNumber(activeConversation.stage)} of 8: {STAGE_LABELS[activeConversation.stage] || activeConversation.stage}
                      </span>
                      <span
                        className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                          activeConversation.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {activeConversation.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  {/* On-Demand SLM Reflection Assistant Trigger */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!showSlmPanel) {
                        handleGenerateSLM();
                      } else {
                        setShowSlmPanel(false);
                      }
                    }}
                    disabled={!hasUserMessages || slmLoading}
                    className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                      showSlmPanel
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={
                      hasUserMessages
                        ? 'Request on-demand SLM reflection assistant insight'
                        : 'Send at least one message to use SLM reflection'
                    }
                  >
                    {slmLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">SLM Assistant</span>
                  </button>

                  <div className="hidden lg:flex items-center space-x-1 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <span>Academic Dialogue</span>
                  </div>
                </div>
              </div>

              {/* SLM Reflection Assistant Panel */}
              {showSlmPanel && (
                <div className="border-b border-purple-200 bg-purple-50/80 p-3.5 md:p-4 flex-shrink-0 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="flex items-center space-x-1.5 text-xs font-bold text-purple-900">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span>Local SLM Reflection Assistant</span>
                      </span>
                      {slmResult && (
                        <>
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-white border border-purple-200 text-purple-800 rounded">
                            {slmResult.model}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                              slmResult.mock
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {slmResult.mock ? 'Mock Mode' : 'Real Model'}
                          </span>
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-white text-slate-700 border border-slate-200 rounded">
                            Safety: {slmResult.safety_level}
                          </span>
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-white text-slate-700 border border-slate-200 rounded">
                            Policy: {slmResult.policy_used}
                          </span>
                          {slmResult.validated && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded flex items-center space-x-0.5">
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Validated</span>
                            </span>
                          )}
                          {slmResult.duration_ms != null && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {Math.round(slmResult.duration_ms)}ms
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSlmPanel(false)}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded"
                      aria-label="Close SLM panel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {slmLoading ? (
                    <div className="flex items-center space-x-2.5 py-3 text-xs text-purple-800">
                      <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>
                        Running Phase 5 pipeline (NLP analysis → safety check → response policy → generation → validation)...
                      </span>
                    </div>
                  ) : slmError ? (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center justify-between">
                      <span>{slmError}</span>
                      <button
                        type="button"
                        onClick={handleGenerateSLM}
                        className="text-xs font-semibold underline hover:text-rose-900 ml-2"
                      >
                        Retry
                      </button>
                    </div>
                  ) : slmResult ? (
                    <div className="space-y-2.5">
                      {slmResult.safety_bypass && (
                        <div className="p-2 bg-amber-100 border border-amber-300 rounded text-xs text-amber-900 font-medium flex items-center space-x-2">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                          <span>Urgent safety bypass applied. Policy guidance returned.</span>
                        </div>
                      )}
                      {slmResult.warnings && slmResult.warnings.length > 0 && (
                        <div className="text-[10px] text-purple-700 bg-purple-100/60 p-2 rounded border border-purple-200">
                          {slmResult.warnings.map((w, i) => (
                            <p key={i}>• {w}</p>
                          ))}
                        </div>
                      )}
                      <div className="p-3 bg-white border border-purple-200 rounded-lg text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed shadow-2xs">
                        {slmResult.text}
                      </div>
                      <div className="flex items-center justify-between flex-wrap gap-2 text-xs pt-1">
                        <p className="text-[10px] text-slate-500">
                          Academic reflection assistant. Does not modify conversation messages or advance dialogue stages.
                        </p>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={handleCopySLM}
                            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-2xs"
                          >
                            {copiedSlm ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={handleUseInComposer}
                            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 border border-purple-200 rounded-md transition-colors shadow-2xs"
                            title="Place reflection draft into composer without sending"
                          >
                            <span>Use in Composer</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleGenerateSLM}
                            disabled={slmLoading}
                            className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors shadow-2xs"
                          >
                            Regenerate
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Message Thread */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {loadingDetail ? (
                  <div className="space-y-4">
                    <div className="flex items-start space-x-2 max-w-lg">
                      <div className="w-7 h-7 rounded-full bg-slate-200 animate-pulse flex-shrink-0"></div>
                      <div className="bg-slate-100 rounded-2xl p-4 w-64 h-16 animate-pulse"></div>
                    </div>
                  </div>
                ) : (
                  <>
                    {activeConversation.messages.map((msg, index) => {
                      const isAssistant = msg.role === 'assistant';

                      return (
                        <div
                          key={index}
                          className={`flex items-start gap-2.5 ${
                            isAssistant ? 'justify-start' : 'justify-end'
                          }`}
                        >
                          {isAssistant && (
                            <div className="w-7 h-7 rounded-lg bg-brand-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs mt-0.5">
                              E
                            </div>
                          )}

                          <div
                            className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                              isAssistant
                                ? 'bg-slate-100/90 text-slate-800 border border-slate-200/60 rounded-tl-xs'
                                : 'bg-brand-600 text-white rounded-tr-xs shadow-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 mb-1">
                              <span className={`text-[10px] font-bold ${isAssistant ? 'text-slate-500' : 'text-brand-100'}`}>
                                {isAssistant ? 'Evara' : 'You'}
                              </span>
                              <span className={`text-[10px] ${isAssistant ? 'text-slate-400' : 'text-brand-200'}`}>
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      );
                    })}

                    {/* Completed Conversation Notice */}
                    {activeConversation.status === 'completed' && (
                      <div className="my-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-800 flex items-start space-x-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Session Completed</p>
                          <p className="mt-0.5 text-emerald-700">
                            This reflection dialogue has reached closure. Your commitments have been reflected back to you above. You may review them anytime or start a new session.
                          </p>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Send Error Notice */}
              {sendError && (
                <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 text-xs text-rose-700 flex items-center justify-between">
                  <span className="truncate">{sendError}</span>
                  <button
                    type="button"
                    onClick={() => setSendError(null)}
                    className="text-rose-500 hover:text-rose-700 font-bold ml-2"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Message Composer */}
              <div className="p-3 md:p-4 border-t border-slate-200 bg-white flex-shrink-0">
                <form onSubmit={handleSendMessage} className="space-y-2">
                  <div className="relative">
                    <textarea
                      rows={2}
                      maxLength={4000}
                      value={inputContent}
                      onChange={(e) => setInputContent(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={sending}
                      placeholder={
                        activeConversation.status === 'completed'
                          ? 'This session is completed. You may still send a follow-up or start a new session...'
                          : 'Type your reflection message (Enter to send, Shift+Enter for new line)...'
                      }
                      className="w-full pr-12 px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none transition-colors disabled:bg-slate-50 disabled:cursor-not-allowed"
                    />

                    <button
                      type="submit"
                      disabled={sending || !inputContent.trim()}
                      className="absolute right-2.5 bottom-3.5 p-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-500"
                      aria-label="Send message"
                    >
                      {sending ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                    <span>Press Enter to send · Shift+Enter for new line</span>
                    <span>{inputContent.length} / 4000</span>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <MessageSquare className="w-12 h-12 text-slate-200 mb-3" />
              <p className="text-sm font-semibold text-slate-700 mb-1">No session selected</p>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                Choose an existing reflection session from the list or start a new one to begin.
              </p>
              <button
                type="button"
                onClick={handleCreateSession}
                disabled={creating}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors"
              >
                Create New Session
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Delete Conversation?</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete this reflection session? This action will permanently remove the conversation history and cannot be undone.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteConversation(deleteConfirmId)}
                disabled={deletingId === deleteConfirmId}
                className="px-3 py-1.5 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors flex items-center space-x-1.5 shadow-xs"
              >
                {deletingId === deleteConfirmId ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Session</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
