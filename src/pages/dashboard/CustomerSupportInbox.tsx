import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageSquare,
  Search,
  Send,
  Ticket,
  Share2,
  XCircle,
  UserRound,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { chatService, type ChatConversation, type ChatMessage } from '../../services/chat/chat.service';
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';
import { storageService } from '../../services/storage.service';
import { CmsPageHeader } from '../../components/common/CmsCommon';

export const CustomerSupportInbox: React.FC = () => {
  const [list, setList] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('all');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [customer, setCustomer] = useState<Record<string, any> | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escForm, setEscForm] = useState({
    targetDivision: 'operations' as 'operations' | 'finance' | 'marketing',
    title: '',
    description: '',
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await chatService.adminInbox({ status, keyword: keyword || undefined });
      setList(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat inbox.');
    } finally {
      setLoading(false);
    }
  }, [status, keyword]);

  const openThread = useCallback(async (id: string) => {
    setActiveId(id);
    try {
      const snap = await chatService.adminThread(id);
      setConversation(snap.conversation);
      setMessages(snap.messages);
      setCustomer(snap.customer || null);
      await chatService.adminRead(id);
      void loadInbox();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal membuka percakapan.');
    }
  }, [loadInbox]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useRealtimeChannel(
    true,
    ['chat.agents'],
    (evt) => {
      if (evt.event === 'ConversationUpdated' || evt.event === 'ChatMessageSent') {
        void loadInbox();
        if (activeId && (evt.payload as any)?.conversationId === activeId) {
          void openThread(activeId);
        } else if (activeId && evt.event === 'ConversationUpdated' && String((evt.payload as any)?.id) === activeId) {
          void openThread(activeId);
        }
      }
    },
    () => storageService.getToken()
  );

  useRealtimeChannel(
    !!activeId,
    activeId ? [`chat.conversation.${activeId}`] : [],
    (evt) => {
      if (evt.event === 'ChatMessageSent' && evt.payload) {
        const msg = evt.payload as any;
        setMessages((prev) => {
          if (prev.some((m) => m.id === String(msg.id))) return prev;
          return [
            ...prev,
            {
              id: String(msg.id),
              conversationId: String(msg.conversationId),
              senderRole: msg.senderRole,
              senderId: msg.senderId,
              senderName: msg.senderName,
              body: msg.body,
              createdAt: msg.createdAt,
              status: msg.status || 'delivered',
            },
          ];
        });
      }
    },
    () => storageService.getToken()
  );

  const send = async () => {
    if (!activeId || !draft.trim()) return;
    setSending(true);
    try {
      const msg = await chatService.adminSend(activeId, draft.trim());
      setMessages((prev) => [...prev, msg]);
      setDraft('');
      if (!conversation?.assignedAgentId) {
        await chatService.adminAssign(activeId);
      }
      void loadInbox();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal mengirim.');
    } finally {
      setSending(false);
    }
  };

  const convert = async () => {
    if (!activeId) return;
    if (!window.confirm('Konversi percakapan ini menjadi Ticket?')) return;
    try {
      const res = await chatService.adminConvertTicket(activeId);
      setError(null);
      alert(`Tiket dibuat: ${res.ticket?.ticketNumber || res.ticket?.id}`);
      void openThread(activeId);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal convert ticket.');
    }
  };

  const escalate = async () => {
    if (!activeId || !escForm.title.trim()) return;
    try {
      await chatService.adminEscalate(activeId, {
        targetDivision: escForm.targetDivision,
        title: escForm.title,
        description: escForm.description,
        type:
          escForm.targetDivision === 'operations'
            ? 'provider_issue'
            : escForm.targetDivision === 'finance'
              ? 'refund_request'
              : 'feedback',
      });
      setEscalateOpen(false);
      setEscForm({ targetDivision: 'operations', title: '', description: '' });
      void openThread(activeId);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal eskalasi.');
    }
  };

  const waitingCount = useMemo(() => list.filter((c) => c.status === 'waiting').length, [list]);

  return (
    <div className="space-y-4 pb-8">
      <CmsPageHeader
        title="Inbox"
        subtitle={`Live Chat Center — ${waitingCount} menunggu balasan. Chat dulu, Ticket hanya jika diperlukan.`}
        icon={MessageSquare}
      />

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)_280px] gap-4 min-h-[70vh]">
        {/* Left list */}
        <aside className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void loadInbox()}
                placeholder="Cari nama / pesan…"
                className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {['all', 'waiting', 'assigned', 'open', 'closed'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    status === s ? 'bg-primary-600 text-white' : 'bg-gray-50 text-gray-600'
                  }`}
                >
                  {s}
                </button>
              ))}
              <button type="button" onClick={() => void loadInbox()} className="ml-auto p-1.5 text-gray-500 hover:text-primary-600">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && <div className="p-6 text-center text-sm text-gray-400">Memuat…</div>}
            {!loading && list.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-400">Belum ada percakapan.</div>
            )}
            {list.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => void openThread(c.id)}
                className={`w-full text-left px-3 py-3 border-b border-gray-50 hover:bg-primary-50/40 ${
                  activeId === c.id ? 'bg-primary-50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-sm text-gray-900 truncate">{c.userName || `User #${c.userId}`}</p>
                  {(c.unreadAgent || 0) > 0 && (
                    <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {c.unreadAgent}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">{c.lastMessagePreview || '—'}</p>
                <p className="text-[10px] text-gray-400 mt-1 capitalize">{c.status}</p>
              </button>
            ))}
          </div>
        </aside>

        {/* Center thread */}
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm flex flex-col min-h-[60vh]">
          {!activeId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              Pilih percakapan di sebelah kiri
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2 justify-between">
                <div>
                  <p className="font-extrabold text-gray-900">{conversation?.userName || 'Customer'}</p>
                  <p className="text-xs text-gray-500">{conversation?.subject}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void convert()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold text-gray-700 hover:bg-gray-50"
                  >
                    <Ticket className="w-3.5 h-3.5" /> Convert Ticket
                  </button>
                  <button
                    type="button"
                    onClick={() => setEscalateOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold text-gray-700 hover:bg-gray-50"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Escalate
                  </button>
                  <button
                    type="button"
                    onClick={() => activeId && void chatService.adminClose(activeId).then(() => openThread(activeId))}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold text-rose-600 hover:bg-rose-50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Close
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.senderRole === 'agent' ? 'justify-end' : m.senderRole === 'system' ? 'justify-center' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                        m.senderRole === 'agent'
                          ? 'bg-primary-600 text-white'
                          : m.senderRole === 'system'
                            ? 'bg-white border text-gray-500 text-xs'
                            : 'bg-white border text-gray-800'
                      }`}
                    >
                      {m.senderRole !== 'system' && (
                        <p className={`text-[10px] font-bold mb-0.5 ${m.senderRole === 'agent' ? 'text-primary-100' : 'text-primary-600'}`}>
                          {m.senderName || m.senderRole}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="p-3 border-t border-gray-100 flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void send()}
                  placeholder="Balas customer…"
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                <button
                  type="button"
                  disabled={sending || !draft.trim()}
                  onClick={() => void send()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-bold disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Kirim
                </button>
              </div>
            </>
          )}
        </section>

        {/* Right customer panel */}
        <aside className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 hidden xl:block">
          <div className="flex items-center gap-2 mb-4">
            <UserRound className="w-5 h-5 text-primary-600" />
            <h3 className="font-extrabold text-gray-900">Customer Info</h3>
          </div>
          {!customer ? (
            <p className="text-sm text-gray-400">Pilih percakapan untuk melihat profil.</p>
          ) : (
            <dl className="space-y-3 text-sm">
              {[
                ['Nama', customer.name],
                ['Email', customer.email],
                ['HP', customer.phoneNumber],
                ['Role', customer.role],
                ['Saldo', customer.walletBalance != null ? `Rp ${Number(customer.walletBalance).toLocaleString('id-ID')}` : '—'],
                ['Registrasi', customer.registeredAt ? new Date(customer.registeredAt).toLocaleDateString('id-ID') : '—'],
                ['Transaksi', customer.transactionCount],
                ['Ticket', customer.ticketCount],
                ['Refund', customer.refundCount],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{k}</dt>
                  <dd className="font-semibold text-gray-800 mt-0.5 break-all">{v ?? '—'}</dd>
                </div>
              ))}
            </dl>
          )}
        </aside>
      </div>

      {escalateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/40" onClick={() => setEscalateOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-3">
            <h3 className="font-extrabold text-gray-900">Escalate ke Divisi</h3>
            <select
              value={escForm.targetDivision}
              onChange={(e) => setEscForm((f) => ({ ...f, targetDivision: e.target.value as any }))}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="operations">Operations (Provider)</option>
              <option value="finance">Finance (Refund)</option>
              <option value="marketing">Marketing (Feedback)</option>
            </select>
            <input
              value={escForm.title}
              onChange={(e) => setEscForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Judul kasus"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <textarea
              value={escForm.description}
              onChange={(e) => setEscForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Detail"
              rows={3}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEscalateOpen(false)} className="px-3 py-2 text-sm font-semibold text-gray-500">
                Batal
              </button>
              <button type="button" onClick={() => void escalate()} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-bold">
                Kirim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
