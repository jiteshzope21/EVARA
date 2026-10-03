import api from './api';

export const progressService = {
  /**
   * Fetch authenticated user's progress metrics.
   * Backend contract: GET /api/progress
   * Returns: {
   *   total_plans: number,
   *   pending_plans: number,
   *   completed_plans: number,
   *   cancelled_plans: number,
   *   completion_percentage: number,
   *   recent_completed_plans: Array<{ id, action, status, date, updated_at }>,
   *   plans_completed_last_7_days: number,
   *   total_conversations: number,
   *   completed_conversations: number
   * }
   */
  async getProgress() {
    const response = await api.get('/api/progress');
    return response.data;
  },
};

export default progressService;
