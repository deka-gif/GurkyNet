import { useEffect, useRef, useState, memo, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Headphones,
  MessageCircle,
  SendHorizontal,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { useChatStore } from '../../store/chat.store';
import type { ChatMessage } from '../../services/chat/chat.service';

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function DeliveryIcon({ status }: { status: ChatMessage['status'] }) {
  if (status === 'sending') {
    return <span className="text-[10px] text-white/70">…</span>;
  }
  if (status === 'failed') {
    return <span className="text-[10px] text-rose-200">Gagal</span>;
  }
  if (status === 'read' || status === 'delivered') {
    return <CheckCheck className="h-3.5 w-3.5 text-sky-200" />;
  }
  return <Check className="h-3.5 w-3.5 text-white/70" />;
}

const ChatBubble = memo(function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.senderRole === 'user';
  const isSystem = msg.senderRole === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[90%] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-center text-[11px] text-slate-500 shadow-sm">
          {msg.body}
          <div className="mt-1 text-[10px] text-slate-300">{formatTime(msg.createdAt)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm will-change-transform md:max-w-[70%] ${
          isUser
            ? 'rounded-br-md bg-primary-600 text-white'
            : 'rounded-bl-md border border-slate-100 bg-white text-slate-800'
        }`}
      >
        {!isUser ? (
          <div className="mb-1 text-[10px] font-bold text-primary-600">
            {msg.senderName || 'CS'}
          </div>
        ) : null}
        <div className="whitespace-pre-wrap break-words">{msg.body}</div>
        <div
          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
            isUser ? 'text-white/70' : 'text-slate-400'
          }`}
        >
          <span>{formatTime(msg.createdAt)}</span>
          {isUser ? <DeliveryIcon status={msg.status} /> : null}
        </div>
      </div>
    </div>
  );
});

/**
 * In-app Customer Service chat (not WhatsApp).
 * Desktop: 2-panel layout. Mobile: full-screen thread.
 */
export function CustomerChatPage() {
  const user = useAuthStore((s) => s.user);
  const conversation = useChatStore((s) => s.conversation);
  const messages = useChatStore((s) => s.messages);
  const loading = useChatStore((s) => s.loading);
  const sending = useChatStore((s) => s.sending);
  const error = useChatStore((s) => s.error);
  const hydrate = useChatStore((s) => s.hydrate);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const reloadFromStorage = useChatStore((s) => s.reloadFromStorage);

  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const userId = String(user?.id || 'guest');
  const rafScrollRef = useRef<number | null>(null);

  useEffect(() => {
    void hydrate(userId, user?.name);
  }, [userId, user?.name, hydrate]);

  useEffect(() => {
    const onUpdate = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { userId?: string } | undefined;
      if (detail?.userId && detail.userId === userId) {
        void reloadFromStorage(userId);
      }
    };
    window.addEventListener('gn-cs-chat-updated', onUpdate);
    return () => window.removeEventListener('gn-cs-chat-updated', onUpdate);
  }, [userId, reloadFromStorage]);

  useEffect(() => {
    if (rafScrollRef.current != null) cancelAnimationFrame(rafScrollRef.current);
    rafScrollRef.current = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      rafScrollRef.current = null;
    });
    return () => {
      if (rafScrollRef.current != null) cancelAnimationFrame(rafScrollRef.current);
    };
  }, [messages.length, loading]);

  const onSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!draft.trim() || sending) return;
    const body = draft;
    setDraft('');
    await sendMessage(body, user?.name);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void onSubmit();
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-7.5rem)] max-w-6xl flex-col gap-4 pb-4 md:h-[calc(100vh-6rem)] md:flex-row">
      {/* Left panel — conversation meta (desktop) */}
      <aside className="hidden w-72 shrink-0 flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-lg shadow-slate-200/40 md:flex">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 text-primary-700">
            <Headphones className="h-5 w-5" />
            <h1 className="text-sm font-bold">Customer Service</h1>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Live chat in-app GurkyNet</p>
        </div>
        <div className="flex-1 space-y-3 p-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Status
            </div>
            <div className="mt-1 text-sm font-bold capitalize text-slate-800">
              {conversation?.status || '—'}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Agen
            </div>
            <div className="mt-1 text-sm font-bold text-slate-800">
              {conversation?.assignedAgentName || 'Menunggu CS'}
            </div>
          </div>
          <div className="rounded-2xl border border-dashed border-primary-200 bg-primary-50/40 p-3 text-[11px] leading-relaxed text-primary-800">
            Arsitektur siap untuk inbox Admin CS & WebSocket. Percakapan saat ini tersimpan lokal di perangkat.
          </div>
        </div>
        <div className="border-t border-slate-100 p-4">
          <Link
            to="/dashboard/account/help"
            className="text-xs font-bold text-primary-600 hover:underline"
          >
            Buka Pusat Bantuan →
          </Link>
        </div>
      </aside>

      {/* Chat thread */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-lg shadow-slate-200/40">
        <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 md:px-5">
          <Link
            to="/dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 md:hidden"
            aria-label="Kembali"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-md shadow-primary-600/20">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-slate-900">CS GurkyNet</div>
            <div className="truncate text-[11px] text-slate-400">
              {conversation?.assignedAgentName
                ? `Dilayani oleh ${conversation.assignedAgentName}`
                : 'Biasanya membalas dalam beberapa menit'}
            </div>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-slate-50/80 to-white px-4 py-4 md:px-5">
          {loading && messages.length === 0 ? (
            <div className="space-y-3 py-8">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-14 max-w-[70%] animate-pulse rounded-2xl bg-slate-100 ${
                    i % 2 === 0 ? 'ml-auto' : ''
                  }`}
                />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-slate-300">
                <MessageCircle className="h-7 w-7" />
              </div>
              <p className="text-sm font-bold text-slate-700">Belum ada percakapan</p>
              <p className="mt-1 max-w-xs text-xs text-slate-400">
                Kirim pesan pertama untuk memulai chat dengan Customer Service.
              </p>
            </div>
          ) : (
            messages.map((msg) => <ChatBubble key={msg.id} msg={msg} />)
          )}
          <div ref={bottomRef} />
        </div>

        {error ? (
          <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700">
            {error}
          </div>
        ) : null}

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="border-t border-slate-100 bg-white px-3 py-3 md:px-4"
        >
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Tulis pesan… (Enter kirim, Shift+Enter baris baru)"
              className="max-h-32 min-h-[44px] flex-1 resize-y rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-500/15"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-primary-600 text-white shadow-md shadow-primary-600/20 transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              aria-label="Kirim pesan"
            >
              <SendHorizontal className="h-5 w-5" />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default CustomerChatPage;
