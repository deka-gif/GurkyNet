import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Power,
  PowerOff,
  RefreshCw,
  Shield,
  Star,
  Timer,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { operationsService } from '../../services/operations.service';
import { formatIDR } from '../../utils/currency';

type ProviderCard = {
  id: number;
  code: string;
  name: string;
  logo?: string | null;
  enabled: boolean;
  status: string;
  priority: number;
  apiStatus: string;
  apiStatusLabel?: string;
  healthColor: string;
  healthLabel?: string;
  statusDescription?: string | null;
  balance: number | null;
  productCount: number;
  productCountLabel?: string;
  lastSyncAt: string | null;
  lastSyncDisplay?: string | null;
  avgResponseMs: number | null;
  successRate: number | null;
  failedTransactionsToday: number;
  transactionsToday: number;
  lastHealthCheckAt: string | null;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  lastError?: string | null;
  isPrimary: boolean;
  online: boolean;
  transactionEligible?: boolean;
  apiWarning?: boolean;
};

type ProviderLog = {
  id: number;
  eventType: string;
  selectedProviderCode?: string;
  fallbackProviderCode?: string;
  reason?: string;
  responseTimeMs?: number;
  attempt?: number;
  success?: boolean | null;
  errorMessage?: string | null;
  createdAt?: string;
};

const formatIdr = (n: number | null | undefined) => {
  if (n === null || n === undefined) return '—';
  return formatIDR(n);
};

const formatTs = (iso: string | null | undefined) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('id-ID');
  } catch {
    return iso;
  }
};

const formatApiStatus = (card: ProviderCard) => {
  if (card.apiStatusLabel) return card.apiStatusLabel;
  const raw = (card.apiStatus || '').toLowerCase();
  const map: Record<string, string> = {
    online: 'Online',
    partial: 'Gangguan Sebagian',
    degraded: 'Gangguan Sebagian',
    syncing: 'Gangguan Sebagian',
    maintenance: 'Maintenance',
    offline: 'Offline',
    timeout: 'Offline',
    auth_failed: 'Autentikasi Gagal',
    not_configured: 'Belum Dikonfigurasi',
    no_response: 'Offline',
    unknown: 'Tidak Diketahui',
  };
  return map[raw] || (card.apiStatus ? String(card.apiStatus) : '—');
};

const healthTone = (color: string) => {
  const c = (color || '').toLowerCase();
  if (c === 'green') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (c === 'yellow') return 'bg-amber-50 text-amber-900 border-amber-200';
  if (c === 'orange') return 'bg-orange-50 text-orange-900 border-orange-200';
  return 'bg-rose-50 text-rose-800 border-rose-200';
};

const formatSyncTs = (card: ProviderCard) => {
  if (card.lastSyncDisplay) return card.lastSyncDisplay;
  return formatTs(card.lastSyncAt);
};

