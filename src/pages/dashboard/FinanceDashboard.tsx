import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Building,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Wallet,
  BookOpen,
  Bell,
  Share2,
  Scale,
} from 'lucide-react';
import { financeService, formatIdr } from '../../services/finance.service';
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';
import { useSoftRefresh } from '../../hooks/useSoftRefresh';
import { storageService } from '../../services/storage.service';
import { WorkflowStatsStrip } from '../../components/workflow/WorkflowStatsStrip';
import { RefreshPolicy } from '../../lib/refreshPolicy';

export const FinanceDashboard: React.FC = () => {
  const [cc, setCc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await financeService.getCommandCenter();
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

  useRealtimeChannel(true, ['division.finance'], () => void load(), () => storageService.getToken(), RefreshPolicy.finance);
  useSoftRefresh(true, RefreshPolicy.finance, () => void load());

  const widgets = [
    { label: "Today's Revenue", value: formatIdr(cc?.todaysRevenue), to: '/dashboard/finance/financial-report' },
    { label: "Today's Profit", value: formatIdr(cc?.todaysProfit), to: '/dashboard/finance/financial-report' },
    { label: 'Pending Refund', value: String(cc?.pendingRefund ?? 0), to: '/dashboard/finance/refund-queue' },
    { label: 'Pending Settlement', value: String(cc?.pendingSettlement ?? 0), to: '/dashboard/finance/settlement' },
    { label: 'Pending Audit', value: String(cc?.pendingAudit ?? 0), to: '/dashboard/finance/ledger' },
    { label: 'Pending Chargeback', value: String(cc?.pendingChargeback ?? 0), to: '/dashboard/finance/alerts' },
    { label: 'Wallet Adjustments', value: String(cc?.pendingWalletAdjustment ?? 0), to: '/dashboard/finance/wallets' },
    { label: 'Low Provider Balance', value: String((cc?.lowProviderBalance || []).length), to: '/dashboard/finance/treasury' },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-[11px] font-bold text-emerald-200 border border-emerald-400/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              Financial Command Center
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Finance Command Center</h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 max-w-2xl">
              Pusat audit, treasury, settlement, refund, ledger, dan monitoring arus uang GurkyNet — data dari transaksi nyata.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/dashboard/finance/refund-queue" className="px-4 py-2.5 bg-emerald-400 text-emerald-950 rounded-2xl font-extrabold text-xs">
              Refund Queue
            </Link>
            <Link to="/dashboard/finance/settlement" className="px-4 py-2.5 bg-white text-emerald-950 rounded-2xl font-extrabold text-xs">
              Settlement Queue
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

      <WorkflowStatsStrip division="finance" queuePath="/dashboard/finance/refund-queue" queueLabel="Refund Queue" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {widgets.map((w) => (
          <Link key={w.label} to={w.to} className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-xs hover:border-emerald-200 transition">
            <p className="text-[10px] font-bold uppercase text-gray-400">{w.label}</p>
            <p className="text-lg font-black text-gray-900 mt-1">{loading ? '…' : w.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
              <Bell className="w-4 h-4" /> Financial Alerts
            </h2>
            <Link to="/dashboard/finance/alerts" className="text-xs font-bold text-emerald-700">
              Lihat semua
            </Link>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(cc?.financialAlerts || []).length === 0 && (
              <p className="text-sm text-gray-400">Tidak ada alert terbuka.</p>
            )}
            {(cc?.financialAlerts || []).map((a: any) => (
              <div key={a.id} className="rounded-xl border border-gray-100 px-3 py-2">
                <p className="text-xs font-bold text-gray-900">{a.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{a.severity} · {a.type}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Recent Financial Activity
            </h2>
            <Link to="/dashboard/finance/ledger" className="text-xs font-bold text-emerald-700">
              Ledger
            </Link>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(cc?.recentFinancialActivity || []).length === 0 && (
              <p className="text-sm text-gray-400">Belum ada ledger entry.</p>
            )}
            {(cc?.recentFinancialActivity || []).map((e: any) => (
              <div key={e.id} className="rounded-xl border border-gray-100 px-3 py-2 flex justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-gray-900">{e.eventType}</p>
                  <p className="text-[11px] font-mono text-gray-400">{e.ledgerCode}</p>
                </div>
                <p className="text-xs font-extrabold text-emerald-700">
                  {e.credit > 0 ? `+${formatIdr(e.credit)}` : e.debit > 0 ? `-${formatIdr(e.debit)}` : '—'}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/dashboard/finance/treasury', icon: Building, label: 'Treasury' },
          { to: '/dashboard/finance/ledger', icon: BookOpen, label: 'Ledger' },
          { to: '/dashboard/finance/wallets', icon: Wallet, label: 'Wallets' },
          { to: '/dashboard/finance/kyc', icon: ShieldCheck, label: 'KYC Review' },
          { to: '/dashboard/finance/refund-approval', icon: Receipt, label: 'Refund Approval' },
          { to: '/dashboard/finance/alerts', icon: Bell, label: 'Alerts' },
          { to: '/dashboard/finance/reconciliation', icon: Scale, label: 'Reconciliation' },
          { to: '/dashboard/finance/financial-report', icon: Share2, label: 'Reports' },
        ].map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-xs flex items-center gap-2 text-sm font-bold text-gray-800 hover:border-emerald-200"
          >
            <q.icon className="w-4 h-4 text-emerald-600" /> {q.label}
          </Link>
        ))}
      </div>
    </div>
  );
};
