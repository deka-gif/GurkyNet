import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Bell,
  Database,
  RefreshCw,
  Server,
  ShieldCheck,
  Wifi,
  Zap,
} from 'lucide-react';
import { operationsService } from '../../services/operations.service';
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';
import { storageService } from '../../services/storage.service';
import { WorkflowStatsStrip } from '../../components/workflow/WorkflowStatsStrip';
import { FinanceCrossWidgets } from '../../components/finance/FinanceCrossWidgets';

function ProbePill({ label, probe }: { label: string; probe?: { status?: string; available?: boolean; message?: string; value?: unknown } }) {
  const status = probe?.status || 'na';
  const tone =
    status === 'up'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
      : status === 'na'
        ? 'bg-slate-50 text-slate-500 border-slate-100'
        : status === 'warning' || status === 'stale' || status === 'degraded'
          ? 'bg-amber-50 text-amber-800 border-amber-100'
          : 'bg-red-50 text-red-700 border-red-100';

  return (
    <div className={`rounded-2xl border px-3 py-2 ${tone}`}>
      <p className="text-[10px] font-bold uppercase opacity-70">{label}</p>
      <p className="text-sm font-black mt-0.5">{String(status).toUpperCase()}</p>
      {probe?.available === false && <p className="text-[10px] mt-1 opacity-80">Metric Not Available</p>}
      {probe?.message && <p className="text-[10px] mt-1 opacity-80 line-clamp-2">{probe.message}</p>}
    </div>
  );
}