export const OperationsProductProviderControl: React.FC = () => {
  const [cards, setCards] = useState<ProviderCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<ProviderLog[]>([]);
  const [logsTitle, setLogsTitle] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await operationsService.getProductProviderControl();
      const data = res?.data ?? res;
      setCards(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat Control Center');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const runAction = async (id: number, action: () => Promise<any>, okMsg: string) => {
    setBusyId(id);
    try {
      await action();
      setToast(okMsg);
      await load();
    } catch (e: any) {
      setToast(e?.response?.data?.message || e?.message || 'Aksi gagal');
    } finally {
      setBusyId(null);
    }
  };

  const openLogs = async (card: ProviderCard) => {
    setLogsTitle(card.name);
    setLogsOpen(true);
    try {
      const res = await operationsService.getProductProviderLogs(card.id);
      const data = res?.data ?? res;
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs([]);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Operations</p>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Product Provider Control Center</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Pusat kendali Digiflazz, VIP Payment, dan provider berikutnya. Status API hanya mengatur kandidat transaksi —
            produk tetap berbasis Product Mapping + Priority + Auto Failover. User tidak melihat nama provider.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {toast && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">
          {toast}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {loading && cards.length === 0 ? (
        <div className="flex items-center justify-center py-24 text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Memuat provider…
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {cards.map((card) => {
            const busy = busyId === card.id;
            return (
              <div
                key={card.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                      {card.logo ? (
                        <img src={card.logo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Zap className="w-5 h-5 text-slate-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-extrabold text-slate-900">{card.name}</h2>
                        {card.isPrimary && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                            <Star className="w-3 h-3" /> Primary
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{card.code}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
                        card.enabled
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                      title="Provider power — controls product visibility"
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          card.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                        }`}
                      />
                      {card.enabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                </div>

                <div
                  className={`mb-4 rounded-xl border px-3 py-2.5 text-[12px] font-semibold flex items-start gap-2 ${healthTone(card.healthColor)}`}
                >
                  <Activity className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-extrabold">{formatApiStatus(card)}</div>
                    <p className="font-medium mt-0.5 opacity-90">
                      {card.statusDescription ||
                        card.lastError ||
                        'Status provider belum diperiksa.'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                  <Metric icon={<Shield className="w-3.5 h-3.5" />} label="Priority" value={String(card.priority)} />
                  <Metric icon={<Wallet className="w-3.5 h-3.5" />} label="Saldo" value={formatIdr(card.balance)} />
                  <Metric
                    icon={<LayersIcon />}
                    label="Produk"
                    value={card.productCountLabel || `${card.productCount ?? 0} SKU`}
                  />
                  <Metric
                    icon={<Timer className="w-3.5 h-3.5" />}
                    label="Avg Response"
                    value={card.avgResponseMs != null ? `${card.avgResponseMs} ms` : '—'}
                  />
                  <Metric
                    icon={<TrendingUp className="w-3.5 h-3.5" />}
                    label="Success Rate"
                    value={card.successRate != null ? `${card.successRate}%` : '—'}
                  />
                  <Metric
                    icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    label="Tx Hari Ini"
                    value={String(card.transactionsToday ?? 0)}
                  />
                  <Metric
                    icon={<AlertTriangle className="w-3.5 h-3.5" />}
                    label="Gagal Hari Ini"
                    value={String(card.failedTransactionsToday ?? 0)}
                  />
                  <Metric
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    label="Terakhir Sinkron"
                    value={formatSyncTs(card)}
                  />
                </div>

                <p className="text-[11px] text-slate-400 mb-4">
                  Health check terakhir: {formatTs(card.lastHealthCheckAt)}
                </p>

                {(card.apiWarning || (card.enabled && card.transactionEligible === false)) && (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      {card.statusDescription ||
                        'API Provider sedang tidak dapat dihubungi. Produk tetap tersedia dari hasil sinkronisasi terakhir. Transaksi baru akan dialihkan ke provider cadangan apabila tersedia.'}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <ActionBtn
                    disabled={busy}
                    onClick={() => runAction(card.id, () => operationsService.syncProductProvider(card.id), 'Sync started / completed')}
                  >
                    Sync Now
                  </ActionBtn>
                  <ActionBtn
                    disabled={busy}
                    onClick={() => runAction(card.id, () => operationsService.healthCheckProductProvider(card.id), 'Health check done')}
                  >
                    Health Check
                  </ActionBtn>
                  {card.enabled ? (
                    <ActionBtn
                      disabled={busy}
                      tone="warn"
                      onClick={() =>
                        runAction(card.id, () => operationsService.disableProductProvider(card.id), 'Provider OFF — products hidden')
                      }
                    >
                      <PowerOff className="w-3.5 h-3.5" /> Turn OFF
                    </ActionBtn>
                  ) : (
                    <ActionBtn
                      disabled={busy}
                      tone="ok"
                      onClick={() =>
                        runAction(card.id, () => operationsService.enableProductProvider(card.id), 'Provider ON — products visible')
                      }
                    >
                      <Power className="w-3.5 h-3.5" /> Turn ON
                    </ActionBtn>
                  )}
                  <ActionBtn
                    disabled={busy || card.isPrimary}
                    onClick={() => runAction(card.id, () => operationsService.setPrimaryProductProvider(card.id), 'Set as primary')}
                  >
                    <Star className="w-3.5 h-3.5" /> Set Primary
                  </ActionBtn>
                  <ActionBtn disabled={busy} onClick={() => openLogs(card)}>
                    View Logs
                  </ActionBtn>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {logsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900">Logs — {logsTitle}</h3>
              <button type="button" onClick={() => setLogsOpen(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {logs.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">Belum ada log.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs">
                    <div className="flex justify-between gap-2 font-bold text-slate-800">
                      <span>{log.eventType}</span>
                      <span className="text-slate-400 font-medium">{formatTs(log.createdAt)}</span>
                    </div>
                    <p className="text-slate-600 mt-1">
                      {log.reason || '—'}
                      {log.responseTimeMs != null ? ` · ${log.responseTimeMs}ms` : ''}
                      {log.attempt != null ? ` · attempt ${log.attempt}` : ''}
                    </p>
                    {log.errorMessage && <p className="text-rose-600 mt-1">{log.errorMessage}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LayersIcon = () => <span className="text-[10px] font-black">SKU</span>;

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
      {icon}
      {label}
    </div>
    <div className="text-sm font-extrabold text-slate-800 truncate" title={value}>
      {value}
    </div>
  </div>
);

const ActionBtn: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'ok' | 'warn';
}> = ({ children, onClick, disabled, tone = 'default' }) => {
  const tones =
    tone === 'ok'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
      : tone === 'warn'
        ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition disabled:opacity-50 ${tones}`}
    >
      {children}
    </button>
  );
};
