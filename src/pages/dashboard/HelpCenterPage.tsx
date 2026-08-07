import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Headphones,
  MessageCircle,
  Receipt,
  Ticket,
} from 'lucide-react';
import { CustomerChatPage } from './CustomerChatPage';
import { chatService } from '../../services/chat/chat.service';
import { apiClient } from '../../services/api';

type Tab = 'chat' | 'tickets' | 'refunds' | 'knowledge';

/**
 * User Help Center — Live Chat, Tickets, Refund Status, Knowledge (Sprint 8.0).
 */
export function HelpCenterPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'chat';
  const [tickets, setTickets] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<{ escalations: any[]; transactions: any[] }>({
    escalations: [],
    transactions: [],
  });
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    next.set('tab', t);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (tab === 'tickets') {
      setLoading(true);
      apiClient
        .get('/complaints')
        .then((res) => {
          const data = res.data?.data ?? res.data;
          setTickets(Array.isArray(data) ? data : data?.data || []);
        })
        .catch(() => setTickets([]))
        .finally(() => setLoading(false));
    }
    if (tab === 'refunds') {
      setLoading(true);
      chatService
        .refundStatuses()
        .then((data) => setRefunds(data))
        .finally(() => setLoading(false));
    }
    if (tab === 'knowledge') {
      setLoading(true);
      apiClient
        .get('/help')
        .then((res) => {
          const data = res.data?.data ?? res.data;
          setFaqs(data?.faqs || data?.faq || []);
        })
        .catch(() => setFaqs([]))
        .finally(() => setLoading(false));
    }
  }, [tab]);

  const tabs = useMemo(
    () => [
      { id: 'chat' as const, label: 'Live Chat', icon: MessageCircle },
      { id: 'tickets' as const, label: 'Ticket', icon: Ticket },
      { id: 'refunds' as const, label: 'Refund Status', icon: Receipt },
      { id: 'knowledge' as const, label: 'Knowledge', icon: BookOpen },
    ],
    []
  );

  return (
    <div className="space-y-4 pb-10">
      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
          <Headphones className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900">Help Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Live Chat ke Customer Support, pantau tiket & refund, dan baca panduan.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold transition ${
              tab === t.id ? 'bg-primary-600 text-white shadow-md' : 'bg-white border border-gray-100 text-gray-600'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'chat' && (
        <div className="rounded-3xl border border-gray-100 overflow-hidden bg-white shadow-sm min-h-[560px]">
          <CustomerChatPage />
        </div>
      )}

      {tab === 'tickets' && (
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-extrabold text-gray-900">Tiket Saya</h2>
            <Link to="/dashboard/account/complaints/new" className="text-sm font-bold text-primary-600">
              + Buat keluhan
            </Link>
          </div>
          {loading && <p className="text-sm text-gray-400">Memuat…</p>}
          {!loading && tickets.length === 0 && <p className="text-sm text-gray-400">Belum ada tiket.</p>}
          {tickets.map((t: any) => (
            <Link
              key={t.id}
              to={`/dashboard/account/complaints/${t.id}`}
              className="block rounded-2xl border border-gray-100 px-4 py-3 hover:bg-primary-50/40"
            >
              <p className="font-bold text-sm text-gray-900">{t.ticketNumber || t.ticket_number || t.subject || `Tiket #${t.id}`}</p>
              <p className="text-xs text-gray-500 mt-1">{t.status} · {t.category}</p>
            </Link>
          ))}
        </div>
      )}

      {tab === 'refunds' && (
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
          <h2 className="font-extrabold text-gray-900">Status Refund & Eskalasi</h2>
          {loading && <p className="text-sm text-gray-400">Memuat…</p>}
          {(refunds.escalations || []).map((e: any) => (
            <div key={e.id} className="rounded-2xl border px-4 py-3">
              <p className="font-bold text-sm">{e.title}</p>
              <p className="text-xs text-gray-500 mt-1">
                {e.status} · {e.targetDivision} · {e.type}
              </p>
            </div>
          ))}
          {(refunds.transactions || []).slice(0, 20).map((t: any) => (
            <div key={t.id} className="rounded-2xl border px-4 py-3">
              <p className="font-bold text-sm">{t.invoice || `TX #${t.id}`}</p>
              <p className="text-xs text-gray-500 mt-1">
                {t.status}
                {t.refundedAt ? ` · refunded ${new Date(t.refundedAt).toLocaleString('id-ID')}` : ''}
              </p>
            </div>
          ))}
          {!loading && !refunds.escalations?.length && !refunds.transactions?.length && (
            <p className="text-sm text-gray-400">Belum ada data refund.</p>
          )}
        </div>
      )}

      {tab === 'knowledge' && (
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
          <h2 className="font-extrabold text-gray-900">Knowledge Base</h2>
          {loading && <p className="text-sm text-gray-400">Memuat…</p>}
          {!loading && faqs.length === 0 && <p className="text-sm text-gray-400">FAQ belum tersedia.</p>}
          {faqs.map((f: any, i: number) => (
            <details key={f.id || i} className="rounded-2xl border px-4 py-3">
              <summary className="font-bold text-sm cursor-pointer">{f.question || f.title}</summary>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed whitespace-pre-wrap">{f.answer || f.content}</p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
