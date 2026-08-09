import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  Share2,
  Shield,
} from 'lucide-react';
import { workflowService, type WorkflowItem } from '../../services/workflow/workflow.service';
import { operationsService } from '../../services/operations.service';
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';
import { storageService } from '../../services/storage.service';
import { CmsPageHeader } from '../../components/common/CmsCommon';
import { RefreshPolicy } from '../../lib/refreshPolicy';
import { useOwnerReadOnly } from '../../hooks/useOwnerReadOnly';

type Division = 'operations' | 'finance' | 'marketing' | 'admin' | 'customer_support';

type Props = {
  division: Division;
  title: string;
  subtitle: string;
  /** When true, list all divisions (owner global queue). */
  global?: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  waiting_cs: 'Waiting CS',
  waiting_operations: 'Waiting Ops',
  waiting_finance: 'Waiting Finance',
  waiting_marketing: 'Waiting Marketing',
  waiting_user: 'Waiting User',
  resolved: 'Resolved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  closed: 'Closed',
};

function actionsFor(
  division: Division,
  item: WorkflowItem | null,
  ownerReadOnly: boolean
): { key: string; label: string; tone?: 'primary' | 'danger' | 'muted' }[] {
  if (!item || ['resolved', 'rejected', 'cancelled', 'closed'].includes(item.status)) {
    return [];
  }

  // Sprint 2 Revision — Frontend Alignment (SRS Bagian 5 & 13.1): Owner
  // dapat membuka queue lintas divisi (Operations/Finance/Marketing/CS)
  // untuk memantau (read-only), tapi backend (EnsureOwnerReadOnly) menolak
  // semua aksi operasional harian di sini dengan 403. Satu-satunya aksi
  // yang tetap diizinkan untuk Owner adalah "Force Resolve" pada Global
  // Workflow Queue — itu mekanisme approval/override khusus Owner
  // (FR-OWN04) yang tidak dilindungi EnsureOwnerReadOnly di backend.
  if (ownerReadOnly) {
    if (division === 'admin') {
      return [{ key: 'force_resolve', label: 'Force Resolve', tone: 'primary' }];
    }
    return [];
  }

  if (division === 'operations') {
    return [
      { key: 'retry', label: 'Retry Intent' },
      { key: 'need_refund', label: 'Need Refund', tone: 'danger' },
      { key: 'sku_disable', label: 'Disable SKU' },
      { key: 'sku_enable', label: 'Enable SKU' },
      { key: 'maintenance', label: 'Maintenance' },
      { key: 'create_sop', label: 'Create SOP Draft' },
      { key: 'escalate_admin', label: 'Escalate Admin' },
      { key: 'resolve', label: 'Resolve', tone: 'primary' },
    ];
  }

  if (division === 'finance') {
    return [
      { key: 'approve', label: 'Approve Refund', tone: 'primary' },
      { key: 'partial_refund', label: 'Partial (note)' },
      { key: 'need_investigation', label: 'Need Investigation' },
      { key: 'escalate_admin', label: 'Escalate Admin' },
      { key: 'reject', label: 'Reject', tone: 'danger' },
    ];
  }

  if (division === 'marketing') {
    return [
      { key: 'create_faq_draft', label: 'FAQ Draft' },
      { key: 'create_knowledge_draft', label: 'Knowledge Draft' },
      { key: 'create_announcement_draft', label: 'Announcement Draft' },
      { key: 'create_banner', label: 'Link Banner CMS' },
      { key: 'update_homepage', label: 'Link Homepage' },
      { key: 'resolve', label: 'Resolve', tone: 'primary' },
      { key: 'reject', label: 'Reject', tone: 'danger' },
    ];
  }

  if (division === 'admin') {
    return [
      { key: 'force_resolve', label: 'Force Resolve', tone: 'primary' },
      { key: 'close', label: 'Close', tone: 'muted' },
    ];
  }

  return [{ key: 'close', label: 'Close', tone: 'muted' }];
}

