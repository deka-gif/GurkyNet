import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  healthIndicators?: {
    connection?: string;
    authentication?: string;
    balance?: string;
    service?: string;
  } | null;
  providerCode?: string | null;
  providerMessage?: string | null;
  probeLatencyMs?: number | null;
  balance: number | null;
  productCount: number;
  productCountLabel?: string;
  lastSyncAt: string | null;
  lastSyncDisplay?: string | null;
  lastSyncDurationSec?: number | null;
  nextRecommendedSyncAt?: string | null;
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
  apiVersion?: string | null;
  productAudit?: {
    providerSku?: number;
    databaseSku?: number;
    difference?: number;
    warning?: boolean;
  } | null;
  syncSummary?: Record<string, unknown> | null;
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
  meta?: Record<string, unknown> | null;
  createdAt?: string;
};

type SyncSummary = {
  providerSkuTotal?: number;
  inserted?: number;
  updated?: number;
  skipped?: number;
  disabled?: number;
  durationSec?: number | null;
  audit?: { providerSku?: number; databaseSku?: number; difference?: number };
  message?: string;
  providerName?: string;
};

type AutoSyncStatus = {
  enabled?: boolean;
  status?: string;
  running?: boolean;
  schedule?: { frequency?: string; time?: string; timezone?: string; display?: string };
  providers?: Array<{
    code: string;
    name: string;
    included?: boolean;
    lastResult?: {
      status?: string;
      provider_sku_total?: number;
      database_sku_total?: number;
      duration_sec?: number | null;
      error?: string | null;
      provider_code?: string | null;
    } | null;
  }>;
  step?: string | null;
  steps?: Array<{ label?: string; status?: string; error?: string }>;
  lastSynchronization?: {
    at?: string | null;
    dateDisplay?: string | null;
    timeDisplay?: string | null;
    status?: string | null;
    durationSec?: number | null;
  };
  nextSynchronization?: {
    at?: string | null;
    dateDisplay?: string | null;
    timeDisplay?: string | null;
  };
  lastError?: string | null;
  lastStatus?: string | null;
  message?: string | null;
};

const SYNC_STEPS = [
  'Connecting Provider...',
  'Authenticating...',
  'Downloading Pricelist...',
  'Normalizing Data...',
  'Comparing Existing SKU...',
  'Importing New SKU...',
  'Updating Existing SKU...',
  'Cleaning Obsolete SKU...',
  'Finishing...',
];

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

