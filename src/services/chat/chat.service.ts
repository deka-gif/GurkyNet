/**
 * Customer Support Chat — REST + SSE (Sprint 8.0).
 * Database is Single Source of Truth. No localStorage persistence.
 */

import { apiClient } from '../api';

export type ChatSenderRole = 'user' | 'agent' | 'system';

export type ChatDeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderRole: ChatSenderRole;
  senderId?: string | null;
  senderName?: string | null;
  body: string;
  createdAt: string;
  status: ChatDeliveryStatus;
  clientMessageId?: string;
};

export type ChatConversation = {
  id: string;
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  userPhone?: string | null;
  status: 'open' | 'waiting' | 'assigned' | 'closed' | string;
  assignedAgentId?: string | null;
  assignedAgentName?: string | null;
  subject?: string | null;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  unreadCount: number;
  unreadUser?: number;
  unreadAgent?: number;
  supportTicketId?: number | null;
  transactionId?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatThreadSnapshot = {
  conversation: ChatConversation;
  messages: ChatMessage[];
  customer?: Record<string, unknown> | null;
};

function mapConversation(raw: any): ChatConversation {
  return {
    id: String(raw.id),
    userId: String(raw.userId ?? raw.user_id ?? ''),
    userName: raw.userName ?? raw.user_name ?? null,
    userEmail: raw.userEmail ?? null,
    userPhone: raw.userPhone ?? null,
    status: raw.status || 'open',
    assignedAgentId: raw.assignedAgentId != null ? String(raw.assignedAgentId) : null,
    assignedAgentName: raw.assignedAgentName ?? null,
    subject: raw.subject ?? null,
    lastMessageAt: raw.lastMessageAt ?? raw.last_message_at ?? null,
    lastMessagePreview: raw.lastMessagePreview ?? raw.last_message_preview ?? null,
    unreadCount: Number(raw.unreadAgent ?? raw.unread_agent ?? raw.unreadCount ?? 0),
    unreadUser: Number(raw.unreadUser ?? raw.unread_user ?? 0),
    unreadAgent: Number(raw.unreadAgent ?? raw.unread_agent ?? 0),
    supportTicketId: raw.supportTicketId ?? raw.support_ticket_id ?? null,
    transactionId: raw.transactionId ?? raw.transaction_id ?? null,
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? raw.updated_at ?? new Date().toISOString(),
  };
}

function mapMessage(raw: any): ChatMessage {
  return {
    id: String(raw.id),
    conversationId: String(raw.conversationId ?? raw.conversation_id),
    senderRole: raw.senderRole ?? raw.sender_role,
    senderId: raw.senderId != null ? String(raw.senderId) : null,
    senderName: raw.senderName ?? raw.sender_name ?? null,
    body: raw.body,
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    status: (raw.status as ChatDeliveryStatus) || 'delivered',
    clientMessageId: raw.clientMessageId ?? raw.client_message_id,
  };
}

function clientId() {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const chatService = {
  async ensureConversation(input: {
    userId?: string;
    userName?: string | null;
    transactionId?: number | null;
    subject?: string | null;
  }): Promise<ChatThreadSnapshot> {
    const res = await apiClient.post('/chat/conversation', {
      transactionId: input.transactionId || undefined,
      subject: input.subject || undefined,
    });
    const conversation = mapConversation(res.data.data.conversation);
    const thread = await this.getThread(conversation.id);
    return thread;
  },

  async getThread(conversationId: string): Promise<ChatThreadSnapshot> {
    const res = await apiClient.get(`/chat/conversations/${conversationId}/messages`);
    const data = res.data.data;
    return {
      conversation: mapConversation(data.conversation),
      messages: (data.messages || []).map(mapMessage),
    };
  },

  async sendUserMessage(input: {
    userId?: string;
    conversationId: string;
    body: string;
    senderName?: string | null;
  }): Promise<ChatMessage> {
    const res = await apiClient.post(`/chat/conversations/${input.conversationId}/messages`, {
      body: input.body.trim(),
      clientMessageId: clientId(),
    });
    return mapMessage(res.data.data);
  },

  async markRead(conversationId: string): Promise<void> {
    await apiClient.post(`/chat/conversations/${conversationId}/read`);
  },

  async refundStatuses() {
    const res = await apiClient.get('/chat/refund-statuses');
    return res.data.data;
  },

  // —— CS Admin ——
  async adminInbox(params?: { status?: string; keyword?: string; page?: number }) {
    const res = await apiClient.get('/admin/customer-support/inbox', { params });
    const payload = res.data.data;
    return {
      data: (payload.data || []).map(mapConversation),
      meta: payload.meta,
    };
  },

  async adminThread(id: string | number): Promise<ChatThreadSnapshot> {
    const res = await apiClient.get(`/admin/customer-support/inbox/${id}`);
    const data = res.data.data;
    return {
      conversation: mapConversation(data.conversation),
      messages: (data.messages || []).map(mapMessage),
      customer: data.customer || null,
    };
  },

  async adminSend(conversationId: string | number, body: string): Promise<ChatMessage> {
    const res = await apiClient.post(`/admin/customer-support/inbox/${conversationId}/messages`, {
      body,
      clientMessageId: clientId(),
    });
    return mapMessage(res.data.data);
  },

  async adminAssign(conversationId: string | number) {
    const res = await apiClient.post(`/admin/customer-support/inbox/${conversationId}/assign`);
    return mapConversation(res.data.data.conversation);
  },

  async adminClose(conversationId: string | number) {
    const res = await apiClient.post(`/admin/customer-support/inbox/${conversationId}/close`);
    return mapConversation(res.data.data.conversation);
  },

  async adminRead(conversationId: string | number) {
    await apiClient.post(`/admin/customer-support/inbox/${conversationId}/read`);
  },

  async adminConvertTicket(conversationId: string | number, payload?: { category?: string; priority?: string }) {
    const res = await apiClient.post(
      `/admin/customer-support/inbox/${conversationId}/convert-ticket`,
      payload || {}
    );
    return res.data.data;
  },

  async adminEscalate(
    conversationId: string | number,
    payload: {
      targetDivision: 'operations' | 'finance' | 'marketing';
      type?: string;
      title: string;
      description?: string;
      priority?: string;
      transactionId?: number;
    }
  ) {
    const res = await apiClient.post(`/admin/customer-support/inbox/${conversationId}/escalate`, payload);
    return res.data.data;
  },

  async hubStats() {
    const res = await apiClient.get('/admin/customer-support/hub-stats');
    return res.data.data;
  },

  /** @deprecated Admin list stub — use adminInbox */
  async listForAdminInbox(): Promise<ChatConversation[]> {
    const res = await this.adminInbox({ status: 'all' });
    return res.data;
  },
};

export const supportHubService = {
  async listEscalations(division: string, params?: { status?: string; page?: number }) {
    const res = await apiClient.get(`/admin/escalations/${division}`, { params });
    return res.data.data;
  },

  async updateEscalation(id: number, payload: { status: string; resolutionNote?: string }) {
    const res = await apiClient.patch(`/admin/escalations/items/${id}`, payload);
    return res.data.data;
  },

  async divisionNotifications(page = 1) {
    const res = await apiClient.get('/admin/escalations/notifications', { params: { page } });
    return res.data.data;
  },

  async markNotificationRead(id: number) {
    await apiClient.put(`/admin/escalations/notifications/${id}/read`);
  },

  async markAllNotificationsRead() {
    await apiClient.put('/admin/escalations/notifications/read-all');
  },
};
