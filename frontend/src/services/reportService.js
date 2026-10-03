import api from './api';

export const reportService = {
  /**
   * Fetch the latest generated report for a conversation.
   * Backend contract: GET /api/reports/{conversation_id}
   * Returns: ReportOut
   */
  async getReport(conversationId) {
    const response = await api.get(`/api/reports/${conversationId}`);
    return response.data;
  },

  /**
   * Generate and persist a new report for a conversation based on its existing analysis.
   * Backend contract: POST /api/reports/{conversation_id}/generate
   * Returns: ReportOut
   */
  async generateReport(conversationId) {
    const response = await api.post(`/api/reports/${conversationId}/generate`);
    return response.data;
  },
};

export default reportService;
