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
  Compass,
  Bot,
  Zap,
  Leaf,
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
  // Mode selection: 'guided' (default) | 'slm' (TinyLlama standalone chat)
  const [chatMode, setChatMode] = useState('guided');

  // ---------------------------------------------------------------------------
  // 1. GUIDED MODE STATE
  // ---------------------------------------------------------------------------
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

  // Guided SLM Assistant Drawer state
  const [slmLoading, setSlmLoading] = useState(false);
  const [slmResult, setSlmResult] = useState(null);
  const [slmError, setSlmError] = useState(null);
  const [showSlmPanel, setShowSlmPanel] = useState(false);
  const [copiedSlm, setCopiedSlm] = useState(false);

  // ---------------------------------------------------------------------------
  // 2. STANDALONE TINYLLAMA SLM CHAT STATE
  // ---------------------------------------------------------------------------
  const [slmChats, setSlmChats] = useState([]);
  const [selectedSlmId, setSelectedSlmId] = useState(null);
  const [activeSlmChat, setActiveSlmChat] = useState(null);

  const [loadingSlmList, setLoadingSlmList] = useState(false);
  const [loadingSlmDetail, setLoadingSlmDetail] = useState(false);
  const [creatingSlm, setCreatingSlm] = useState(false);
  const [sendingSlm, setSendingSlm] = useState(false);
  const [deletingSlmId, setDeletingSlmId] = useState(null);

  const [slmInputContent, setSlmInputContent] = useState('');
  const [slmChatError, setSlmChatError] = useState(null);
  const [slmSendError, setSlmSendError] = useState(null);

  // Mobile view toggle: 'list' or 'chat'
  const [mobileView, setMobileView] = useState('list');

  // Delete confirmation modal state: { id, mode: 'guided' | 'slm' }
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // ---------------------------------------------------------------------------
  // GUIDED MODE EFFECTS & HANDLERS
  // ---------------------------------------------------------------------------
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

  useEffect(() => {
    if (chatMode !== 'guided') return;
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
  }, [chatMode, selectedId, loadConversations]);

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
      setTimeout(() => scrollToBottom(true), 50);

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
      // Ignore
    }
  };

  const handleUseInComposer = () => {
    if (!slmResult?.text) return;
    setInputContent((prev) => (prev ? `${prev}\n\n${slmResult.text}` : slmResult.text));
  };

  // ---------------------------------------------------------------------------
  // STANDALONE SLM CHAT EFFECTS & HANDLERS
  // ---------------------------------------------------------------------------
  const loadSlmChats = useCallback(async (selectFirst = false) => {
    setLoadingSlmList(true);
    setSlmChatError(null);
    try {
      const list = await slmService.listChats();
      setSlmChats(list);
      if (selectFirst && list.length > 0) {
        setSelectedSlmId(list[0].id);
      }
    } catch (err) {
      setSlmChatError(getErrorMessage(err));
    } finally {
      setLoadingSlmList(false);
    }
  }, []);

  useEffect(() => {
    if (chatMode !== 'slm') return;
    if (!selectedSlmId) {
      setActiveSlmChat(null);
      return;
    }

    let isMounted = true;
    async function fetchSlmDetail() {
      setLoadingSlmDetail(true);
      setSlmSendError(null);
      try {
        const detail = await slmService.getChat(selectedSlmId);
        if (isMounted) {
          setActiveSlmChat(detail);
          setTimeout(() => scrollToBottom(false), 50);
        }
      } catch (err) {
        if (isMounted) {
          setSelectedSlmId(null);
          loadSlmChats();
        }
      } finally {
        if (isMounted) {
          setLoadingSlmDetail(false);
        }
      }
    }

    fetchSlmDetail();
    return () => {
      isMounted = false;
    };
  }, [chatMode, selectedSlmId, loadSlmChats]);

  const handleCreateSlmChat = async () => {
    if (creatingSlm) return;
    setCreatingSlm(true);
    setSlmChatError(null);
    try {
      const newChat = await slmService.createChat();
      setSlmChats((prev) => [
        {
          id: newChat.id,
          title: newChat.title,
          message_count: newChat.messages.length,
          created_at: newChat.created_at,
          updated_at: newChat.updated_at,
        },
        ...prev,
      ]);
      setSelectedSlmId(newChat.id);
      setActiveSlmChat(newChat);
      setMobileView('chat');
    } catch (err) {
      setSlmChatError(getErrorMessage(err));
    } finally {
      setCreatingSlm(false);
    }
  };

  const handleSendSlmMessage = async (e) => {
    if (e) e.preventDefault();
    const trimmed = slmInputContent.trim();
    if (!trimmed || sendingSlm || !selectedSlmId) return;

    setSendingSlm(true);
    setSlmSendError(null);
    try {
      const updated = await slmService.sendMessage(selectedSlmId, trimmed);
      setActiveSlmChat(updated);
      setSlmInputContent('');
      setTimeout(() => scrollToBottom(true), 50);

      setSlmChats((prev) =>
        prev.map((c) =>
          c.id === updated.id
            ? {
                ...c,
                title: updated.title,
                message_count: updated.messages.length,
                updated_at: updated.updated_at,
              }
            : c
        )
      );
    } catch (err) {
      setSlmSendError(getErrorMessage(err));
    } finally {
      setSendingSlm(false);
    }
  };

  // ---------------------------------------------------------------------------
  // MODE SWITCHING & UNIFIED DELETE
  // ---------------------------------------------------------------------------
  const handleSwitchMode = (newMode) => {
    if (newMode === chatMode) return;
    setChatMode(newMode);
    setMobileView('list');
    if (newMode === 'guided') {
      if (conversations.length === 0) loadConversations(true);
    } else {
      if (slmChats.length === 0) loadSlmChats(true);
    }
  };

  useEffect(() => {
    loadConversations(true);
    loadSlmChats(false);
  }, [loadConversations, loadSlmChats]);

  // Handle deletions
  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    const { id, mode } = deleteConfirm;

    if (mode === 'guided') {
      setDeletingId(id);
      try {
        await conversationService.deleteConversation(id);
        const remaining = conversations.filter((c) => c.id !== id);
        setConversations(remaining);
        if (selectedId === id) {
          setSelectedId(remaining.length > 0 ? remaining[0].id : null);
          if (remaining.length === 0) {
            setActiveConversation(null);
            setMobileView('list');
          }
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setDeletingId(null);
        setDeleteConfirm(null);
      }
    } else {
      setDeletingSlmId(id);
      try {
        await slmService.deleteChat(id);
        const remaining = slmChats.filter((c) => c.id !== id);
        setSlmChats(remaining);
        if (selectedSlmId === id) {
          setSelectedSlmId(remaining.length > 0 ? remaining[0].id : null);
          if (remaining.length === 0) {
            setActiveSlmChat(null);
            setMobileView('list');
          }
        }
      } catch (err) {
        setSlmChatError(getErrorMessage(err));
      } finally {
        setDeletingSlmId(null);
        setDeleteConfirm(null);
      }
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (chatMode === 'guided') {
        handleSendMessage();
      } else {
        handleSendSlmMessage();
      }
    }
  };

  // Scroll to bottom on messages change
  useEffect(() => {
    if (chatMode === 'guided' && activeConversation?.messages) {
      scrollToBottom(true);
    } else if (chatMode === 'slm' && activeSlmChat?.messages) {
      scrollToBottom(true);
    }
  }, [chatMode, activeConversation?.messages, activeSlmChat?.messages]);

  const userMessages = activeConversation?.messages?.filter((m) => m.role === 'user') || [];
  const hasUserMessages = userMessages.length > 0;

  const getStageNumber = (stage) => {
    const idx = STAGE_ORDER.indexOf(stage);
    return idx >= 0 ? idx + 1 : 1;
  };

  // Identify active model in SLM chat from messages
  const latestAssistantSlmMsg = activeSlmChat?.messages
    ?.filter((m) => m.role === 'assistant' && m.model)
    ?.slice(-1)[0];
  const activeModelName = latestAssistantSlmMsg?.model || 'TinyLlama/TinyLlama-1.1B-Chat-v1.0 + LoRA';
  const isMockMode = activeModelName.includes('[MOCK]');

  return (
    <div className="h-[calc(100vh-7.5rem)] flex flex-col">
      {/* Top Bar: Title, Mode Selector Pill & New Session Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 flex-shrink-0">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-forest-950 dark:text-ivory-50 tracking-tight font-display">
              Conversations
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-forest-100 dark:bg-forest-950/80 text-forest-800 dark:text-emerald-300 rounded-md border border-forest-200 dark:border-forest-800">
              {chatMode === 'guided' ? 'Guided Walk' : 'Continuous SLM'}
            </span>
          </div>
          <p className="text-xs text-sage-600 dark:text-sage-400 mt-0.5">
            {chatMode === 'guided'
              ? 'Deterministic 8-stage reflective dialogue with safety guardrails'
              : 'Standalone continuous multi-turn dialogue with fine-tuned TinyLlama'}
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Mode Selector Pill */}
          <div className="flex items-center bg-ivory-100 dark:bg-night-800 p-1 rounded-2xl border border-ivory-200 dark:border-night-700 shadow-xs">
            <button
              type="button"
              onClick={() => handleSwitchMode('guided')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                chatMode === 'guided'
                  ? 'bg-white dark:bg-night-700 text-forest-900 dark:text-ivory-50 shadow-soft'
                  : 'text-sage-600 dark:text-sage-400 hover:text-forest-950 dark:hover:text-ivory-200'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>EVARA Guided</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('slm')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                chatMode === 'slm'
                  ? 'bg-gradient-to-r from-forest-700 to-forest-800 dark:from-emerald-700 dark:to-emerald-800 text-ivory-50 shadow-soft'
                  : 'text-sage-600 dark:text-sage-400 hover:text-forest-950 dark:hover:text-ivory-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>TinyLlama SLM Chat</span>
            </button>
          </div>

          {/* New Chat Button */}
          {chatMode === 'guided' ? (
            <button
              type="button"
              onClick={handleCreateSession}
              disabled={creating}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-forest-700 to-forest-800 hover:from-forest-800 hover:to-forest-900 text-ivory-50 text-xs font-medium rounded-xl shadow-soft transition-all disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-forest-500"
              aria-label="Start a new guided session"
            >
              {creating ? (
                <div className="w-3.5 h-3.5 border-2 border-ivory-50 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>New Session</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreateSlmChat}
              disabled={creatingSlm}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-forest-700 to-forest-800 hover:from-forest-800 hover:to-forest-900 text-ivory-50 text-xs font-medium rounded-xl shadow-soft transition-all disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-forest-500"
              aria-label="Start a new SLM chat"
            >
              {creatingSlm ? (
                <div className="w-3.5 h-3.5 border-2 border-ivory-50 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>New SLM Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Error Banners */}
      {chatMode === 'guided' && error && (
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

      {chatMode === 'slm' && slmChatError && (
        <div className="mb-3 bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700 flex items-start space-x-2 flex-shrink-0">
          <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{slmChatError}</span>
          </div>
          <button
            type="button"
            onClick={() => loadSlmChats()}
            className="text-xs font-semibold underline hover:text-rose-900 ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 bg-white dark:bg-night-900 rounded-2xl border border-ivory-200 dark:border-night-700/60 shadow-soft overflow-hidden flex min-h-0 transition-colors duration-200">
        {/* =================================================================== */}
        {/* LEFT PANEL: SESSION / CHAT LIST                                     */}
        {/* =================================================================== */}
        <div
          className={`${
            mobileView === 'chat' ? 'hidden md:flex' : 'flex'
          } w-full md:w-80 border-r border-ivory-200 dark:border-night-700/60 flex-col flex-shrink-0 h-full bg-ivory-50/50 dark:bg-night-950/40`}
        >
          {chatMode === 'guided' ? (
            <>
              <div className="p-3.5 border-b border-ivory-200 dark:border-night-700/60 bg-white dark:bg-night-900 flex items-center justify-between">
                <span className="text-xs font-semibold text-sage-600 dark:text-sage-400 uppercase tracking-wider">
                  Guided Sessions ({conversations.length})
                </span>
                <span className="text-[10px] text-forest-800 dark:text-emerald-300 bg-forest-100 dark:bg-forest-950/80 border border-forest-200 dark:border-forest-800 px-2 py-0.5 rounded-md font-medium">
                  8-Stage Walk
                </span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-ivory-200 dark:divide-night-800">
                {loadingList ? (
                  <div className="p-4 space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="space-y-2 p-2">
                        <div className="h-4 bg-ivory-200 dark:bg-night-800 rounded animate-pulse w-3/4"></div>
                        <div className="h-3 bg-ivory-100 dark:bg-night-850 rounded animate-pulse w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="p-6 text-center text-xs text-sage-500 dark:text-sage-400 space-y-3">
                    <MessageSquare className="w-8 h-8 text-sage-300 dark:text-sage-600 mx-auto" />
                    <p className="font-semibold text-forest-950 dark:text-ivory-100">No guided sessions yet.</p>
                    <p className="text-[11px] text-sage-500 dark:text-sage-400">
                      Start a session to begin your structured 8-stage reflection walk.
                    </p>
                    <button
                      type="button"
                      onClick={handleCreateSession}
                      className="px-3.5 py-1.5 bg-forest-700 hover:bg-forest-800 text-ivory-50 rounded-xl text-xs font-medium transition-colors shadow-xs"
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
                            ? 'bg-forest-50/80 dark:bg-forest-950/60 border-l-4 border-forest-600 dark:border-forest-400'
                            : 'hover:bg-ivory-100/70 dark:hover:bg-night-800/60 border-l-4 border-transparent'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p
                            className={`text-xs font-semibold truncate ${
                              isSelected ? 'text-forest-950 dark:text-emerald-300' : 'text-forest-900 dark:text-ivory-100'
                            }`}
                          >
                            {conv.title}
                          </p>
                          <div className="flex items-center space-x-2 mt-1.5 flex-wrap gap-y-1">
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-ivory-100 dark:bg-night-800 text-sage-700 dark:text-sage-300 rounded border border-ivory-200 dark:border-night-700">
                              {STAGE_LABELS[conv.stage] || conv.stage}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                                isCompleted
                                  ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                                  : 'bg-forest-100 dark:bg-forest-950/70 text-forest-800 dark:text-forest-300'
                              }`}
                            >
                              {isCompleted ? 'Completed' : 'Active'}
                            </span>
                            <span className="text-[10px] text-sage-400 dark:text-sage-500">
                              {conv.message_count} msgs
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm({ id: conv.id, mode: 'guided' });
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-sage-400 hover:text-rose-600 dark:hover:text-rose-400 transition-opacity rounded-lg"
                          aria-label="Delete guided conversation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <>
              <div className="p-3.5 border-b border-ivory-200 dark:border-night-700/60 bg-white dark:bg-night-900 flex items-center justify-between">
                <span className="text-xs font-semibold text-forest-900 dark:text-ivory-100 uppercase tracking-wider">
                  SLM Chats ({slmChats.length})
                </span>
                <span className="text-[10px] text-forest-800 dark:text-emerald-300 bg-forest-100 dark:bg-forest-950/80 border border-forest-200 dark:border-forest-800 px-2 py-0.5 rounded-md font-medium">
                  Continuous
                </span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-ivory-200 dark:divide-night-800">
                {loadingSlmList ? (
                  <div className="p-4 space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="space-y-2 p-2">
                        <div className="h-4 bg-forest-100 dark:bg-night-800 rounded animate-pulse w-3/4"></div>
                        <div className="h-3 bg-forest-50 dark:bg-night-850 rounded animate-pulse w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : slmChats.length === 0 ? (
                  <div className="p-6 text-center text-xs text-sage-500 dark:text-sage-400 space-y-3">
                    <Sparkles className="w-8 h-8 text-forest-400 dark:text-forest-600 mx-auto" />
                    <p className="font-semibold text-forest-950 dark:text-ivory-100">No TinyLlama SLM chats yet.</p>
                    <p className="text-[11px] text-sage-500 dark:text-sage-400">
                      Start a free-flowing reflection chat powered by the fine-tuned TinyLlama model.
                    </p>
                    <button
                      type="button"
                      onClick={handleCreateSlmChat}
                      className="px-3.5 py-1.5 bg-forest-700 hover:bg-forest-800 text-ivory-50 rounded-xl text-xs font-medium transition-colors shadow-xs"
                    >
                      Start First SLM Chat
                    </button>
                  </div>
                ) : (
                  slmChats.map((chat) => {
                    const isSelected = selectedSlmId === chat.id;

                    return (
                      <div
                        key={chat.id}
                        onClick={() => {
                          setSelectedSlmId(chat.id);
                          setMobileView('chat');
                        }}
                        className={`p-3.5 cursor-pointer transition-colors flex items-start justify-between group ${
                          isSelected
                            ? 'bg-forest-50/80 dark:bg-forest-950/60 border-l-4 border-forest-600 dark:border-forest-400'
                            : 'hover:bg-ivory-100/70 dark:hover:bg-night-800/60 border-l-4 border-transparent'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p
                            className={`text-xs font-semibold truncate ${
                              isSelected ? 'text-forest-950 dark:text-emerald-300' : 'text-forest-900 dark:text-ivory-100'
                            }`}
                          >
                            {chat.title}
                          </p>
                          <div className="flex items-center space-x-2 mt-1.5 flex-wrap gap-y-1">
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-forest-100 dark:bg-forest-950/80 text-forest-800 dark:text-emerald-300 rounded border border-forest-200 dark:border-forest-800 flex items-center space-x-1">
                              <Bot className="w-2.5 h-2.5" />
                              <span>TinyLlama</span>
                            </span>
                            <span className="text-[10px] text-sage-400 dark:text-sage-500">
                              {chat.message_count} msgs
                            </span>
                            <span className="text-[10px] text-sage-400 dark:text-sage-500">
                              {new Date(chat.updated_at).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm({ id: chat.id, mode: 'slm' });
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-sage-400 hover:text-rose-600 dark:hover:text-rose-400 transition-opacity rounded-lg"
                          aria-label="Delete SLM chat"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* =================================================================== */}
        {/* RIGHT PANEL: DIALOGUE STREAM (GUIDED OR SLM CHAT)                  */}
        {/* =================================================================== */}
        <div
          className={`${
            mobileView === 'list' ? 'hidden md:flex' : 'flex'
          } flex-1 flex-col h-full bg-[#faf9f6]/30 dark:bg-night-950/30 min-w-0`}
        >
          {chatMode === 'guided' ? (
            /* ------------------ GUIDED MODE DIALOGUE ------------------ */
            activeConversation ? (
              <>
                {/* Guided Header Bar */}
                <div className="p-3 md:p-4 border-b border-ivory-200 dark:border-night-700/60 bg-white dark:bg-night-900 flex items-center justify-between flex-shrink-0 transition-colors">
                  <div className="flex items-center space-x-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileView('list')}
                      className="md:hidden p-1.5 text-sage-500 hover:text-forest-900 dark:hover:text-ivory-100 rounded-lg"
                      aria-label="Back to conversations list"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <h2 className="text-sm font-bold text-forest-950 dark:text-ivory-50 truncate font-display">
                          {activeConversation.title}
                        </h2>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                            activeConversation.status === 'completed'
                              ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                              : 'bg-forest-100 dark:bg-forest-950/70 text-forest-800 dark:text-emerald-300 border border-forest-200 dark:border-forest-800/60'
                          }`}
                        >
                          {activeConversation.status === 'completed' ? 'Completed' : 'Active Walk'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 mt-0.5 text-[11px] text-sage-600 dark:text-sage-400">
                        <span>Stage {getStageNumber(activeConversation.stage)} of 8:</span>
                        <span className="font-medium text-forest-900 dark:text-ivory-200">
                          {STAGE_LABELS[activeConversation.stage] || activeConversation.stage}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SLM Assistant Trigger Button */}
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={handleGenerateSLM}
                      disabled={slmLoading || !hasUserMessages}
                      title={
                        !hasUserMessages
                          ? 'Send at least one message first to ask SLM Assistant'
                          : 'Ask Local TinyLlama for a reflection suggestion'
                      }
                      className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-forest-800 dark:text-emerald-300 bg-forest-50 dark:bg-forest-950/80 hover:bg-forest-100 dark:hover:bg-forest-900/80 border border-forest-200 dark:border-forest-800 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-forest-600 dark:text-emerald-400" />
                      <span className="hidden sm:inline">Ask SLM Assistant</span>
                    </button>

                    <div className="hidden lg:flex items-center space-x-1 text-[11px] text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/50 px-2.5 py-1 rounded-xl">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <span>Academic Guided Dialogue</span>
                    </div>
                  </div>
                </div>

                {/* Stage Progress Bar */}
                <div className="bg-ivory-100/80 dark:bg-night-950 px-4 py-2 border-b border-ivory-200 dark:border-night-800 flex-shrink-0">
                  <div className="flex items-center justify-between text-[11px] text-sage-600 dark:text-sage-400 mb-1">
                    <span>Dialogue Progression</span>
                    <span className="font-semibold text-forest-900 dark:text-ivory-100">
                      Step {getStageNumber(activeConversation.stage)}/8
                    </span>
                  </div>
                  <div className="w-full bg-ivory-200 dark:bg-night-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-forest-600 dark:bg-emerald-500 h-full transition-all duration-300"
                      style={{
                        width: `${(getStageNumber(activeConversation.stage) / 8) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>

                {/* Guided SLM Drawer Panel */}
                {showSlmPanel && (
                  <div className="border-b border-forest-200 dark:border-night-700 bg-forest-50/60 dark:bg-night-850 p-3.5 md:p-4 flex-shrink-0 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="flex items-center space-x-1.5 text-xs font-bold text-forest-950 dark:text-ivory-100 font-display">
                          <Sparkles className="w-4 h-4 text-forest-600 dark:text-emerald-400" />
                          <span>Local SLM Reflection Suggestion</span>
                        </span>
                        {slmResult && (
                          <>
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-white dark:bg-night-900 border border-ivory-200 dark:border-night-700 text-forest-900 dark:text-ivory-200 rounded">
                              {slmResult.model}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                                slmResult.mock
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                  : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              }`}
                            >
                              {slmResult.mock ? 'Mock Mode' : 'Real Fine-Tuned Model'}
                            </span>
                            {slmResult.duration_ms != null && (
                              <span className="text-[10px] text-sage-500 dark:text-sage-400 font-mono">
                                {Math.round(slmResult.duration_ms)}ms
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowSlmPanel(false)}
                        className="text-sage-400 hover:text-forest-900 dark:hover:text-ivory-100 p-1 rounded-lg"
                        aria-label="Close SLM panel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {slmLoading ? (
                      <div className="flex items-center space-x-2.5 py-3 text-xs text-forest-800 dark:text-emerald-300">
                        <div className="w-4 h-4 border-2 border-forest-600 dark:border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                        <span>
                          Running Phase 5 pipeline (NLP analysis → safety triage → generation → validation)...
                        </span>
                      </div>
                    ) : slmError ? (
                      <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
                        <span>{slmError}</span>
                        <button
                          type="button"
                          onClick={handleGenerateSLM}
                          className="text-xs font-semibold underline hover:text-rose-900 dark:hover:text-rose-200 ml-2"
                        >
                          Retry
                        </button>
                      </div>
                    ) : slmResult ? (
                      <div className="space-y-2.5">
                        <div className="p-3 bg-white dark:bg-night-900 border border-forest-200/80 dark:border-night-700 rounded-xl text-xs sm:text-sm text-forest-950 dark:text-ivory-100 whitespace-pre-wrap leading-relaxed shadow-xs">
                          {slmResult.text}
                        </div>
                        <div className="flex items-center justify-between flex-wrap gap-2 text-xs pt-1">
                          <p className="text-[10px] text-sage-500 dark:text-sage-400">
                            Academic reflection assistant. Does not advance Guided dialogue stages.
                          </p>
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={handleCopySLM}
                              className="px-2.5 py-1 text-xs font-medium text-sage-700 dark:text-sage-300 hover:text-forest-900 dark:hover:text-ivory-100 bg-white dark:bg-night-800 border border-ivory-200 dark:border-night-700 rounded-lg hover:bg-forest-50 dark:hover:bg-night-700 flex items-center space-x-1"
                            >
                              {copiedSlm ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-sage-500" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={handleUseInComposer}
                              className="px-2.5 py-1 text-xs font-medium text-forest-800 dark:text-emerald-300 hover:text-forest-950 dark:hover:text-emerald-200 bg-forest-100/70 dark:bg-forest-950/70 border border-forest-200 dark:border-forest-800 rounded-lg hover:bg-forest-200/70"
                            >
                              Use in Composer
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Guided Message Thread */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
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
                          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-forest-700 to-forest-900 dark:from-forest-600 dark:to-forest-800 text-ivory-100 font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs mt-0.5">
                            <Leaf className="w-3.5 h-3.5 text-emerald-300" />
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                            isAssistant
                              ? 'bg-white dark:bg-night-850 text-forest-950 dark:text-ivory-100 border border-ivory-200 dark:border-night-700/80 rounded-tl-xs shadow-soft'
                              : 'bg-gradient-to-r from-forest-700 to-forest-800 dark:from-forest-600 dark:to-forest-700 text-ivory-50 rounded-tr-xs shadow-soft'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 mb-1.5">
                            <span
                              className={`text-[10px] font-bold ${
                                isAssistant ? 'text-forest-700 dark:text-emerald-400' : 'text-ivory-200'
                              }`}
                            >
                              {isAssistant ? 'EVARA (Guided Walk)' : 'You'}
                            </span>
                            <span
                              className={`text-[10px] ${
                                isAssistant ? 'text-sage-400 dark:text-sage-500' : 'text-ivory-300'
                              }`}
                            >
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    );
                  })}

                  {activeConversation.status === 'completed' && (
                    <div className="my-4 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/50 rounded-2xl p-4 text-xs text-emerald-900 dark:text-emerald-300 flex items-start space-x-3 shadow-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Session Completed</p>
                        <p className="mt-0.5 text-emerald-800/90 dark:text-emerald-300/80">
                          This reflection dialogue has reached closure. Your commitments have been reflected back to you above.
                        </p>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {sendError && (
                  <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/40 border-t border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
                    <span className="truncate">{sendError}</span>
                    <button
                      type="button"
                      onClick={() => setSendError(null)}
                      className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 font-bold ml-2"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Guided Composer */}
                <div className="p-3 md:p-4 border-t border-ivory-200 dark:border-night-700/60 bg-white dark:bg-night-900 flex-shrink-0 transition-colors">
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
                        className="w-full pr-12 px-3.5 py-2.5 text-xs sm:text-sm bg-white dark:bg-night-800 text-forest-950 dark:text-ivory-100 border border-ivory-300 dark:border-night-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-600 dark:focus:border-forest-400 resize-none transition-colors disabled:bg-ivory-100 dark:disabled:bg-night-950 disabled:cursor-not-allowed placeholder:text-sage-400"
                      />
                      <button
                        type="submit"
                        disabled={sending || !inputContent.trim()}
                        className="absolute right-2.5 bottom-3.5 p-2 bg-gradient-to-r from-forest-700 to-forest-800 hover:from-forest-800 hover:to-forest-900 text-ivory-50 rounded-xl shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-forest-500"
                        aria-label="Send message"
                      >
                        {sending ? (
                          <div className="w-4 h-4 border-2 border-ivory-50 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-sage-500 dark:text-sage-400 px-1">
                      <span>Press Enter to send · Shift+Enter for new line</span>
                      <span>{inputContent.length} / 4000</span>
                    </div>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-sage-400 dark:text-sage-500">
                <MessageSquare className="w-12 h-12 text-sage-200 dark:text-sage-700 mb-3" />
                <p className="text-sm font-semibold text-forest-950 dark:text-ivory-100 mb-1">No session selected</p>
                <p className="text-xs text-sage-600 dark:text-sage-400 max-w-sm mb-4">
                  Choose an existing guided reflection session or start a new one to begin.
                </p>
                <button
                  type="button"
                  onClick={handleCreateSession}
                  disabled={creating}
                  className="px-4 py-2 bg-forest-700 hover:bg-forest-800 text-ivory-50 rounded-xl text-xs font-medium shadow-soft transition-colors"
                >
                  Create Guided Session
                </button>
              </div>
            )
          ) : (
            /* ------------------ STANDALONE SLM CHAT DIALOGUE ------------------ */
            activeSlmChat ? (
              <>
                {/* SLM Chat Header Bar */}
                <div className="p-3 md:p-4 border-b border-ivory-200 dark:border-night-700/60 bg-white dark:bg-night-900 flex items-center justify-between flex-shrink-0 transition-colors">
                  <div className="flex items-center space-x-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileView('list')}
                      className="md:hidden p-1.5 text-sage-500 hover:text-forest-900 dark:hover:text-ivory-100 rounded-lg"
                      aria-label="Back to chat list"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <h2 className="text-sm font-bold text-forest-950 dark:text-ivory-50 truncate font-display">
                          {activeSlmChat.title}
                        </h2>
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-forest-100 dark:bg-forest-950/80 text-forest-800 dark:text-emerald-300 rounded-full flex items-center space-x-1 border border-forest-200 dark:border-forest-800">
                          <Bot className="w-3 h-3 text-forest-600 dark:text-emerald-400" />
                          <span>Continuous SLM</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-sage-600 dark:text-sage-400 mt-0.5 truncate max-w-md">
                        Active Model: <span className="font-mono text-forest-900 dark:text-ivory-200 font-medium">{activeModelName}</span>
                      </p>
                    </div>
                  </div>

                  {/* Active Model Badges */}
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-medium rounded-md border ${
                        isMockMode
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      }`}
                    >
                      {isMockMode ? 'Mock Mode' : 'Real Fine-Tuned Model'}
                    </span>
                    <div className="hidden lg:flex items-center space-x-1.5 text-[11px] text-sage-600 dark:text-sage-300 bg-ivory-50 dark:bg-night-800 border border-ivory-200 dark:border-night-700 px-2.5 py-1 rounded-xl">
                      <ShieldAlert className="w-3.5 h-3.5 text-forest-600 dark:text-emerald-400 flex-shrink-0" />
                      <span>Non-Clinical Reflection</span>
                    </div>
                  </div>
                </div>

                {/* SLM Message Thread */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                  {activeSlmChat.messages.map((msg, index) => {
                    const isAssistant = msg.role === 'assistant';

                    return (
                      <div
                        key={index}
                        className={`flex items-start gap-2.5 ${
                          isAssistant ? 'justify-start' : 'justify-end'
                        }`}
                      >
                        {isAssistant && (
                          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-forest-700 to-forest-900 dark:from-forest-600 dark:to-forest-800 text-ivory-100 font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs mt-0.5">
                            <Bot className="w-4 h-4 text-emerald-300" />
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                            isAssistant
                              ? 'bg-white dark:bg-night-850 text-forest-950 dark:text-ivory-100 border border-ivory-200 dark:border-night-700/80 rounded-tl-xs shadow-soft'
                              : 'bg-gradient-to-r from-forest-700 to-forest-800 dark:from-forest-600 dark:to-forest-700 text-ivory-50 rounded-tr-xs shadow-soft'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 mb-1.5">
                            <div className="flex items-center space-x-1.5">
                              <span
                                className={`text-[10px] font-bold ${
                                  isAssistant ? 'text-forest-700 dark:text-emerald-400' : 'text-ivory-200'
                                }`}
                              >
                                {isAssistant ? 'EVARA (TinyLlama SLM)' : 'You'}
                              </span>
                              {isAssistant && msg.duration_ms != null && (
                                <span className="text-[9px] text-sage-400 dark:text-sage-500 font-mono">
                                  ({Math.round(msg.duration_ms)}ms)
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-[10px] ${
                                isAssistant ? 'text-sage-400 dark:text-sage-500' : 'text-ivory-300'
                              }`}
                            >
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    );
                  })}

                  {sendingSlm && (
                    <div className="flex items-start gap-2.5 justify-start">
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-forest-700 to-forest-900 dark:from-forest-600 dark:to-forest-800 text-ivory-100 font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs mt-0.5">
                        <Bot className="w-4 h-4 text-emerald-300" />
                      </div>
                      <div className="bg-white dark:bg-night-850 border border-forest-200 dark:border-night-700 rounded-2xl rounded-tl-xs p-3.5 text-xs text-forest-900 dark:text-ivory-200 shadow-soft flex items-center space-x-2">
                        <div className="w-3.5 h-3.5 border-2 border-forest-600 dark:border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                        <span>TinyLlama is generating a reflection...</span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {slmSendError && (
                  <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/40 border-t border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
                    <span className="truncate">{slmSendError}</span>
                    <button
                      type="button"
                      onClick={() => setSlmSendError(null)}
                      className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 font-bold ml-2"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* SLM Chat Composer */}
                <div className="p-3 md:p-4 border-t border-ivory-200 dark:border-night-700/60 bg-white dark:bg-night-900 flex-shrink-0 transition-colors">
                  <form onSubmit={handleSendSlmMessage} className="space-y-2">
                    <div className="relative">
                      <textarea
                        rows={2}
                        maxLength={4000}
                        value={slmInputContent}
                        onChange={(e) => setSlmInputContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={sendingSlm}
                        placeholder="Talk freely with TinyLlama... (Enter to send, Shift+Enter for new line)"
                        className="w-full pr-12 px-3.5 py-2.5 text-xs sm:text-sm bg-white dark:bg-night-800 text-forest-950 dark:text-ivory-100 border border-ivory-300 dark:border-night-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-600 dark:focus:border-forest-400 resize-none transition-colors disabled:bg-ivory-100 dark:disabled:bg-night-950 disabled:cursor-not-allowed placeholder:text-sage-400"
                      />
                      <button
                        type="submit"
                        disabled={sendingSlm || !slmInputContent.trim()}
                        className="absolute right-2.5 bottom-3.5 p-2 bg-gradient-to-r from-forest-700 to-forest-800 hover:from-forest-800 hover:to-forest-900 text-ivory-50 rounded-xl shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-forest-500"
                        aria-label="Send SLM chat message"
                      >
                        {sendingSlm ? (
                          <div className="w-4 h-4 border-2 border-ivory-50 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-sage-500 dark:text-sage-400 px-1">
                      <span>Multi-turn SLM conversation · Enter to send</span>
                      <span>{slmInputContent.length} / 4000</span>
                    </div>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-sage-400 dark:text-sage-500">
                <Sparkles className="w-12 h-12 text-sage-300 dark:text-sage-600 mb-3" />
                <p className="text-sm font-semibold text-forest-950 dark:text-ivory-100 mb-1">No SLM chat selected</p>
                <p className="text-xs text-sage-600 dark:text-sage-400 max-w-sm mb-4">
                  Select an existing continuous chat session or create a new one to converse with TinyLlama.
                </p>
                <button
                  type="button"
                  onClick={handleCreateSlmChat}
                  disabled={creatingSlm}
                  className="px-4 py-2 bg-forest-700 hover:bg-forest-800 text-ivory-50 rounded-xl text-xs font-medium shadow-soft transition-colors"
                >
                  Create SLM Chat
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal (Unified) */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-night-950/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-night-900 rounded-2xl shadow-soft-lg border border-ivory-200 dark:border-night-700 p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center flex-shrink-0 border border-rose-200 dark:border-rose-900/60">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-forest-950 dark:text-ivory-50 font-display">
                Delete {deleteConfirm.mode === 'guided' ? 'Guided Session' : 'SLM Chat'}?
              </h3>
            </div>

            <p className="text-xs text-sage-600 dark:text-sage-400 leading-relaxed">
              Are you sure you want to delete this {deleteConfirm.mode === 'guided' ? 'guided reflection session' : 'SLM chat'}? This action will permanently remove the conversation history.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-sage-700 dark:text-sage-300 hover:bg-ivory-100 dark:hover:bg-night-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingId != null || deletingSlmId != null}
                className="px-3.5 py-1.5 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors flex items-center space-x-1.5 shadow-xs"
              >
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
