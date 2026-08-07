/**
 * Customer Support Chat — client store ready for WebSocket/API.
 * Local persistence for now; swap chatService adapters later without UI rewrites.
 */

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
  /** Client temp id before server ack */
  clientMessageId?: string;
};

export type ChatConversation = {
  id: string;
  userId: string;
  userName?: string | null;
  status: 'open' | 'waiting' | 'assigned' | 'closed';
  /** Reserved for Admin CS assignment */
  assignedAgentId?: string | null;
  assignedAgentName?: string | null;
  subject?: string | null;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ChatThreadSnapshot = {
  conversation: ChatConversation;
  messages: ChatMessage[];
};

const STORAGE_KEY = 'gn_cs_chat_v1';

type PersistedChat = {
  conversation: ChatConversation | null;
  messages: ChatMessage[];
};

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readPersisted(userId: string): PersistedChat {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${userId}`);
    if (!raw) return { conversation: null, messages: [] };
    const parsed = JSON.parse(raw) as PersistedChat;
    return {
      conversation: parsed.conversation || null,
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
  } catch {
    return { conversation: null, messages: [] };
  }
}

function writePersisted(userId: string, data: PersistedChat) {
  try {
    localStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(data));
  } catch {
    // ignore
  }
}

/**
 * Transport adapter — currently local-only.
 * Replace implementations with REST/WebSocket later; keep method signatures stable for Admin CS.
 */
export const chatService = {
  async ensureConversation(input: {
    userId: string;
    userName?: string | null;
  }): Promise<ChatThreadSnapshot> {
    const existing = readPersisted(input.userId);
    if (existing.conversation) {
      return { conversation: existing.conversation, messages: existing.messages };
    }

    const now = new Date().toISOString();
    const conversation: ChatConversation = {
      id: uid('conv'),
      userId: input.userId,
      userName: input.userName || null,
      status: 'open',
      assignedAgentId: null,
      assignedAgentName: null,
      subject: 'Bantuan Transaksi GurkyNet',
      lastMessageAt: now,
      lastMessagePreview: 'Percakapan dimulai',
      unreadCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const welcome: ChatMessage = {
      id: uid('msg'),
      conversationId: conversation.id,
      senderRole: 'system',
      senderName: 'GurkyNet CS',
      body: 'Halo! Tim Customer Service GurkyNet siap membantu. Tuliskan kendala transaksi Anda.',
      createdAt: now,
      status: 'delivered',
    };

    const messages = [welcome];
    writePersisted(input.userId, { conversation, messages });
    return { conversation, messages };
  },

  async sendUserMessage(input: {
    userId: string;
    conversationId: string;
    body: string;
    senderName?: string | null;
  }): Promise<ChatMessage> {
    const snap = readPersisted(input.userId);
    const now = new Date().toISOString();
    const message: ChatMessage = {
      id: uid('msg'),
      conversationId: input.conversationId,
      senderRole: 'user',
      senderId: input.userId,
      senderName: input.senderName || 'Anda',
      body: input.body.trim(),
      createdAt: now,
      status: 'sent',
      clientMessageId: uid('c'),
    };

    const messages = [...snap.messages, message];
    const conversation = snap.conversation
      ? {
          ...snap.conversation,
          status: 'waiting' as const,
          lastMessageAt: now,
          lastMessagePreview: message.body.slice(0, 80),
          updatedAt: now,
        }
      : null;

    writePersisted(input.userId, { conversation, messages });

    // Simulated agent ack — replace with WebSocket push for Admin CS inbox.
    window.setTimeout(() => {
      const latest = readPersisted(input.userId);
      if (!latest.conversation) return;
      const ack: ChatMessage = {
        id: uid('msg'),
        conversationId: latest.conversation.id,
        senderRole: 'agent',
        senderId: 'cs_bot_local',
        senderName: 'CS GurkyNet',
        body: 'Pesan Anda sudah kami terima. Tim CS akan membalas segera. (Mode lokal — siap dihubungkan ke WebSocket.)',
        createdAt: new Date().toISOString(),
        status: 'delivered',
      };
      const nextMessages = [...latest.messages, ack];
      const nextConv = {
        ...latest.conversation,
        status: 'assigned' as const,
        assignedAgentId: 'cs_bot_local',
        assignedAgentName: 'CS GurkyNet',
        lastMessageAt: ack.createdAt,
        lastMessagePreview: ack.body.slice(0, 80),
        updatedAt: ack.createdAt,
        unreadCount: (latest.conversation.unreadCount || 0) + 1,
      };
      writePersisted(input.userId, { conversation: nextConv, messages: nextMessages });
      window.dispatchEvent(
        new CustomEvent('gn-cs-chat-updated', { detail: { userId: input.userId } })
      );
    }, 900);

    return message;
  },

  async listForAdminInbox(): Promise<ChatConversation[]> {
    // Placeholder for Admin CS dashboard — scan is localStorage-only in this sprint.
    return [];
  },
};
