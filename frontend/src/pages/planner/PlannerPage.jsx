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
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Action Planner</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your personal reflection commitments, dates, and schedules.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreateError(null);
            setShowCreateModal(true);
          }}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Action Plan</span>
        </button>
      </div>

      {/* Filter Tabs & Count */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-2">
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeFilter === tab.id
                  ? 'bg-white text-brand-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-500">
          Showing {plans.length} plan{plans.length === 1 ? '' : 's'}
        </span>
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
            onClick={() => loadPlans(activeFilter)}
            className="text-xs font-semibold underline hover:text-rose-900 ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Plan List Area */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/3"></div>
              <div className="h-3 bg-slate-100 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
          <CheckSquare className="w-10 h-10 text-slate-300 mx-auto" />
          <h2 className="text-sm font-bold text-slate-800">
            {activeFilter === 'all'
              ? 'No Action Plans Created Yet'
              : `No ${activeFilter} Action Plans`}
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Create an action plan to schedule commitments derived from your reflection sessions.
          </p>
          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setShowCreateModal(true);
            }}
            className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-medium transition-colors"
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
                className={`bg-white rounded-xl border p-4 sm:p-5 shadow-xs transition-colors flex items-start justify-between gap-4 ${
                  isCompleted
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : isCancelled
                    ? 'border-slate-200 opacity-60'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Complete Toggle / Status Icon */}
                <div className="pt-0.5">
                  {isPending ? (
                    <button
                      type="button"
                      onClick={() => handleCompletePlan(plan.id)}
                      disabled={completingId === plan.id}
                      className="w-5 h-5 rounded border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 flex items-center justify-center transition-colors text-emerald-600"
                      title="Mark commitment completed"
                    >
                      {completingId === plan.id ? (
                        <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : null}
                    </button>
                  ) : isCompleted ? (
                    <div className="w-5 h-5 rounded bg-emerald-600 text-white flex items-center justify-center">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded bg-slate-200 text-slate-500 flex items-center justify-center">
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
                          ? 'line-through text-slate-500'
                          : isCancelled
                          ? 'line-through text-slate-400'
                          : 'text-slate-900'
                      }`}
                    >
                      {plan.action}
                    </p>

                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded flex-shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-800'
                          : isCancelled
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {plan.status}
                    </span>
                  </div>

                  {/* Metadata Chips */}
                  <div className="flex items-center space-x-3 flex-wrap gap-y-1 text-xs text-slate-500">
                    {plan.date && (
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{plan.date}</span>
                      </span>
                    )}

                    {plan.time && (
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{plan.time}</span>
                      </span>
                    )}

                    {plan.frequency && (
                      <span className="flex items-center space-x-1">
                        <Repeat className="w-3.5 h-3.5 text-slate-400" />
                        <span className="capitalize">{plan.frequency}</span>
                      </span>
                    )}

                    {linkedConv && (
                      <span className="flex items-center space-x-1 text-brand-600 font-medium">
                        <MessageSquare className="w-3.5 h-3.5 text-brand-400" />
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
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Edit plan"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(plan.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">New Action Plan</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Action Commitment <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  required
                  placeholder="e.g. Study algorithms for 30 minutes in the library..."
                  value={createData.action}
                  onChange={(e) => setCreateData({ ...createData, action: e.target.value })}
                  className="w-full text-xs sm:text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
                <span className="text-[10px] text-slate-400">{createData.action.length} / 500 characters</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Scheduled Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={createData.date}
                    onChange={(e) => setCreateData({ ...createData, date: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Scheduled Time (Optional, 24-hr)
                  </label>
                  <input
                    type="time"
                    value={createData.time}
                    onChange={(e) => setCreateData({ ...createData, time: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Frequency (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="e.g. daily, weekly, every Monday"
                    value={createData.frequency}
                    onChange={(e) => setCreateData({ ...createData, frequency: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Linked Session (Optional)
                  </label>
                  <select
                    value={createData.conversation_id}
                    onChange={(e) => setCreateData({ ...createData, conversation_id: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
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

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !createData.action.trim()}
                  className="px-4 py-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors flex items-center space-x-1.5 shadow-xs disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Edit Action Plan</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Action Commitment <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  required
                  value={editData.action}
                  onChange={(e) => setEditData({ ...editData, action: e.target.value })}
                  className="w-full text-xs sm:text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Scheduled Date (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    value={editData.date}
                    onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Scheduled Time (24-hr HH:MM)
                  </label>
                  <input
                    type="time"
                    value={editData.time}
                    onChange={(e) => setEditData({ ...editData, time: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Frequency
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="e.g. daily, weekly"
                    value={editData.frequency}
                    onChange={(e) => setEditData({ ...editData, frequency: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={editData.status}
                    onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                  >
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || !editData.action.trim()}
                  className="px-4 py-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors flex items-center space-x-1.5 shadow-xs disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Delete Action Plan?</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete this action plan commitment? This cannot be undone.
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
                onClick={() => handleDeletePlan(deleteConfirmId)}
                disabled={deleting}
                className="px-3 py-1.5 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors flex items-center space-x-1.5 shadow-xs"
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
