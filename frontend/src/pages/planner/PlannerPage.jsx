import React, { useState, useEffect, useCallback } from 'react';
import plannerService from '../../services/plannerService';
import conversationService from '../../services/conversationService';
import { getErrorMessage } from '../../services/api';
import {
  CheckSquare,
  Plus,
  Clock,
  Calendar,
  Repeat,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  X,
  Check,
  Ban,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

const FILTER_TABS = [
  { id: 'all', label: 'All Plans' },
  { id: 'pending', label: 'Pending' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function PlannerPage() {
  const [plans, setPlans] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createData, setCreateData] = useState({
    action: '',
    date: '',
    time: '',
    frequency: '',
    conversation_id: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Edit Modal State
  const [editingPlan, setEditingPlan] = useState(null);
  const [editData, setEditData] = useState({
    action: '',
    date: '',
    time: '',
    frequency: '',
    status: 'pending',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState(null);

  // Delete Modal State
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Action state (completing specific plan)
  const [completingId, setCompletingId] = useState(null);

  // Fetch plans
  const loadPlans = useCallback(async (filter) => {
    setLoading(true);
    setError(null);
    try {
      const data = await plannerService.listPlans(filter);
      setPlans(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch conversations for optional plan linking
  useEffect(() => {
    async function loadConversations() {
      try {
        const list = await conversationService.listConversations();
        setConversations(list);
      } catch (err) {
        // Non-blocking for planner
      }
    }
    loadConversations();
  }, []);

  useEffect(() => {
    loadPlans(activeFilter);
  }, [activeFilter, loadPlans]);

  // Handle Create
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createData.action.trim()) {
      setCreateError('Action commitment is required.');
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const newPlan = await plannerService.createPlan({
        action: createData.action,
        conversation_id: createData.conversation_id || null,
        date: createData.date || null,
        time: createData.time || null,
        frequency: createData.frequency || null,
      });

      setPlans((prev) => [newPlan, ...prev]);
      setShowCreateModal(false);
      setCreateData({
        action: '',
        date: '',
        time: '',
        frequency: '',
        conversation_id: '',
      });
    } catch (err) {
      setCreateError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (plan) => {
    setEditingPlan(plan);
    setEditData({
      action: plan.action,
      date: plan.date || '',
      time: plan.time || '',
      frequency: plan.frequency || '',
      status: plan.status || 'pending',
    });
    setEditError(null);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingPlan) return;
    if (!editData.action.trim()) {
      setEditError('Action commitment is required.');
      return;
    }

    setSavingEdit(true);
    setEditError(null);
    try {
      const updated = await plannerService.updatePlan(editingPlan.id, {
        action: editData.action,
        date: editData.date || null,
        time: editData.time || null,
        frequency: editData.frequency || null,
        status: editData.status,
      });

      setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditingPlan(null);
    } catch (err) {
      setEditError(getErrorMessage(err));
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle Complete
  const handleCompletePlan = async (id) => {
    setCompletingId(id);
    try {
      const updated = await plannerService.completePlan(id);
      setPlans((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCompletingId(null);
    }
  };

  // Handle Delete
  const handleDeletePlan = async (id) => {
    setDeleting(true);
    try {
      await plannerService.deletePlan(id);
      setPlans((prev) => prev.filter((p) => p.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 transition-colors">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
              Action Planner
            </h1>
            <span className="text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-forest-50 dark:bg-forest-900/40 text-forest-700 dark:text-forest-300 border border-forest-200/80 dark:border-forest-800">
              Personal Commitments
            </span>
          </div>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Manage your personal reflection commitments, dates, and intentional schedules.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreateError(null);
            setShowCreateModal(true);
          }}
          className="flex items-center space-x-2 px-4 py-2.5 bg-forest-700 hover:bg-forest-800 dark:bg-forest-600 dark:hover:bg-forest-500 text-white rounded-xl text-xs font-semibold shadow-xs hover:shadow transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Action Plan</span>
        </button>
      </div>

      {/* Filter Tabs & Count */}
      <div className="flex items-center justify-between border-b border-stone-200 dark:border-night-800 pb-3 flex-wrap gap-3">
        <div className="flex items-center p-1 bg-stone-100/80 dark:bg-night-900 rounded-xl border border-stone-200/60 dark:border-night-800">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeFilter === tab.id
                  ? 'bg-white dark:bg-night-800 text-forest-700 dark:text-forest-300 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
          Showing <strong className="text-stone-800 dark:text-stone-200">{plans.length}</strong> plan{plans.length === 1 ? '' : 's'}
        </span>
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
            onClick={() => loadPlans(activeFilter)}
            className="text-xs font-semibold underline hover:text-rose-900 dark:hover:text-rose-200 ml-2 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Plan List Area */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-night-900 rounded-2xl border border-stone-200/80 dark:border-night-800 p-5 space-y-3 animate-pulse"
            >
              <div className="h-4 bg-stone-200 dark:bg-night-800 rounded w-1/3"></div>
              <div className="h-3 bg-stone-100 dark:bg-night-800/60 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white dark:bg-night-900 rounded-2xl border border-stone-200/80 dark:border-night-800 p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-forest-50 dark:bg-forest-900/40 text-forest-700 dark:text-forest-400 flex items-center justify-center mx-auto border border-forest-200/60 dark:border-forest-800">
            <CheckSquare className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
            {activeFilter === 'all'
              ? 'No Action Plans Created Yet'
              : `No ${activeFilter} Action Plans`}
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto leading-relaxed">
            Create an action plan to schedule commitments derived from your EVARA reflection sessions.
          </p>
          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-forest-700 hover:bg-forest-800 dark:bg-forest-600 dark:hover:bg-forest-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Create Your First Plan
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const isCompleted = plan.status === 'completed';
            const isCancelled = plan.status === 'cancelled';
            const isPending = plan.status === 'pending';
            const linkedConv = conversations.find((c) => c.id === plan.conversation_id);

            return (
              <div
                key={plan.id}
                className={`bg-white dark:bg-night-900 rounded-2xl border p-5 shadow-xs transition-all flex items-start justify-between gap-4 ${
                  isCompleted
                    ? 'border-forest-200/80 dark:border-forest-900/60 bg-forest-50/20 dark:bg-forest-950/20'
                    : isCancelled
                    ? 'border-stone-200 dark:border-night-800 opacity-60'
                    : 'border-stone-200/80 dark:border-night-800 hover:border-forest-300 dark:hover:border-forest-800'
                }`}
              >
                {/* Complete Toggle / Status Icon */}
                <div className="pt-0.5">
                  {isPending ? (
                    <button
                      type="button"
                      onClick={() => handleCompletePlan(plan.id)}
                      disabled={completingId === plan.id}
                      className="w-5 h-5 rounded-lg border-2 border-stone-300 dark:border-night-700 hover:border-forest-500 dark:hover:border-forest-400 hover:bg-forest-50 dark:hover:bg-forest-900/40 flex items-center justify-center transition-colors text-forest-600 cursor-pointer"
                      title="Mark commitment completed"
                    >
                      {completingId === plan.id ? (
                        <div className="w-3 h-3 border-2 border-forest-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : null}
                    </button>
                  ) : isCompleted ? (
                    <div className="w-5 h-5 rounded-lg bg-forest-700 dark:bg-forest-600 text-white flex items-center justify-center shadow-2xs">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-lg bg-stone-200 dark:bg-night-800 text-stone-500 flex items-center justify-center">
                      <Ban className="w-3 h-3" />
                    </div>
                  )}
                </div>

                {/* Plan Content */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-sm font-semibold leading-relaxed ${
                        isCompleted
                          ? 'line-through text-stone-400 dark:text-stone-500'
                          : isCancelled
                          ? 'line-through text-stone-400 dark:text-stone-600'
                          : 'text-stone-900 dark:text-stone-100'
                      }`}
                    >
                      {plan.action}
                    </p>

                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md flex-shrink-0 border ${
                        isCompleted
                          ? 'bg-forest-50 dark:bg-forest-900/40 text-forest-700 dark:text-forest-300 border-forest-200 dark:border-forest-800'
                          : isCancelled
                          ? 'bg-stone-100 dark:bg-night-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-night-700'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60'
                      }`}
                    >
                      {plan.status}
                    </span>
                  </div>

                  {/* Metadata Chips */}
                  <div className="flex items-center space-x-3 flex-wrap gap-y-1.5 text-xs text-stone-500 dark:text-stone-400">
                    {plan.date && (
                      <span className="flex items-center space-x-1 bg-stone-50 dark:bg-night-800/60 px-2 py-0.5 rounded-md border border-stone-200/60 dark:border-night-800">
                        <Calendar className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
                        <span>{plan.date}</span>
                      </span>
                    )}

                    {plan.time && (
                      <span className="flex items-center space-x-1 bg-stone-50 dark:bg-night-800/60 px-2 py-0.5 rounded-md border border-stone-200/60 dark:border-night-800">
                        <Clock className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
                        <span>{plan.time}</span>
                      </span>
                    )}

                    {plan.frequency && (
                      <span className="flex items-center space-x-1 bg-stone-50 dark:bg-night-800/60 px-2 py-0.5 rounded-md border border-stone-200/60 dark:border-night-800">
                        <Repeat className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
                        <span className="capitalize">{plan.frequency}</span>
                      </span>
                    )}

                    {linkedConv && (
                      <span className="flex items-center space-x-1 text-forest-700 dark:text-forest-300 font-medium bg-forest-50/60 dark:bg-forest-900/30 px-2 py-0.5 rounded-md border border-forest-200/50 dark:border-forest-800/50">
                        <MessageSquare className="w-3.5 h-3.5 text-forest-500" />
                        <span className="truncate max-w-[180px]">Session: {linkedConv.title}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions: Edit & Delete */}
                <div className="flex items-center space-x-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(plan)}
                    className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-night-800 rounded-lg transition-colors cursor-pointer"
                    title="Edit plan"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(plan.id)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                    title="Delete plan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Action Plan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-night-900 rounded-2xl shadow-xl border border-stone-200 dark:border-night-800 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-night-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-forest-50 dark:bg-forest-900/40 text-forest-700 dark:text-forest-400 flex items-center justify-center border border-forest-200/60 dark:border-forest-800">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">New Action Plan</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Action Commitment <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  required
                  placeholder="e.g. Set aside 20 minutes for a mindful evening walk without devices..."
                  value={createData.action}
                  onChange={(e) => setCreateData({ ...createData, action: e.target.value })}
                  className="w-full text-xs sm:text-sm border border-stone-300 dark:border-night-700 rounded-xl p-3 bg-white dark:bg-night-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-forest-500"
                />
                <span className="text-[10px] text-stone-400 dark:text-stone-500">{createData.action.length} / 500 characters</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Scheduled Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={createData.date}
                    onChange={(e) => setCreateData({ ...createData, date: e.target.value })}
                    className="w-full text-xs border border-stone-300 dark:border-night-700 rounded-xl p-2.5 bg-white dark:bg-night-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-forest-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Scheduled Time (Optional, 24-hr)
                  </label>
                  <input
                    type="time"
                    value={createData.time}
                    onChange={(e) => setCreateData({ ...createData, time: e.target.value })}
                    className="w-full text-xs border border-stone-300 dark:border-night-700 rounded-xl p-2.5 bg-white dark:bg-night-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-forest-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Frequency (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="e.g. daily, weekly, every morning"
                    value={createData.frequency}
                    onChange={(e) => setCreateData({ ...createData, frequency: e.target.value })}
                    className="w-full text-xs border border-stone-300 dark:border-night-700 rounded-xl p-2.5 bg-white dark:bg-night-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-forest-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Linked Session (Optional)
                  </label>
                  <select
                    value={createData.conversation_id}
                    onChange={(e) => setCreateData({ ...createData, conversation_id: e.target.value })}
                    className="w-full text-xs border border-stone-300 dark:border-night-700 rounded-xl p-2.5 bg-white dark:bg-night-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-forest-500"
                  >
                    <option value="">None (Standalone Plan)</option>
                    {conversations.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-stone-100 dark:border-night-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-night-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !createData.action.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-forest-700 hover:bg-forest-800 dark:bg-forest-600 dark:hover:bg-forest-500 text-white rounded-xl transition-colors flex items-center space-x-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {creating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Plan</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-night-900 rounded-2xl shadow-xl border border-stone-200 dark:border-night-800 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-night-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-forest-50 dark:bg-forest-900/40 text-forest-700 dark:text-forest-400 flex items-center justify-center border border-forest-200/60 dark:border-forest-800">
                  <Edit3 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">Edit Action Plan</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Action Commitment <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  required
                  value={editData.action}
                  onChange={(e) => setEditData({ ...editData, action: e.target.value })}
                  className="w-full text-xs sm:text-sm border border-stone-300 dark:border-night-700 rounded-xl p-3 bg-white dark:bg-night-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-forest-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Scheduled Date (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    value={editData.date}
                    onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                    className="w-full text-xs border border-stone-300 dark:border-night-700 rounded-xl p-2.5 bg-white dark:bg-night-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-forest-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Scheduled Time (24-hr HH:MM)
                  </label>
                  <input
                    type="time"
                    value={editData.time}
                    onChange={(e) => setEditData({ ...editData, time: e.target.value })}
                    className="w-full text-xs border border-stone-300 dark:border-night-700 rounded-xl p-2.5 bg-white dark:bg-night-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-forest-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Frequency
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="e.g. daily, weekly"
                    value={editData.frequency}
                    onChange={(e) => setEditData({ ...editData, frequency: e.target.value })}
                    className="w-full text-xs border border-stone-300 dark:border-night-700 rounded-xl p-2.5 bg-white dark:bg-night-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-forest-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Status
                  </label>
                  <select
                    value={editData.status}
                    onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                    className="w-full text-xs border border-stone-300 dark:border-night-700 rounded-xl p-2.5 bg-white dark:bg-night-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-forest-500 font-semibold"
                  >
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-stone-100 dark:border-night-800">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-3.5 py-2 text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-night-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || !editData.action.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-forest-700 hover:bg-forest-800 dark:bg-forest-600 dark:hover:bg-forest-500 text-white rounded-xl transition-colors flex items-center space-x-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {savingEdit ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-night-900 rounded-2xl shadow-xl border border-stone-200 dark:border-night-800 p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">Delete Action Plan?</h3>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              Are you sure you want to delete this action plan commitment? This cannot be undone.
            </p>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-2 text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-night-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeletePlan(deleteConfirmId)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer"
              >
                {deleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Plan</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