export const WorkflowQueuePage: React.FC<Props> = ({ division, title, subtitle, global }) => {
  // Sprint 2 Revision — Frontend Alignment: Owner read-only pada Workflow Queue.
  const isOwnerReadOnly = useOwnerReadOnly();
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<WorkflowItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const channel = global ? 'division.customer_support' : `division.${division === 'admin' ? 'customer_support' : division}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | boolean> = { open_only: !statusFilter };
      if (!global && division !== 'admin' && division !== 'customer_support') {
        params.division = division;
      }
      if (division === 'admin' && !global) {
        // admin queue shows admin division + all via global flag
      }
      if (global) {
        // no division filter
      } else if (division === 'admin') {
        params.division = 'admin';
      } else if (division === 'customer_support') {
        // CS read-all — no division lock
      } else {
        params.division = division;
      }
      if (statusFilter) {
        params.status = statusFilter;
        delete params.open_only;
      }
      if (q.trim()) params.q = q.trim();

      const res = await workflowService.list(params);
      setItems(res.data);
      if (selectedId && !res.data.some((i) => i.id === selectedId)) {
        setSelectedId(res.data[0]?.id ?? null);
      } else if (!selectedId && res.data[0]) {
        setSelectedId(res.data[0].id);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat queue.');
    } finally {
      setLoading(false);
    }
  }, [division, global, q, statusFilter, selectedId]);

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    try {
      const d =
        division === 'operations'
          ? ((await operationsService.getIssueDetail(id)) as WorkflowItem)
          : await workflowService.get(id);
      setDetail(d);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat detail.');
    } finally {
      setDetailLoading(false);
    }
  }, [division]);

  useEffect(() => {
    void load();
  }, [division, global, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  useRealtimeChannel(
    true,
    [channel],
    () => {
      void load();
      if (selectedId) void loadDetail(selectedId);
    },
    () => storageService.getToken(),
    RefreshPolicy.workflow
  );

  const runAction = async (action: string) => {
    if (!selectedId) return;
    const note =
      ['resolve', 'reject', 'approve', 'force_resolve', 'close', 'need_refund'].includes(action)
        ? window.prompt('Catatan (opsional):', '') || undefined
        : undefined;

    setBusy(true);
    setError(null);
    try {
      if (action === 'force_resolve') {
        await workflowService.forceResolve(selectedId, note);
      } else if (action === 'close') {
        await workflowService.close(selectedId, note);
      } else if (action === 'sku_disable' || action === 'sku_enable') {
        const sku = window.prompt('product_provider_sku_id (kosongkan jika sudah ter-link di workflow):', '');
        const payload = sku ? { product_provider_sku_id: Number(sku) } : undefined;
        await workflowService.action(selectedId, action, note, payload);
      } else if (action === 'maintenance') {
        const pid = window.prompt('product_provider_id (opsional jika sudah di meta):', '');
        const payload = pid ? { product_provider_id: Number(pid) } : undefined;
        await workflowService.action(selectedId, action, note, payload);
      } else {
        await workflowService.action(selectedId, action, note);
      }
      await load();
      await loadDetail(selectedId);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Aksi gagal.');
    } finally {
      setBusy(false);
    }
  };

  const actionButtons = useMemo(
    () => actionsFor(division, detail, isOwnerReadOnly),
    [division, detail, isOwnerReadOnly]
  );

  return (
    <div className="space-y-4 pb-10">
      <CmsPageHeader title={title} subtitle={subtitle} icon={Share2} />

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 min-h-[70vh]">
        {/* List */}
        <div className="xl:col-span-4 rounded-2xl border border-gray-100 bg-white shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100 space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void load()}
                  placeholder="Cari kode / judul…"
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-gray-200"
                />
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="px-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs rounded-xl border border-gray-200 px-3 py-2"
            >
              <option value="">Open only</option>
              <option value="waiting_operations">Waiting Ops</option>
              <option value="waiting_finance">Waiting Finance</option>
              <option value="waiting_marketing">Waiting Marketing</option>
              <option value="waiting_cs">Waiting CS</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto divide-y">
            {loading && (
              <div className="p-8 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Memuat…
              </div>
            )}
            {!loading && items.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">Antrian kosong.</div>
            )}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left p-3 hover:bg-gray-50 transition ${
                  selectedId === item.id ? 'bg-primary-50/60 border-l-4 border-primary-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-extrabold text-gray-900 line-clamp-1">{item.title}</p>
                  <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                    {item.priority}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1 font-mono">{item.workflowCode}</p>
                <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {STATUS_LABEL[item.status] || item.status}
                  <span className="text-gray-300">·</span>
                  {item.category}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Detail + timeline */}
        <div className="xl:col-span-5 rounded-2xl border border-gray-100 bg-white shadow-sm flex flex-col overflow-hidden">
          {!selectedId && (
            <div className="flex-1 grid place-items-center text-sm text-gray-400 p-8">Pilih workflow dari antrian.</div>
          )}
          {selectedId && detailLoading && (
            <div className="flex-1 grid place-items-center text-sm text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
          {selectedId && detail && !detailLoading && (
            <>
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-mono text-gray-400">{detail.workflowCode}</p>
                    <h2 className="text-lg font-extrabold text-gray-900 mt-0.5">{detail.title}</h2>
                    <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{detail.description || '—'}</p>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-gray-100 text-gray-700">
                    {STATUS_LABEL[detail.status] || detail.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {actionButtons.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction(a.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                        a.tone === 'primary'
                          ? 'bg-primary-600 text-white border-primary-600'
                          : a.tone === 'danger'
                            ? 'border-rose-200 text-rose-600'
                            : 'border-gray-200 text-gray-700'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                  {isOwnerReadOnly && actionButtons.length === 0 && (
                    <span className="text-[11px] font-bold text-gray-400 italic">
                      Mode lihat-saja (Owner) — aksi ditangani divisi terkait.
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <p className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-3">Timeline</p>
                <ol className="space-y-3">
                  {(detail.events || []).map((ev) => (
                    <li key={ev.id} className="relative pl-4 border-l-2 border-primary-100">
                      <span className="absolute -left-1.5 top-1 w-2.5 h-2.5 rounded-full bg-primary-500" />
                      <p className="text-xs font-bold text-gray-800">
                        {ev.eventType}
                        {ev.action ? ` · ${ev.action}` : ''}
                      </p>
                      <p className="text-sm text-gray-600 mt-0.5">{ev.body}</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {ev.actorName || 'System'} · {ev.createdAt ? new Date(ev.createdAt).toLocaleString('id-ID') : ''}
                      </p>
                    </li>
                  ))}
                  {(detail.events || []).length === 0 && (
                    <p className="text-sm text-gray-400">Belum ada event.</p>
                  )}
                </ol>
              </div>
            </>
          )}
        </div>

        {/* Context */}
        <div className="xl:col-span-3 rounded-2xl border border-gray-100 bg-white shadow-sm p-4 space-y-4">
          <p className="text-xs font-extrabold uppercase tracking-wide text-gray-400 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" /> Context
          </p>
          {detail ? (
            <div className="space-y-3 text-sm">
              <Row label="Division" value={detail.currentDivision} />
              <Row label="Category" value={detail.category} />
              <Row label="Priority" value={detail.priority} />
              <Row label="Source" value={detail.source} />
              <Row label="Created by" value={detail.createdByName || '—'} />
              <Row label="Assignee" value={detail.assignedToName || '—'} />
              <Row label="Conversation" value={detail.conversationId ? `#${detail.conversationId}` : '—'} />
              {detail.transaction && (
                <>
                  <hr className="border-gray-100" />
                  <p className="text-xs font-extrabold uppercase text-gray-400">Transaction</p>
                  <Row label="Invoice" value={detail.transaction.invoice || `#${detail.transaction.id}`} />
                  <Row label="Customer" value={detail.transaction.customerName || '—'} />
                  <Row label="Status" value={String(detail.transaction.status || '—')} />
                  <Row
                    label="Amount"
                    value={
                      detail.transaction.totalPayment != null
                        ? `Rp ${Number(detail.transaction.totalPayment).toLocaleString('id-ID')}`
                        : '—'
                    }
                  />
                </>
              )}
              {(detail as any).opsDetail?.transaction && (
                <>
                  <hr className="border-gray-100" />
                  <p className="text-xs font-extrabold uppercase text-gray-400">Ops Snapshot</p>
                  <Row label="RC" value={String((detail as any).opsDetail.transaction.rc ?? '—')} />
                  <Row label="Retry" value={String((detail as any).opsDetail.transaction.retryCount ?? 0)} />
                  <Row label="Provider" value={String((detail as any).opsDetail.transaction.providerCode ?? '—')} />
                  <Row label="SKU" value={String((detail as any).opsDetail.transaction.sku ?? '—')} />
                  {(detail as any).opsDetail.transaction.apiResponse != null && (
                    <pre className="text-[10px] text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-xl p-3 max-h-40 overflow-y-auto">
                      {JSON.stringify((detail as any).opsDetail.transaction.apiResponse, null, 2)}
                    </pre>
                  )}
                </>
              )}
              {detail.meta?.chat_summary != null && (
                <>
                  <hr className="border-gray-100" />
                  <p className="text-xs font-extrabold uppercase text-gray-400">Chat Summary</p>
                  <pre className="text-[11px] text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-xl p-3 max-h-48 overflow-y-auto">
                    {String(detail.meta.chat_summary)}
                  </pre>
                </>
              )}
              {detail.meta?.cms_deep_link != null && (
                <a
                  href={String(detail.meta.cms_deep_link)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary-700"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Buka CMS
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Tidak ada konteks.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[10px] uppercase font-bold text-gray-400">{label}</p>
    <p className="font-semibold text-gray-800 break-all">{value}</p>
  </div>
);

export const OperationsIssueQueue: React.FC = () => (
  <WorkflowQueuePage
    division="operations"
    title="Issue Queue"
    subtitle="Technical back office — provider, SKU, sync, latency. Resolve mengembalikan status ke Customer Support."
  />
);

export const FinanceEscalationQueue: React.FC = () => (
  <WorkflowQueuePage
    division="finance"
    title="Refund Queue"
    subtitle="Financial back office — Approve memakai WalletRefundService yang ada (full refund)."
  />
);

export const MarketingFeedbackQueue: React.FC = () => (
  <WorkflowQueuePage
    division="marketing"
    title="Feedback Queue"
    subtitle="Content back office — draft FAQ / Knowledge / Announcement. Tanpa auto-publish homepage."
  />
);

export const AdminGlobalWorkflowQueue: React.FC = () => (
  <WorkflowQueuePage
    division="admin"
    title="Global Workflow Queue"
    subtitle="Semua workflow lintas divisi — override, assign, force resolve."
    global
  />
);

export const CsWorkflowReadQueue: React.FC = () => (
  <WorkflowQueuePage
    division="customer_support"
    title="Workflow Tracker"
    subtitle="Customer Support — pantau semua workflow lintas divisi (read + close)."
    global
  />
);
