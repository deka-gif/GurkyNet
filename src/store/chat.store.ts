import { create } from 'zustand';
import {
  chatService,
  type ChatConversation,
  type ChatMessage,
} from '../services/chat/chat.service';

type ChatState = {
  conversation: ChatConversation | null;
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  hydratedUserId: string | null;
  hydrate: (userId: string, userName?: string | null, opts?: { transactionId?: number; force?: boolean }) => Promise<void>;
  sendMessage: (body: string, senderName?: string | null) => Promise<void>;
  appendMessage: (msg: ChatMessage) => void;
  reloadThread: () => Promise<void>;
  clearError: () => void;
};

export const useChatStore = create<ChatState>((set, get) => ({
  conversation: null,
  messages: [],
  loading: false,
  sending: false,
  error: null,
  hydratedUserId: null,

  hydrate: async (userId, userName, opts) => {
    if (!userId) return;
    if (!opts?.force && get().hydratedUserId === userId && get().conversation) {
      return;
    }
    set({ loading: true, error: null });
    try {
      const snap = await chatService.ensureConversation({
        userId,
        userName,
        transactionId: opts?.transactionId,
      });
      set({
        conversation: snap.conversation,
        messages: snap.messages,
        loading: false,
        hydratedUserId: userId,
      });
      void chatService.markRead(snap.conversation.id);
    } catch (err: any) {
      set({
        error: err?.response?.data?.message || err?.message || 'Gagal membuka chat.',
        loading: false,
      });
    }
  },

  reloadThread: async () => {
    const conv = get().conversation;
    if (!conv) return;
    try {
      const snap = await chatService.getThread(conv.id);
      set({ conversation: snap.conversation, messages: snap.messages });
    } catch {
      // keep
    }
  },

  appendMessage: (msg) => {
    const exists = get().messages.some(
      (m) => m.id === msg.id || (msg.clientMessageId && m.clientMessageId === msg.clientMessageId)
    );
    if (exists) return;
    set({ messages: [...get().messages, msg] });
  },

  sendMessage: async (body, senderName) => {
    const trimmed = body.trim();
    const { conversation, hydratedUserId } = get();
    if (!trimmed || !conversation || !hydratedUserId) return;

    set({ sending: true, error: null });
    try {
      const optimistic: ChatMessage = {
        id: `tmp_${Date.now()}`,
        conversationId: conversation.id,
        senderRole: 'user',
        senderId: hydratedUserId,
        senderName: senderName || 'Anda',
        body: trimmed,
        createdAt: new Date().toISOString(),
        status: 'sending',
      };
      set({ messages: [...get().messages, optimistic] });

      const saved = await chatService.sendUserMessage({
        userId: hydratedUserId,
        conversationId: conversation.id,
        body: trimmed,
        senderName,
      });

      set({
        messages: get().messages.map((m) => (m.id === optimistic.id ? saved : m)),
        sending: false,
        conversation: {
          ...conversation,
          status: 'waiting',
          lastMessageAt: saved.createdAt,
          lastMessagePreview: saved.body.slice(0, 80),
          updatedAt: saved.createdAt,
        },
      });
    } catch (err: any) {
      set({
        sending: false,
        error: err?.response?.data?.message || err?.message || 'Gagal mengirim pesan.',
        messages: get().messages.map((m) =>
          m.status === 'sending' ? { ...m, status: 'failed' as const } : m
        ),
      });
    }
  },

  clearError: () => set({ error: null }),
}));
