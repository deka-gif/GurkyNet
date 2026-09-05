import { create } from 'zustand';
import {
  chatService,
  type ChatConversation,
  type ChatMessage,
} from '../services/chat.service';
import { parseApiError } from '../api/client';
import { useHelpStore } from './help.store';

type ChatState = {
  loading: boolean;
  sending: boolean;
  error: string | null;
  sendError: string | null;
  conversation: ChatConversation | null;
  messages: ChatMessage[];
  openChat: (opts?: { transactionId?: number | null; subject?: string | null }) => Promise<void>;
  refreshThread: () => Promise<void>;
  send: (body: string) => Promise<boolean>;
  markRead: () => Promise<void>;
  reset: () => void;
};

export const useChatStore = create<ChatState>((set, get) => ({
  loading: false,
  sending: false,
  error: null,
  sendError: null,
  conversation: null,
  messages: [],

  openChat: async (opts) => {
    set({ loading: true, error: null, sendError: null });
    try {
      const conversation = await chatService.ensureConversation({
        transactionId: opts?.transactionId,
        subject: opts?.subject,
      });
      const thread = await chatService.getThread(conversation.id);
      set({
        conversation: thread.conversation,
        messages: thread.messages,
        loading: false,
        error: null,
      });
      useHelpStore.setState({ unreadUser: Number(thread.conversation.unreadUser) || 0 });
      await get().markRead();
    } catch (err) {
      const parsed = parseApiError(err);
      set({
        loading: false,
        error: parsed.message || 'Gagal membuka chat CS.',
        conversation: null,
        messages: [],
      });
    }
  },

  refreshThread: async () => {
    const conv = get().conversation;
    if (!conv) return;
    try {
      const thread = await chatService.getThread(conv.id);
      set({
        conversation: thread.conversation,
        messages: thread.messages,
      });
      useHelpStore.setState({ unreadUser: Number(thread.conversation.unreadUser) || 0 });
    } catch {
      /* silent poll failure */
    }
  },

  send: async (body) => {
    const conv = get().conversation;
    const trimmed = body.trim();
    if (!conv || !trimmed || get().sending) return false;
    if (conv.status === 'closed') {
      set({ sendError: 'Percakapan sudah ditutup. Buka chat lagi untuk memulai percakapan baru.' });
      return false;
    }

    set({ sending: true, sendError: null });
    try {
      const msg = await chatService.sendMessage(conv.id, trimmed);
      const existing = get().messages;
      const withoutDup = existing.filter(
        (m) => m.id !== msg.id && m.clientMessageId !== msg.clientMessageId
      );
      set({
        messages: [...withoutDup, msg],
        sending: false,
        sendError: null,
      });
      await get().refreshThread();
      return true;
    } catch (err) {
      const parsed = parseApiError(err);
      set({
        sending: false,
        sendError: parsed.message || 'Pesan gagal dikirim.',
      });
      return false;
    }
  },

  markRead: async () => {
    const conv = get().conversation;
    if (!conv) return;
    try {
      const updated = await chatService.markRead(conv.id);
      set({ conversation: { ...get().conversation!, ...updated, unreadUser: 0 } });
      useHelpStore.setState({ unreadUser: 0 });
    } catch {
      /* ignore */
    }
  },

  reset: () =>
    set({
      loading: false,
      sending: false,
      error: null,
      sendError: null,
      conversation: null,
      messages: [],
    }),
}));
