import { apiClient } from '../api/client';
import type { ApiResponse } from '../api/types';

export type ChatSenderRole = 'user' | 'agent' | 'system';
export type ChatDeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderRole: ChatSenderRole;
  senderId: string | null;
  senderName: string | null;
  body: string;
  createdAt: string;
  status: ChatDeliveryStatus;
  clientMessageId?: string;
};

export type ChatConversation = {
  id: string;
  userId: string;
  userName: string | null;
  status: 'open' | 'waiting' | 'assigned' | 'closed' | string;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  subject: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadUser: number;
  unreadAgent: number;
  supportTicketId: number | null;
  transactionId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatThreadSnapshot = {
  conversation: ChatConversation;
  messages: ChatMessage[];
};

function mapConversation(raw: Record<string, unknown>): ChatConversation {
  return {
    id: String(raw.id ?? ''),
    userId: String(raw.userId ?? raw.user_id ?? ''),
    userName: (raw.userName as string | null) ?? (raw.user_name as string | null) ?? null,
    status: String(raw.status || 'open'),
    assignedAgentId:
      raw.assignedAgentId != null
        ? String(raw.assignedAgentId)
        : raw.assigned_agent_id != null
          ? String(raw.assigned_agent_id)
          : null,
    assignedAgentName:
      (raw.assignedAgentName as string | null) ??
      (raw.assigned_agent_name as string | null) ??
      null,
    subject: (raw.subject as string | null) ?? null,
    lastMessageAt:
      (raw.lastMessageAt as string | null) ??
      (raw.last_message_at as string | null) ??
      null,
    lastMessagePreview:
      (raw.lastMessagePreview as string | null) ??
      (raw.last_message_preview as string | null) ??
      null,
    unreadUser: Number(raw.unreadUser ?? raw.unread_user ?? 0),
    unreadAgent: Number(raw.unreadAgent ?? raw.unread_agent ?? 0),
    supportTicketId:
      (raw.supportTicketId as number | null) ??
      (raw.support_ticket_id as number | null) ??
      null,
    transactionId:
      (raw.transactionId as number | null) ??
      (raw.transaction_id as number | null) ??
      null,
    createdAt: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? new Date().toISOString()),
  };
}

function mapMessage(raw: Record<string, unknown>): ChatMessage {
  const role = String(raw.senderRole ?? raw.sender_role ?? 'user') as ChatSenderRole;
  return {
    id: String(raw.id ?? ''),
    conversationId: String(raw.conversationId ?? raw.conversation_id ?? ''),
    senderRole: role,
    senderId:
      raw.senderId != null
        ? String(raw.senderId)
        : raw.sender_id != null
          ? String(raw.sender_id)
          : null,
    senderName:
      (raw.senderName as string | null) ?? (raw.sender_name as string | null) ?? null,
    body: String(raw.body ?? ''),
    createdAt: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
    status: (raw.status as ChatDeliveryStatus) || 'delivered',
    clientMessageId:
      (raw.clientMessageId as string | undefined) ??
      (raw.client_message_id as string | undefined),
  };
}

function clientMessageId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Customer Live Chat — same endpoints as Web (`/chat/*`).
 * Division routing is CS/backend-side; customer never picks a division.
 */
export const chatService = {
  ensureConversation: async (input?: {
    transactionId?: number | null;
    subject?: string | null;
  }): Promise<ChatConversation> => {
    const response = await apiClient.post<
      ApiResponse<{ conversation: Record<string, unknown> }>
    >('/chat/conversation', {
      transactionId: input?.transactionId || undefined,
      subject: input?.subject || undefined,
    });
    return mapConversation(response.data.data.conversation);
  },

  getThread: async (conversationId: string): Promise<ChatThreadSnapshot> => {
    const response = await apiClient.get<
      ApiResponse<{
        conversation: Record<string, unknown>;
        messages: Record<string, unknown>[];
      }>
    >(`/chat/conversations/${encodeURIComponent(conversationId)}/messages`);
    const data = response.data.data;
    return {
      conversation: mapConversation(data.conversation),
      messages: (data.messages || []).map(mapMessage),
    };
  },

  sendMessage: async (conversationId: string, body: string): Promise<ChatMessage> => {
    const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        body: body.trim(),
        clientMessageId: clientMessageId(),
      }
    );
    return mapMessage(response.data.data);
  },

  markRead: async (conversationId: string): Promise<ChatConversation> => {
    const response = await apiClient.post<
      ApiResponse<{ conversation: Record<string, unknown> }>
    >(`/chat/conversations/${encodeURIComponent(conversationId)}/read`);
    return mapConversation(response.data.data.conversation);
  },
};

/**
 * Customer-facing status from conversation fields returned by backend.
 * Does not invent presence — uses status + assignedAgentId only.
 */
export function chatStatusLabel(
  conversation: Pick<ChatConversation, 'status' | 'assignedAgentId'>
): string {
  const status = String(conversation.status || '').toLowerCase();

  if (status === 'closed') {
    return 'Percakapan ditutup';
  }

  // Agent joined — backend status or assigned agent id from API payload.
  if (status === 'assigned' || conversation.assignedAgentId) {
    return 'Terhubung dengan CS';
  }

  // open / waiting / no agent yet
  if (status === 'waiting' || status === 'open' || !status) {
    return 'Menunggu CS';
  }

  // Unknown backend status: show raw value rather than a misleading "connected" label.
  return conversation.status;
}
