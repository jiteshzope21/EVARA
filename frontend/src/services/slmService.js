import api from './api';

export const slmService = {
  /**
   * Generate an SLM-assisted reflection response for the given conversation.
   * Backend contract: POST /api/slm/{conversation_id}/generate?persist={persist}
   * Returns: SLMGenerateResponse
   * {
   *   text: string,
   *   model: string,
   *   generation_config: object,
   *   validated: boolean,
   *   warnings: string[],
   *   policy_used: string,
   *   safety_bypass: boolean,
   *   safety_level: string,
   *   conversation_stage: string,
   *   mock: boolean,
   *   duration_ms?: number | null,
   *   generation_id?: string | null
   * }
   */
  async generate(conversationId, persist = false) {
    const response = await api.post(`/api/slm/${conversationId}/generate`, null, {
      params: { persist },
    });
    return response.data;
  },
};

export default slmService;
