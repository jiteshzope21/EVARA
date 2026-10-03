import api from './api';

export const conversationService = {
  /**
   * List all conversations for the authenticated user.
   * Backend contract: GET /api/conversations
   * Returns: Array<ConversationSummaryOut>
   * [{ id, title, stage, status, message_count, created_at, updated_at }]
   */
  async listConversations() {
    const response = await api.get('/api/conversations');
    return response.data;
  },

  /**
   * Retrieve a specific conversation by ID (ownership checked).
   * Backend contract: GET /api/conversations/{conversation_id}
   * Returns: ConversationOut
   * { id, user_id, title, stage, status, messages: [{ role, content, timestamp }], created_at, updated_at }
   */
  async getConversation(id) {
    const response = await api.get(`/api/conversations/${id}`);
    return response.data;
  },

  /**
   * Create a new conversation session.
   * Backend contract: POST /api/conversations
   * Body: { title?: string }
   * Returns: ConversationOut with initial stage 1 assistant greeting
   */
  async createConversation(title) {
    const payload = {};
    if (title && title.trim()) {
      payload.title = title.trim();
    }
    const response = await api.post('/api/conversations', payload);
    return response.data;
  },

  /**
   * Send a user message to advance the conversation stage.
   * Backend contract: POST /api/conversations/{conversation_id}/messages
   * Body: { content: string }
   * Returns: Full updated ConversationOut containing both the user message and the generated assistant response
   */
  async sendMessage(id, content) {
    const response = await api.post(`/api/conversations/${id}/messages`, {
      content: content.trim(),
    });
    return response.data;
  },

  /**
   * Delete a conversation by ID.
   * Backend contract: DELETE /api/conversations/{conversation_id}
   * Returns: status 204 No Content
   */
  async deleteConversation(id) {
    await api.delete(`/api/conversations/${id}`);
  },
};

export default conversationService;
