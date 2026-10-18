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
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Conversations</h1>
          <p className="text-xs text-slate-500">
            {chatMode === 'guided'
              ? 'Deterministic 8-stage reflective dialogue with safety guardrails'
              : 'Standalone continuous multi-turn dialogue with fine-tuned TinyLlama'}
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Mode Selector Pill */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => handleSwitchMode('guided')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                chatMode === 'guided'
                  ? 'bg-white text-brand-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>EVARA Guided</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('slm')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                chatMode === 'slm'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
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
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg shadow-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Start a new guided session"
            >
              {creating ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg shadow-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500"
              aria-label="Start a new SLM chat"
            >
              {creatingSlm ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex min-h-0">
        {/* =================================================================== */}
        {/* LEFT PANEL: SESSION / CHAT LIST                                     */}
        {/* =================================================================== */}
        <div
          className={`${
            mobileView === 'chat' ? 'hidden md:flex' : 'flex'
          } w-full md:w-80 border-r border-slate-200 flex-col flex-shrink-0 h-full bg-slate-50/50`}
        >
          {chatMode === 'guided' ? (
            <>
              <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Guided Sessions ({conversations.length})
                </span>
                <span className="text-[10px] text-brand-600 bg-brand-50 px-2 py-0.5 rounded font-medium">
                  8-Stage Walk
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
                    <p className="font-semibold text-slate-700">No guided sessions yet.</p>
                    <p className="text-[11px] text-slate-400">
                      Start a session to begin your structured 8-stage reflection walk.
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
                          <p
                            className={`text-xs font-semibold truncate ${
                              isSelected ? 'text-brand-900' : 'text-slate-800'
                            }`}
                          >
                            {conv.title}
                          </p>
                          <div className="flex items-center space-x-2 mt-1.5 flex-wrap gap-y-1">
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded">
                              {STAGE_LABELS[conv.stage] || conv.stage}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                                isCompleted
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-sky-100 text-sky-800'
                              }`}
                            >
                              {isCompleted ? 'Completed' : 'Active'}
                            </span>
                            <span className="text-[10px] text-slate-400">
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
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-opacity rounded"
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
              <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-900 uppercase tracking-wider">
                  SLM Chats ({slmChats.length})
                </span>
                <span className="text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded font-medium">
                  Continuous
                </span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {loadingSlmList ? (
                  <div className="p-4 space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="space-y-2 p-2">
                        <div className="h-4 bg-purple-100 rounded animate-pulse w-3/4"></div>
                        <div className="h-3 bg-purple-50 rounded animate-pulse w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : slmChats.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 space-y-3">
                    <Sparkles className="w-8 h-8 text-purple-300 mx-auto" />
                    <p className="font-semibold text-slate-700">No TinyLlama SLM chats yet.</p>
                    <p className="text-[11px] text-slate-400">
                      Start a free-flowing reflection chat powered by the fine-tuned TinyLlama model.
                    </p>
                    <button
                      type="button"
                      onClick={handleCreateSlmChat}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors"
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
                            ? 'bg-purple-50/80 border-l-4 border-purple-600'
                            : 'hover:bg-slate-100/70 border-l-4 border-transparent'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p
                            className={`text-xs font-semibold truncate ${
                              isSelected ? 'text-purple-900' : 'text-slate-800'
                            }`}
                          >
                            {chat.title}
                          </p>
                          <div className="flex items-center space-x-2 mt-1.5 flex-wrap gap-y-1">
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 rounded flex items-center space-x-1">
                              <Bot className="w-2.5 h-2.5" />
                              <span>TinyLlama</span>
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {chat.message_count} msgs
                            </span>
                            <span className="text-[10px] text-slate-400">
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
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-opacity rounded"
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
          } flex-1 flex-col h-full bg-slate-50/30 min-w-0`}
        >
          {chatMode === 'guided' ? (
            /* ------------------ GUIDED MODE DIALOGUE ------------------ */
            activeConversation ? (
              <>
                {/* Guided Header Bar */}
                <div className="p-3 md:p-4 border-b border-slate-200 bg-white flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center space-x-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileView('list')}
                      className="md:hidden p-1.5 text-slate-500 hover:text-slate-700 rounded-lg"
                      aria-label="Back to conversations list"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <h2 className="text-sm font-bold text-slate-900 truncate">
                          {activeConversation.title}
                        </h2>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                            activeConversation.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-brand-50 text-brand-700'
                          }`}
                        >
                          {activeConversation.status === 'completed' ? 'Completed' : 'Active Walk'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 mt-0.5 text-[11px] text-slate-500">
                        <span>Stage {getStageNumber(activeConversation.stage)} of 8:</span>
                        <span className="font-medium text-slate-700">
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
                      className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      <span className="hidden sm:inline">Ask SLM Assistant</span>
                    </button>

                    <div className="hidden lg:flex items-center space-x-1 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                      <span>Academic Guided Dialogue</span>
                    </div>
                  </div>
                </div>

                {/* Stage Progress Bar */}
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex-shrink-0">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span>Dialogue Progression</span>
                    <span className="font-semibold text-slate-700">
                      Step {getStageNumber(activeConversation.stage)}/8
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-brand-600 h-full transition-all duration-300"
                      style={{
                        width: `${(getStageNumber(activeConversation.stage) / 8) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>

                {/* Guided SLM Drawer Panel */}
                {showSlmPanel && (
                  <div className="border-b border-purple-200 bg-purple-50/80 p-3.5 md:p-4 flex-shrink-0 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="flex items-center space-x-1.5 text-xs font-bold text-purple-900">
                          <Sparkles className="w-4 h-4 text-purple-600" />
                          <span>Local SLM Reflection Suggestion</span>
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
                              {slmResult.mock ? 'Mock Mode' : 'Real Fine-Tuned Model'}
                            </span>
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
                          Running Phase 5 pipeline (NLP analysis → safety triage → generation → validation)...
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
                        <div className="p-3 bg-white border border-purple-200 rounded-lg text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed shadow-2xs">
                          {slmResult.text}
                        </div>
                        <div className="flex items-center justify-between flex-wrap gap-2 text-xs pt-1">
                          <p className="text-[10px] text-slate-500">
                            Academic reflection assistant. Does not advance Guided dialogue stages.
                          </p>
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={handleCopySLM}
                              className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded hover:bg-slate-50 flex items-center space-x-1"
                            >
                              {copiedSlm ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={handleUseInComposer}
                              className="px-2.5 py-1 text-xs font-medium text-purple-700 hover:text-purple-900 bg-purple-100/70 border border-purple-200 rounded hover:bg-purple-200/70"
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
                            <span
                              className={`text-[10px] font-bold ${
                                isAssistant ? 'text-slate-500' : 'text-brand-100'
                              }`}
                            >
                              {isAssistant ? 'Evara (Guided)' : 'You'}
                            </span>
                            <span
                              className={`text-[10px] ${
                                isAssistant ? 'text-slate-400' : 'text-brand-200'
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
                    <div className="my-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-800 flex items-start space-x-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Session Completed</p>
                        <p className="mt-0.5 text-emerald-700">
                          This reflection dialogue has reached closure. Your commitments have been reflected back to you above.
                        </p>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

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

                {/* Guided Composer */}
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
                  Choose an existing guided reflection session or start a new one to begin.
                </p>
                <button
                  type="button"
                  onClick={handleCreateSession}
                  disabled={creating}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors"
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
                <div className="p-3 md:p-4 border-b border-purple-200 bg-purple-50/50 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center space-x-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileView('list')}
                      className="md:hidden p-1.5 text-slate-500 hover:text-slate-700 rounded-lg"
                      aria-label="Back to chat list"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <h2 className="text-sm font-bold text-slate-900 truncate">
                          {activeSlmChat.title}
                        </h2>
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-800 rounded-full flex items-center space-x-1">
                          <Bot className="w-3 h-3 text-purple-600" />
                          <span>Continuous SLM</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-md">
                        Active Model: <span className="font-mono text-purple-900 font-medium">{activeModelName}</span>
                      </p>
                    </div>
                  </div>

                  {/* Active Model Badges */}
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-medium rounded border ${
                        isMockMode
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}
                    >
                      {isMockMode ? 'Mock Mode' : 'Real Fine-Tuned Model'}
                    </span>
                    <div className="hidden lg:flex items-center space-x-1 text-[11px] text-slate-600 bg-white border border-purple-200 px-2.5 py-1 rounded-lg">
                      <ShieldAlert className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
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
                          <div className="w-7 h-7 rounded-lg bg-purple-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs mt-0.5">
                            <Bot className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                            isAssistant
                              ? 'bg-white text-slate-800 border border-purple-200 rounded-tl-xs shadow-2xs'
                              : 'bg-purple-600 text-white rounded-tr-xs shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <div className="flex items-center space-x-1.5">
                              <span
                                className={`text-[10px] font-bold ${
                                  isAssistant ? 'text-purple-900' : 'text-purple-100'
                                }`}
                              >
                                {isAssistant ? 'Evara (TinyLlama SLM)' : 'You'}
                              </span>
                              {isAssistant && msg.duration_ms != null && (
                                <span className="text-[9px] text-slate-400 font-mono">
                                  ({Math.round(msg.duration_ms)}ms)
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-[10px] ${
                                isAssistant ? 'text-slate-400' : 'text-purple-200'
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
                      <div className="w-7 h-7 rounded-lg bg-purple-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs mt-0.5">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-white border border-purple-200 rounded-2xl rounded-tl-xs p-3.5 text-xs text-purple-900 shadow-2xs flex items-center space-x-2">
                        <div className="w-3.5 h-3.5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>TinyLlama is generating a reflection...</span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {slmSendError && (
                  <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 text-xs text-rose-700 flex items-center justify-between">
                    <span className="truncate">{slmSendError}</span>
                    <button
                      type="button"
                      onClick={() => setSlmSendError(null)}
                      className="text-rose-500 hover:text-rose-700 font-bold ml-2"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* SLM Chat Composer */}
                <div className="p-3 md:p-4 border-t border-purple-200 bg-white flex-shrink-0">
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
                        className="w-full pr-12 px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none transition-colors disabled:bg-slate-50 disabled:cursor-not-allowed"
                      />
                      <button
                        type="submit"
                        disabled={sendingSlm || !slmInputContent.trim()}
                        className="absolute right-2.5 bottom-3.5 p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500"
                        aria-label="Send SLM chat message"
                      >
                        {sendingSlm ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                      <span>Multi-turn SLM conversation · Enter to send</span>
                      <span>{slmInputContent.length} / 4000</span>
                    </div>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <Sparkles className="w-12 h-12 text-purple-300 mb-3" />
                <p className="text-sm font-semibold text-slate-700 mb-1">No SLM chat selected</p>
                <p className="text-xs text-slate-500 max-w-sm mb-4">
                  Select an existing continuous chat session or create a new one to converse with TinyLlama.
                </p>
                <button
                  type="button"
                  onClick={handleCreateSlmChat}
                  disabled={creatingSlm}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Delete {deleteConfirm.mode === 'guided' ? 'Guided Session' : 'SLM Chat'}?
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete this {deleteConfirm.mode === 'guided' ? 'guided reflection session' : 'SLM chat'}? This action will permanently remove the conversation history.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingId != null || deletingSlmId != null}
                className="px-3 py-1.5 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors flex items-center space-x-1.5 shadow-xs"
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