export const OperationsDashboard: React.FC = () => {
  const [cc, setCc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await operationsService.getCommandCenter();
      setCc(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat Command Center.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeChannel(true, ['division.operations'], () => void load(), () => storageService.getToken());

  const kpis = cc?.kpis || {};
  const infra = cc?.infra || {};
  const os = infra?.os || {};

  const widgets = [
    { label: 'Tx Today', value: String(kpis.transactionsToday ?? 0), to: '/dashboard/operations/live-transactions' },
    { label: 'Success Rate', value: `${kpis.successRate ?? 0}%`, to: '/dashboard/operations/live-transactions' },
    { label: 'Failed Today', value: String(kpis.failedToday ?? 0), to: '/dashboard/operations/live-transactions' },
    { label: 'Open Issues', value: String(kpis.openIssues ?? 0), to: '/dashboard/operations/issue-queue' },
    { label: 'Incidents Today', value: String(kpis.incidentsToday ?? 0), to: '/dashboard/operations/alerts' },
    { label: 'Open Alerts', value: String(kpis.openAlerts ?? 0), to: '/dashboard/operations/alerts' },
    { label: 'Avg Latency', value: kpis.avgLatencyMs != null ? `${kpis.avgLatencyMs} ms` : 'N/A', to: '/dashboard/operations/monitoring' },
    { label: 'Pending Tx', value: String(kpis.pendingToday ?? 0), to: '/dashboard/operations/live-transactions' },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-gradient-to-br from-slate-800 via-sky-900 to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 text-[11px] font-bold text-sky-200 border border-sky-400/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              Operations Command Center
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Ops Command Center</h1>
            <p className="text-xs sm:text-sm text-sky-100/90 max-w-2xl">
              Issue queue, provider health, live transactions, alerts, dan app-level infra — tanpa dummy OS metrics.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/dashboard/operations/issue-queue" className="px-4 py-2.5 bg-sky-400 text-slate-950 rounded-2xl font-extrabold text-xs">
              Issue Queue
            </Link>
            <Link to="/dashboard/operations/alerts" className="px-4 py-2.5 bg-white text-slate-950 rounded-2xl font-extrabold text-xs">
              Alerts
            </Link>
            <button type="button" onClick={() => void load()} className="px-4 py-2.5 bg-white/10 border border-white/20 rounded-2xl text-xs font-bold">
              <RefreshCw className={`w-4 h-4 inline ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" /> {error}
        </div>
      )}

      <WorkflowStatsStrip division="operations" queuePath="/dashboard/operations/issue-queue" queueLabel="Issue Queue" />
      <FinanceCrossWidgets audience="operations" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {widgets.map((w) => (
          <Link key={w.label} to={w.to} className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-xs hover:border-sky-200 transition">
            <p className="text-[10px] font-bold uppercase text-gray-400">{w.label}</p>
            <p className="text-lg font-black text-gray-900 mt-1">{loading ? '…' : w.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-sky-600" /> App Infra
            </p>
            <button
              type="button"
              className="text-xs font-bold text-sky-700"
              onClick={async () => {
                await operationsService.refreshInfraMonitoring();
                await load();
              }}
            >
              Refresh probes
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <ProbePill label="Redis" probe={infra.redis} />
            <ProbePill label="Database" probe={infra.database} />
            <ProbePill label="Cache" probe={infra.cache} />
            <ProbePill label="Queue" probe={infra.queue} />
            <ProbePill label="Failed Jobs" probe={infra.failed_jobs} />
            <ProbePill label="Scheduler" probe={infra.scheduler} />
            <ProbePill label="CPU" probe={os.cpu} />
            <ProbePill label="RAM" probe={os.ram} />
            <ProbePill label="Disk" probe={os.disk} />
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs space-y-3">
          <p className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" /> Provider Health
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(cc?.providerHealth || []).length === 0 && (
              <p className="text-sm text-gray-400">Belum ada product provider.</p>
            )}
            {(cc?.providerHealth || []).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-50 px-3 py-2">
                <div>
                  <p className="text-sm font-bold text-gray-900">{p.name}</p>
                  <p className="text-[11px] text-gray-400">{p.code} · {p.partnerStatus || '—'}</p>
                </div>
                <span className="text-[11px] font-bold uppercase text-gray-500">{p.healthColor || '—'}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link to="/dashboard/operations/product-providers" className="text-xs font-bold text-sky-700">
              Product Provider Control →
            </Link>
            <Link to="/dashboard/operations/payment-gateways" className="text-xs font-bold text-sky-700">
              Payment Gateways →
            </Link>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs space-y-3">
          <p className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
            <Bell className="w-4 h-4 text-rose-500" /> Open Alerts
          </p>
          {(cc?.alerts || []).length === 0 && <p className="text-sm text-gray-400">Tidak ada alert terbuka.</p>}
          {(cc?.alerts || []).slice(0, 6).map((a: any) => (
            <div key={a.id} className="rounded-xl border border-gray-50 px-3 py-2">
              <p className="text-sm font-bold text-gray-900">{a.title}</p>
              <p className="text-[11px] text-gray-400">{a.alertCode} · {a.severity} · {a.status}</p>
            </div>
          ))}
          <Link to="/dashboard/operations/alerts" className="text-xs font-bold text-sky-700 inline-block">
            Alert Center →
          </Link>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs space-y-3">
          <p className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-500" /> Recent Activity
          </p>
          {(cc?.recentActivity || []).length === 0 && <p className="text-sm text-gray-400">Belum ada aktivitas.</p>}
          {(cc?.recentActivity || []).slice(0, 8).map((log: any) => (
            <div key={log.id} className="rounded-xl border border-gray-50 px-3 py-2">
              <p className="text-xs font-bold text-gray-800">{log.activity}</p>
              <p className="text-[10px] text-gray-400">{log.createdAt || '—'}</p>
            </div>
          ))}
          <div className="flex flex-wrap gap-3">
            <Link to="/dashboard/operations/live-transactions" className="text-xs font-bold text-sky-700 inline-flex items-center gap-1">
              <Wifi className="w-3 h-3" /> Live Transactions →
            </Link>
            <Link to="/dashboard/operations/monitoring" className="text-xs font-bold text-sky-700 inline-flex items-center gap-1">
              <Database className="w-3 h-3" /> Service Monitoring →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};