const formatClock = (d: Date) =>
  d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const formatApiStatus = (card: ProviderCard) => {
  if (card.apiStatusLabel) return card.apiStatusLabel;
  const raw = (card.apiStatus || '').toLowerCase();
  const map: Record<string, string> = {
    online: 'ONLINE',
    partial: 'PARTIAL',
    degraded: 'PARTIAL',
    syncing: 'PARTIAL',
    maintenance: 'MAINTENANCE',
    offline: 'OFFLINE',
    timeout: 'OFFLINE',
    auth_failed: 'AUTH_FAILED',
    config_error: 'CONFIG_ERROR',
    network_configuration: 'NETWORK_CONFIGURATION',
    not_configured: 'NOT_CONFIGURED',
    disabled: 'DISABLED',
    no_response: 'OFFLINE',
    unknown: 'UNKNOWN',
  };
  return map[raw] || (card.apiStatus ? String(card.apiStatus).toUpperCase() : '—');
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

const unwrapProviders = (payload: any): ProviderCard[] => {
  const data = payload?.data ?? payload;
  if (Array.isArray(data?.providers)) return data.providers;
  if (Array.isArray(data)) return data;
  return [];
};

const unwrapAutoSync = (payload: any): AutoSyncStatus | null => {
  const data = payload?.data ?? payload;
  if (data?.autoSync && typeof data.autoSync === 'object') return data.autoSync as AutoSyncStatus;
  if (data?.schedule && typeof data.schedule === 'object') return data as AutoSyncStatus;
  return null;
};

export const OperationsProductProviderControl: React.FC = () => {
  const [cards, setCards] = useState<ProviderCard[]>([]);
  const [autoSync, setAutoSync] = useState<AutoSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [globalRefreshing, setGlobalRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<ProviderLog[]>([]);
  const [logsTitle, setLogsTitle] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);

  const [syncProgress, setSyncProgress] = useState<{
    providerName: string;
    stepIndex: number;
  } | null>(null);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);

  const mountedRef = useRef(true);
  const progressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await operationsService.getProductProviderControl();
      if (!mountedRef.current) return;
      setCards(unwrapProviders(res));
      const nextAuto = unwrapAutoSync(res);
      if (nextAuto) setAutoSync(nextAuto);
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(e?.message || e?.response?.data?.message || 'Gagal memuat Control Center');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll auto-sync status while scheduler is running (server-driven steps, not a JS sync timer).
  useEffect(() => {
    if (!autoSync?.running) return;
    const id = window.setInterval(async () => {
      try {
        const res = await operationsService.getAutomaticCatalogSyncStatus();
        if (!mountedRef.current) return;
        const next = unwrapAutoSync(res);
        if (next) setAutoSync(next);
        if (next && !next.running) {
          await load();
        }
      } catch {
        /* ignore poll errors */
      }
    }, 4000);
    return () => window.clearInterval(id);
  }, [autoSync?.running, load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const startProgress = (providerName: string) => {
    setSyncProgress({ providerName, stepIndex: 0 });
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
    progressTimerRef.current = window.setInterval(() => {
      setSyncProgress((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          stepIndex: Math.min(prev.stepIndex + 1, SYNC_STEPS.length - 1),
        };
      });
    }, 1800);
  };

  const stopProgress = () => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setSyncProgress(null);
  };

  const globalRefresh = async () => {
    if (globalRefreshing) return;
    setGlobalRefreshing(true);
    setRefreshFailed(false);
    setError(null);
    try {
      const res = await operationsService.refreshProductProviderControl();
      if (!mountedRef.current) return;
      const providers = unwrapProviders(res);
      if (providers.length > 0) setCards(providers);
      else await load();
      const nextAuto = unwrapAutoSync(res);
      if (nextAuto) setAutoSync(nextAuto);
      setLastRefreshedAt(new Date());
      setToast('Refreshing Product Provider selesai.');
    } catch (e: any) {
      if (!mountedRef.current) return;
      setRefreshFailed(true);
      setToast(e?.message || 'Refresh gagal. Silakan coba kembali.');
      // Soft fallback — still try list endpoint
      try {
        await load();
      } catch {
        /* ignore */
      }
    } finally {
      if (mountedRef.current) setGlobalRefreshing(false);
    }
  };

  const runAction = async (id: number, action: () => Promise<any>, okMsg: string) => {
    setBusyId(id);
    try {
      const res = await action();
      // Provider business errors return HTTP 200 + success:false (e.g. RC83)
      if (res && res.success === false) {
        const fail = res as any;
        const code = fail.provider_code || fail.providerCode || '';
        setToast(
          [code, fail.message || 'Aksi gagal']
            .filter(Boolean)
            .join(' — ')
        );
        await load();
        return res;
      }
      setToast(okMsg);
      const card = res?.data?.provider || res?.provider;
      if (card?.id) {
        setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, ...card } : c)));
      } else {
        await load();
      }
      return res;
    } catch (e: any) {
      const code = e?.providerCode || e?.code;
      setToast([code, e?.message || 'Aksi gagal'].filter(Boolean).join(' — '));
      return null;
    } finally {
      setBusyId(null);
    }
  };

  const runSync = async (card: ProviderCard) => {
    setBusyId(card.id);
    startProgress(card.name);
    try {
      const res = await operationsService.syncProductProvider(card.id);
      if (!mountedRef.current) return;

      if (res && res.success === false) {
        const fail = res as any;
        const code = fail.provider_code || '';
        setToast([code, fail.message || 'Sync gagal'].filter(Boolean).join(' — '));
        await load();
        return;
      }

      const data = (res as any)?.data ?? res;
      const summary = data?.summary || {
        providerSkuTotal: data?.provider_sku_total ?? data?.synced_count,
        inserted: data?.inserted ?? data?.imported,
        updated: data?.updated,
        skipped: data?.skipped,
        disabled: data?.disabled,
        durationSec: data?.duration_sec ?? data?.durationSec,
      };
      setSyncSummary({
        ...summary,
        audit: data?.audit,
        message: data?.message || res?.message,
        providerName: card.name,
      });
      setToast('Synchronization Completed');
      const nextCard = data?.provider;
      if (nextCard?.id) {
        setCards((prev) => prev.map((c) => (c.id === nextCard.id ? { ...c, ...nextCard } : c)));
      } else {
        await load();
      }
    } catch (e: any) {
      if (!mountedRef.current) return;
      const code = e?.providerCode || e?.code;
      setToast([code, e?.message || 'Sync gagal'].filter(Boolean).join(' — '));
    } finally {
      stopProgress();
      if (mountedRef.current) setBusyId(null);
    }
  };

  const openLogs = async (card: ProviderCard) => {
    setLogsTitle(card.name);
    setLogsOpen(true);
    try {
      const res = await operationsService.getProductProviderLogs(card.id, 80);
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
            Pusat monitoring Digiflazz & VIPayment. Refresh menjalankan health, saldo, latency, dan SKU tanpa reload
            halaman.
          </p>
          {lastRefreshedAt && !refreshFailed && (
            <p className="mt-2 text-[11px] font-semibold text-slate-400">
              Last refreshed {formatClock(lastRefreshedAt)}
            </p>
          )}
          {refreshFailed && (
            <p className="mt-2 text-[11px] font-semibold text-rose-600">Refresh gagal. Silakan coba kembali.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void globalRefresh()}
          disabled={globalRefreshing}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition disabled:opacity-70"
        >
          <RefreshCw className={`w-4 h-4 ${globalRefreshing ? 'animate-spin' : ''}`} />
          {globalRefreshing ? 'Refreshing Product Provider...' : 'Refresh'}
        </button>
      </div>

      {toast && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">
          {toast}
        </div>
      )}

      {syncProgress && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 shadow-sm">
          <div className="flex items-center gap-2 font-extrabold">
            <Loader2 className="w-4 h-4 animate-spin" />
            Sync {syncProgress.providerName}
          </div>
          <ol className="mt-3 space-y-1.5 text-[12px]">
            {SYNC_STEPS.map((step, idx) => (
              <li
                key={step}
                className={
                  idx < syncProgress.stepIndex
                    ? 'text-emerald-700 font-semibold'
                    : idx === syncProgress.stepIndex
                      ? 'font-extrabold text-indigo-900'
                      : 'text-indigo-400'
                }
              >
                {idx < syncProgress.stepIndex ? '✓ ' : idx === syncProgress.stepIndex ? '→ ' : '· '}
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {autoSync && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Automatic Synchronization</p>
              <h2 className="text-lg font-extrabold text-slate-900 mt-0.5">Nightly Product Provider Sync</h2>
              <p className="text-xs text-slate-500 mt-1">
                Digiflazz prepaid → cooldown → Digiflazz pasca → VIPayment. Manual Sync Now tetap tersedia per kartu.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${
                  autoSync.enabled
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${autoSync.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {autoSync.enabled ? 'Enabled' : 'Disabled'}
              </span>
              {autoSync.running && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border bg-indigo-50 text-indigo-800 border-indigo-200">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Running…
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Schedule</p>
              <p className="mt-1 font-extrabold text-slate-900">{autoSync.schedule?.frequency || 'Daily'}</p>
              <p className="text-slate-600 font-semibold">{autoSync.schedule?.display || autoSync.schedule?.time || '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Last Synchronization</p>
              <p className="mt-1 font-extrabold text-slate-900">
                {autoSync.lastSynchronization?.dateDisplay || '—'}
              </p>
              <p className="text-slate-600 font-semibold">
                {autoSync.lastSynchronization?.timeDisplay || '—'}
                {autoSync.lastSynchronization?.status
                  ? ` · ${String(autoSync.lastSynchronization.status).toUpperCase()}`
                  : ''}
                {autoSync.lastSynchronization?.durationSec != null
                  ? ` · ${autoSync.lastSynchronization.durationSec}s`
                  : ''}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Next Synchronization</p>
              <p className="mt-1 font-extrabold text-slate-900">
                {autoSync.nextSynchronization?.dateDisplay || '—'}
              </p>
              <p className="text-slate-600 font-semibold">{autoSync.nextSynchronization?.timeDisplay || '—'}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(autoSync.providers || []).map((p) => (
              <span
                key={p.code}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {p.name}
                {p.lastResult?.status ? (
                  <span
                    className={
                      p.lastResult.status === 'success'
                        ? 'text-emerald-700'
                        : p.lastResult.status === 'partial'
                          ? 'text-amber-700'
                          : 'text-rose-700'
                    }
                  >
                    · {p.lastResult.status}
                    {p.lastResult.provider_sku_total != null && p.lastResult.database_sku_total != null
                      ? ` (${p.lastResult.provider_sku_total}/${p.lastResult.database_sku_total})`
                      : ''}
                  </span>
                ) : null}
              </span>
            ))}
          </div>

          {autoSync.running && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
              <div className="flex items-center gap-2 font-extrabold">
                <Loader2 className="w-4 h-4 animate-spin" />
                Automatic Synchronization Running…
              </div>
              <p className="mt-2 text-[12px] font-semibold">{autoSync.step || 'Preparing…'}</p>
              {(autoSync.steps || []).length > 0 && (
                <ol className="mt-2 space-y-1 text-[12px]">
                  {autoSync.steps!.slice(-6).map((s, idx) => (
                    <li key={`${s.label}-${idx}`} className="font-semibold">
                      {s.status === 'success' ? '✓ ' : s.status === 'failed' ? '✕ ' : '· '}
                      {s.label}
                      {s.error ? ` — ${s.error}` : ''}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {!autoSync.running && autoSync.lastStatus === 'failed' && autoSync.lastError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-extrabold">Automatic Synchronization Failed</p>
                <p className="mt-0.5 text-[12px] font-semibold">{autoSync.lastError}</p>
              </div>
            </div>
          )}
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
            const busy = busyId === card.id || globalRefreshing;
            const audit = card.productAudit;
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
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
                      card.enabled
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        card.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                      }`}
                    />
                    {card.enabled ? 'ON' : 'OFF'}
                  </span>
                </div>

                <div
                  className={`mb-4 rounded-xl border px-3 py-2.5 text-[12px] font-semibold flex items-start gap-2 ${healthTone(card.healthColor)}`}
                >
                  <Activity className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <div className="w-full">
                    <div className="font-extrabold">{formatApiStatus(card)}</div>
                    <p className="font-medium mt-0.5 opacity-90">
                      {card.statusDescription || card.lastError || 'Status provider belum diperiksa.'}
                    </p>
                    {card.healthIndicators && (
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                        {(
                          [
                            ['Connection', card.healthIndicators.connection],
                            ['Authentication', card.healthIndicators.authentication],
                            ['Balance', card.healthIndicators.balance],
                            ['Service Status', card.healthIndicators.service],
                          ] as const
                        ).map(([label, value]) => (
                          <div key={label} className="rounded-lg bg-white/60 border border-black/5 px-2 py-1.5">
                            <div className="text-[9px] uppercase tracking-wide opacity-60 font-bold">{label}</div>
                            <div className="font-extrabold">{value || '—'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <div className="text-[9px] uppercase tracking-wide opacity-60 font-bold">Provider Code</div>
                        <div className="font-mono font-extrabold">
                          {card.providerCode
                            ? String(card.providerCode).match(/^\d+$/)
                              ? `RC ${card.providerCode}`
                              : card.providerCode
                            : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wide opacity-60 font-bold">Latency</div>
                        <div className="font-mono font-extrabold">
                          {card.probeLatencyMs != null ? `${card.probeLatencyMs} ms` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wide opacity-60 font-bold">API Version</div>
                        <div className="font-mono font-extrabold">{card.apiVersion || '—'}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wide opacity-60 font-bold">Last Checked</div>
                        <div className="font-mono font-extrabold">{formatTs(card.lastHealthCheckAt)}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-[9px] uppercase tracking-wide opacity-60 font-bold">Provider Message</div>
                        <div className="font-medium leading-relaxed">
                          {card.providerMessage || card.statusDescription || card.lastError || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wide opacity-60 font-bold">Last Success</div>
                        <div className="font-mono font-extrabold">{formatTs(card.lastSuccessAt)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wide opacity-60 font-bold">Last Failure</div>
                        <div className="font-mono font-extrabold">{formatTs(card.lastFailureAt)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
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
                    label="Last Successful Sync"
                    value={formatSyncTs(card)}
                  />
                  <Metric
                    icon={<Timer className="w-3.5 h-3.5" />}
                    label="Sync Duration"
                    value={
                      card.lastSyncDurationSec != null ? `${card.lastSyncDurationSec} sec` : '—'
                    }
                  />
                </div>

                <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-[11px]">
                  <div className="font-extrabold text-slate-800 mb-1">Product Audit</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="text-[9px] uppercase text-slate-400 font-bold">Provider SKU</div>
                      <div className="font-extrabold">{audit?.providerSku ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase text-slate-400 font-bold">Database SKU</div>
                      <div className="font-extrabold">{audit?.databaseSku ?? card.productCount ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase text-slate-400 font-bold">Difference</div>
                      <div
                        className={`font-extrabold ${
                          audit?.warning ? 'text-amber-700' : 'text-slate-800'
                        }`}
                      >
                        {audit?.difference != null ? `${audit.difference} SKU` : '—'}
                      </div>
                    </div>
                  </div>
                  {audit?.warning ? (
                    <p className="mt-2 text-amber-800 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Ada selisih SKU provider vs database.
                    </p>
                  ) : null}
                  <p className="mt-2 text-slate-400">
                    Next recommended sync: {formatTs(card.nextRecommendedSyncAt)}
                  </p>
                </div>

                {(card.apiWarning || (card.enabled && card.transactionEligible === false)) && (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      {card.statusDescription ||
                        'API Provider sedang tidak dapat dihubungi. Produk tetap tersedia dari hasil sinkronisasi terakhir.'}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <ActionBtn disabled={busy} onClick={() => void runSync(card)}>
                    Sync Now
                  </ActionBtn>
                  <ActionBtn
                    disabled={busy}
                    onClick={() =>
                      void runAction(
                        card.id,
                        () => operationsService.healthCheckProductProvider(card.id),
                        'Health check done'
                      )
                    }
                  >
                    Health Check
                  </ActionBtn>
                  {card.enabled ? (
                    <ActionBtn
                      disabled={busy}
                      tone="warn"
                      onClick={() =>
                        void runAction(
                          card.id,
                          () => operationsService.disableProductProvider(card.id),
                          'Provider OFF — products hidden'
                        )
                      }
                    >
                      <PowerOff className="w-3.5 h-3.5" /> Turn OFF
                    </ActionBtn>
                  ) : (
                    <ActionBtn
                      disabled={busy}
                      tone="ok"
                      onClick={() =>
                        void runAction(
                          card.id,
                          () => operationsService.enableProductProvider(card.id),
                          'Provider ON — products visible'
                        )
                      }
                    >
                      <Power className="w-3.5 h-3.5" /> Turn ON
                    </ActionBtn>
                  )}
                  <ActionBtn
                    disabled={busy || card.isPrimary}
                    onClick={() =>
                      void runAction(
                        card.id,
                        () => operationsService.setPrimaryProductProvider(card.id),
                        'Set as primary'
                      )
                    }
                  >
                    <Star className="w-3.5 h-3.5" /> Set Primary
                  </ActionBtn>
                  <ActionBtn disabled={busy} onClick={() => void openLogs(card)}>
                    Activity Log
                  </ActionBtn>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {syncSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900">Synchronization Completed</h3>
              <button type="button" onClick={() => setSyncSummary(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <p className="text-xs text-slate-500 font-semibold">{syncSummary.providerName}</p>
              <SummaryRow label="Total Provider SKU" value={String(syncSummary.providerSkuTotal ?? '—')} />
              <SummaryRow label="Inserted" value={String(syncSummary.inserted ?? 0)} />
              <SummaryRow label="Updated" value={String(syncSummary.updated ?? 0)} />
              <SummaryRow label="Skipped" value={String(syncSummary.skipped ?? 0)} />
              <SummaryRow label="Disabled" value={String(syncSummary.disabled ?? 0)} />
              <SummaryRow
                label="Duration"
                value={
                  syncSummary.durationSec != null ? `${syncSummary.durationSec} seconds` : '—'
                }
              />
              {syncSummary.audit && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-[12px]">
                  <div className="font-bold text-slate-700 mb-1">Product Audit</div>
                  <p>
                    Provider {syncSummary.audit.providerSku ?? '—'} · Database{' '}
                    {syncSummary.audit.databaseSku ?? '—'} · Diff{' '}
                    {syncSummary.audit.difference ?? '—'}
                  </p>
                </div>
              )}
              {syncSummary.message && (
                <p className="text-xs text-slate-500 leading-relaxed">{syncSummary.message}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {logsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900">Activity Log — {logsTitle}</h3>
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
                      <span>
                        {log.eventType}
                        {log.success === false ? ' · FAILED' : log.success ? ' · OK' : ''}
                      </span>
                      <span className="text-slate-400 font-medium">{formatTs(log.createdAt)}</span>
                    </div>
                    <p className="text-slate-600 mt-1">
                      {log.reason || '—'}
                      {log.responseTimeMs != null ? ` · ${log.responseTimeMs}ms` : ''}
                      {log.attempt != null ? ` · attempt ${log.attempt}` : ''}
                    </p>
                    {log.errorMessage && <p className="text-rose-600 mt-1">{log.errorMessage}</p>}
                    {log.meta && (
                      <pre className="mt-2 max-h-24 overflow-auto rounded-lg bg-white border border-slate-100 p-2 text-[10px] text-slate-500">
                        {JSON.stringify(log.meta, null, 2)}
                      </pre>
                    )}
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

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 border-b border-slate-50 pb-2">
    <span className="text-slate-500 font-semibold">{label}</span>
    <span className="font-extrabold text-slate-900 tabular-nums">{value}</span>
  </div>
);

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
