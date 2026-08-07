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
  hydrate: (userId: string, userName?: string | null) => Promise<void>;
  sendMessage: (body: string, senderName?: string | null) => Promise<void>;
  reloadFromStorage: (userId: string) => Promise<void>;
  clearError: () => void;
};

export const useChatStore = create<ChatState>((set, get) => ({
  conversation: null,
  messages: [],
  loading: false,
  sending: false,
  error: null,
  hydratedUserId: null,

  hydrate: async (userId, userName) => {
    if (!userId) return;
    // Lazy hydration — skip re-read when same user already loaded
    if (get().hydratedUserId === userId && get().conversation) {
      return;
    }
    set({ loading: true, error: null });
    try {
      const snap = await chatService.ensureConversation({ userId, userName });
      set({
        conversation: snap.conversation,
        messages: snap.messages,
        loading: false,
        hydratedUserId: userId,
      });
    } catch (err: any) {
      set({
        error: err?.message || 'Gagal membuka chat.',
        loading: false,
      });
    }
  },

  reloadFromStorage: async (userId) => {
    if (!userId) return;
    const snap = await chatService.ensureConversation({ userId });
    set({
      conversation: snap.conversation,
      messages: snap.messages,
      hydratedUserId: userId,
    });
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
        error: err?.message || 'Gagal mengirim pesan.',
        messages: get().messages.map((m) =>
          m.status === 'sending' ? { ...m, status: 'failed' as const } : m
        ),
      });
    }
  },

  clearError: () => set({ error: null }),
}));
