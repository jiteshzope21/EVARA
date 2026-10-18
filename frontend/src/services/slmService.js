import api from './api';

export const slmService = {
  /**
   * Guided mode: Generate an SLM-assisted reflection response for the given conversation.
   * Backend contract: POST /api/slm/{conversation_id}/generate?persist={persist}
   */
  async generate(conversationId, persist = false) {
    const response = await api.post(`/api/slm/${conversationId}/generate`, null, {
      params: { persist },
    });
    return response.data;
  },

  /**
   * Standalone SLM Chat: List all chat sessions for the authenticated user.
   * Backend contract: GET /api/slm/chat/conversations
   */
  async listChats() {
    const response = await api.get('/api/slm/chat/conversations');
    return response.data;
  },

  /**
   * Standalone SLM Chat: Create a new chat session.
   * Backend contract: POST /api/slm/chat/conversations
   */
  async createChat(title = null) {
    const response = await api.post('/api/slm/chat/conversations', { title });
    return response.data;
  },

  /**
   * Standalone SLM Chat: Retrieve a single chat with its full message history.
   * Backend contract: GET /api/slm/chat/conversations/{id}
   */
  async getChat(chatId) {
    const response = await api.get(`/api/slm/chat/conversations/${chatId}`);
    return response.data;
  },

  /**
   * Standalone SLM Chat: Append user message and generate real SLM response.
   * Backend contract: POST /api/slm/chat/conversations/{id}/messages
   */
  async sendMessage(chatId, content) {
    const response = await api.post(`/api/slm/chat/conversations/${chatId}/messages`, {
      content,
    });
    return response.data;
  },

  /**
   * Standalone SLM Chat: Delete an owned chat session.
   * Backend contract: DELETE /api/slm/chat/conversations/{id}
   */
  async deleteChat(chatId) {
    await api.delete(`/api/slm/chat/conversations/${chatId}`);
  },
};

export default slmService;
