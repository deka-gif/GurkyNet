import { useEffect, useRef, useState, memo, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';
import { storageService } from '../../services/storage.service';

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function DeliveryIcon({ status }: { status: ChatMessage['status'] }) {
  if (status === 'sending') return <span className="text-[10px] text-white/70">…</span>;
  if (status === 'failed') return <span className="text-[10px] text-rose-200">Gagal</span>;
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
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm md:max-w-[70%] ${
          isUser
            ? 'rounded-br-md bg-primary-600 text-white'
            : 'rounded-bl-md border border-slate-100 bg-white text-slate-800'
        }`}
      >
        {!isUser ? (
          <div className="mb-1 text-[10px] font-bold text-primary-600">{msg.senderName || 'CS'}</div>
        ) : null}
        <div className="whitespace-pre-wrap break-words">{msg.body}</div>
        <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${isUser ? 'text-white/70' : 'text-slate-400'}`}>
          <span>{formatTime(msg.createdAt)}</span>
          {isUser ? <DeliveryIcon status={msg.status} /> : null}
        </div>
      </div>
    </div>
  );
});

/** Live Chat — DB + realtime. No localStorage SSOT. */
export function CustomerChatPage() {
  const user = useAuthStore((s) => s.user);
  const conversation = useChatStore((s) => s.conversation);
  const messages = useChatStore((s) => s.messages);
  const loading = useChatStore((s) => s.loading);
  const sending = useChatStore((s) => s.sending);
  const error = useChatStore((s) => s.error);
  const hydrate = useChatStore((s) => s.hydrate);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const appendMessage = useChatStore((s) => s.appendMessage);
  const [params] = useSearchParams();

  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const userId = String(user?.id || '');
  const txId = params.get('transactionId') ? Number(params.get('transactionId')) : undefined;

  useEffect(() => {
    if (!userId) return;
    void hydrate(userId, user?.name, { transactionId: txId, force: true });
  }, [userId, user?.name, hydrate, txId]);

  const channels =
    userId && conversation?.id
      ? [`chat.user.${userId}`, `chat.conversation.${conversation.id}`]
      : userId
        ? [`chat.user.${userId}`]
        : [];

  useRealtimeChannel(
    !!userId,
    channels,
    (evt) => {
      if (evt.event === 'ChatMessageSent' && evt.payload) {
        const msg = evt.payload as any;
        appendMessage({
          id: String(msg.id),
          conversationId: String(msg.conversationId),
          senderRole: msg.senderRole,
          senderId: msg.senderId,
          senderName: msg.senderName,
          body: msg.body,
          createdAt: msg.createdAt,
          status: msg.status || 'delivered',
          clientMessageId: msg.clientMessageId,
        });
      }
    },
    () => storageService.getToken(),
    2000
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  }, [messages.length]);

  const submit = () => {
    if (!draft.trim() || sending) return;
    const body = draft;
    setDraft('');
    void sendMessage(body, user?.name);
  };

  return (
    <div className="flex h-full min-h-[520px] flex-col bg-slate-50">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3">
        <Link to="/dashboard/help" className="rounded-xl p-2 text-slate-500 hover:bg-slate-50 lg:hidden">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <Headphones className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-extrabold text-slate-900">Customer Support</p>
          <p className="truncate text-xs text-slate-500">
            {conversation?.status === 'waiting' ? 'Menunggu agen…' : 'Live Chat realtime'}
          </p>
        </div>
        <MessageCircle className="h-5 w-5 text-primary-500" />
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4 md:px-5">
        {loading && <p className="text-center text-sm text-slate-400">Menyiapkan chat…</p>}
        {error && <p className="text-center text-sm text-rose-600">{error}</p>}
        {!loading && messages.map((msg) => <ChatBubble key={msg.id} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          submit();
        }}
        className="border-t border-slate-100 bg-white p-3 md:p-4"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Tulis pesan ke CS…"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-600 text-white disabled:opacity-40"
          >
            <SendHorizontal className="h-5 w-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
