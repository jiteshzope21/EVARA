import api from './api';

export const dashboardService = {
  /**
   * Fetch authenticated user's dashboard metrics and summaries.
   * Backend contract: GET /api/dashboard
   * Returns: {
   *   conversation_count: number,
   *   completed_conversation_count: number,
   *   active_conversation_count: number,
   *   recent_conversations: Array<{ id, title, stage, status, updated_at }>,
   *   pending_plan_count: number,
   *   completed_plan_count: number,
   *   cancelled_plan_count: number,
   *   active_plans: Array<{ id, action, status, date, updated_at }>,
   *   recent_reports: Array<{ id, conversation_id, dominant_sentiment, dominant_emotion, safety_level, created_at }>,
   *   sentiment_trend: { positive: number, negative: number, neutral: number },
   *   top_themes: Array<{ theme: string, count: number }>
   * }
   */
  async getDashboard() {
    const response = await api.get('/api/dashboard');
    return response.data;
  },
};

export default dashboardService;
