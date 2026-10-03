import api from './api';

export const analysisService = {
  /**
   * Fetch the latest NLP/LMTA analysis for a conversation.
   * Backend contract: GET /api/analysis/{conversation_id}
   * Returns: AnalysisOut
   */
  async getAnalysis(conversationId) {
    const response = await api.get(`/api/analysis/${conversationId}`);
    return response.data;
  },

  /**
   * Run the Phase 3 NLP/LMTA pipeline over a conversation's user messages and store analysis.
   * Backend contract: POST /api/analysis/{conversation_id}/generate
   * Returns: AnalysisOut
   */
  async generateAnalysis(conversationId) {
    const response = await api.post(`/api/analysis/${conversationId}/generate`);
    return response.data;
  },
};

export default analysisService;
