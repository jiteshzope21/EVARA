import api from './api';

export const plannerService = {
  /**
   * List plans with optional status filter ('pending', 'completed', 'cancelled').
   * Backend contract: GET /api/planner(?status={filter})
   * Returns: Array<PlanOut>
   */
  async listPlans(statusFilter = null) {
    const params = {};
    if (statusFilter && statusFilter !== 'all') {
      params.status = statusFilter;
    }
    const response = await api.get('/api/planner', { params });
    return response.data;
  },

  /**
   * Retrieve a specific plan by ID.
   * Backend contract: GET /api/planner/{plan_id}
   * Returns: PlanOut
   */
  async getPlan(id) {
    const response = await api.get(`/api/planner/${id}`);
    return response.data;
  },

  /**
   * Create a new plan.
   * Backend contract: POST /api/planner
   * Body: PlanCreate { action, conversation_id, date, time, frequency }
   * Returns: PlanOut
   */
  async createPlan(data) {
    const payload = {
      action: data.action ? data.action.trim() : '',
    };
    if (data.conversation_id) payload.conversation_id = data.conversation_id;
    if (data.date && data.date.trim()) payload.date = data.date.trim();
    if (data.time && data.time.trim()) payload.time = data.time.trim();
    if (data.frequency && data.frequency.trim()) payload.frequency = data.frequency.trim();

    const response = await api.post('/api/planner', payload);
    return response.data;
  },

  /**
   * Update an existing plan (PATCH).
   * Backend contract: PATCH /api/planner/{plan_id}
   * Body: PlanUpdate { action?, date?, time?, frequency?, status? }
   * Returns: PlanOut
   */
  async updatePlan(id, data) {
    const payload = {};
    if (data.action !== undefined) payload.action = data.action ? data.action.trim() : '';
    if (data.date !== undefined) payload.date = data.date && data.date.trim() ? data.date.trim() : null;
    if (data.time !== undefined) payload.time = data.time && data.time.trim() ? data.time.trim() : null;
    if (data.frequency !== undefined) payload.frequency = data.frequency && data.frequency.trim() ? data.frequency.trim() : null;
    if (data.status !== undefined) payload.status = data.status;

    const response = await api.patch(`/api/planner/${id}`, payload);
    return response.data;
  },

  /**
   * Mark a plan as completed.
   * Backend contract: POST /api/planner/{plan_id}/complete
   * Returns: PlanOut
   */
  async completePlan(id) {
    const response = await api.post(`/api/planner/${id}/complete`);
    return response.data;
  },

  /**
   * Delete a plan.
   * Backend contract: DELETE /api/planner/{plan_id}
   * Returns: status 204 No Content
   */
  async deletePlan(id) {
    await api.delete(`/api/planner/${id}`);
  },
};

export default plannerService;
