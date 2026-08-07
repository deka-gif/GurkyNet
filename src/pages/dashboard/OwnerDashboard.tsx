import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Crown,
  DollarSign,
  Headset,
  Loader2,
  Megaphone,
  RefreshCw,
  Server,
  Share2,
  ShieldCheck,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { ownerService } from '../../services/owner.service';
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';
import { useSoftRefresh } from '../../hooks/useSoftRefresh';
import { storageService } from '../../services/storage.service';
import { WorkflowStatsStrip } from '../../components/workflow/WorkflowStatsStrip';
import { RefreshPolicy } from '../../lib/refreshPolicy';

const idr = (n: number | null | undefined) =>
  n == null ? '—' : `Rp ${Number(n).toLocaleString('id-ID')}`;

export const OwnerDashboard: React.FC = () => {
  const [cc, setCc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ownerService.getCommandCenter();
      setCc(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal memuat Executive Command Center.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeChannel(
    true,
    ['division.operations', 'division.finance', 'division.customer_support', 'division.marketing'],
    () => void load(),
    () => storageService.getToken(),
    RefreshPolicy.owner
  );
  useSoftRefresh(true, RefreshPolicy.owner, () => void load());

  const health = cc?.businessHealth || {};
  const headline = cc?.headline || {};
  const divisions = cc?.crossDivision || {};
  const alerts = cc?.alerts || [];
  const risks = cc?.risks || [];
  const insights = cc?.insights || [];
  const goals = cc?.goals || {};
  const treasury = cc?.treasury || {};
  const profit = cc?.profit || {};
  const wfMon = cc?.workflowMonitor || {};
  const timeline = cc?.timeline || [];
  const approvals = cc?.approvals || [];

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-gradient-to-br from-slate-900 via-amber-950 to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-200 border border-amber-400/30">
              <Crown className="w-3.5 h-3.5" />
              Executive Command Center
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Owner Intelligence</h1>
            <p className="text-xs sm:text-sm text-amber-100/90 max-w-2xl">
              Pusat pemantauan strategis lintas Finance, Operations, Marketing, CS, dan Workflow — read-mostly, data nyata.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/dashboard/admin/workflows" className="px-4 py-2.5 bg-amber-400 text-slate-950 rounded-2xl font-extrabold text-xs">
              Global Workflows
            </Link>
            <Link to="/dashboard/owner/approvals" className="px-4 py-2.5 bg-white text-slate-950 rounded-2xl font-extrabold text-xs">
              Approvals
            </Link>
            <button type="button" onClick={() => void load()} className="px-4 py-2.5 bg-white/10 border border-white/20 rounded-2xl text-xs font-bold">
              <RefreshCw className={`w-4 h-4 inline ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-3">
            <p className="text-[10px] uppercase font-bold text-amber-200/80">Business Health</p>
            <p className="text-2xl font-black mt-1">{loading ? '…' : `${health.overall ?? 0}%`}</p>
            <p className="text-xs text-amber-100/80">{health.label || '—'}</p>
          </div>
          <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-3">
            <p className="text-[10px] uppercase font-bold text-amber-200/80">Kondisi hari ini</p>
            <p className="text-sm font-bold mt-2 line-clamp-2">{loading ? '…' : headline.businessCondition || '—'}</p>
          </div>
          <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-3">
            <p className="text-[10px] uppercase font-bold text-amber-200/80">Risiko terbesar</p>
            <p className="text-sm font-bold mt-2 line-clamp-2">{loading ? '…' : headline.largestRisk || 'Tidak ada risiko kritis'}</p>
          </div>
          <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-3">
            <p className="text-[10px] uppercase font-bold text-amber-200/80">Ada masalah?</p>
            <p className="text-lg font-black mt-1">{loading ? '…' : headline.hasProblems ? 'Ya' : 'Tidak'}</p>
            <p className="text-xs text-amber-100/80">Divisi sibuk: {headline.busiestDivision || '—'}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" /> {error}
        </div>
      )}

      {loading && !cc && (
        <div className="flex justify-center py-12 text-gray-400 gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat intelligence…
        </div>
      )}

      <WorkflowStatsStrip division="admin" queuePath="/dashboard/admin/workflows" queueLabel="Global Queue" />

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Cash Proxy', value: idr(headline.companyMoneyProxy), to: '/dashboard/finance/treasury' },
          { label: 'Wallet Liability', value: idr(headline.walletLiability), to: '/dashboard/finance/treasury' },
          { label: 'Profit Today', value: idr(headline.profitToday), to: '/dashboard/finance/financial-report' },
          { label: 'Refund Today', value: idr(headline.refundToday), to: '/dashboard/finance/refund-queue' },
          { label: 'Tx Today', value: String(headline.transactionsToday ?? 0), to: '/dashboard/operations/live-transactions' },
          { label: 'Problem Provider', value: headline.problemProvider || '—', to: '/dashboard/operations/product-providers' },
        ].map((w) => (
          <Link key={w.label} to={w.to} className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-xs hover:border-amber-200">
            <p className="text-[10px] font-bold uppercase text-gray-400">{w.label}</p>
            <p className="text-sm font-black text-gray-900 mt-1 truncate">{w.value}</p>
          </Link>
        ))}
      </div>

      {/* Cross division */}
      <section className="space-y-3">
        <h2 className="text-sm font-extrabold text-gray-900 uppercase tracking-wide">Cross Division Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <DivisionCard
            title="Finance"
            icon={DollarSign}
            path={divisions.finance?.path}
            rows={[
              ['Pending Refund', divisions.finance?.pendingRefund],
              ['Settlement Pending', divisions.finance?.settlementPending],
              ['Cash Position', idr(divisions.finance?.cashPosition)],
              ['Profit Today', idr(divisions.finance?.profit)],
            ]}
          />
          <DivisionCard
            title="Operations"
            icon={Server}
            path={divisions.operations?.path}
            rows={[
              ['Incidents Today', divisions.operations?.openIncident],
              ['Issue Queue', divisions.operations?.issueQueue],
              ['Gateway', divisions.operations?.gatewayHealth],
              ['Latency', divisions.operations?.latency != null ? `${divisions.operations.latency} ms` : '—'],
            ]}
          />
          <DivisionCard
            title="Marketing"
            icon={Megaphone}
            path={divisions.marketing?.path}
            rows={[
              ['Campaign Active', divisions.marketing?.campaignActive],
              ['Feedback Queue', divisions.marketing?.feedback],
              ['Homepage Updated', divisions.marketing?.homepageVersion ? 'Yes' : '—'],
            ]}
          />
          <DivisionCard
            title="Customer Support"
            icon={Headset}
            path={divisions.customerSupport?.path}
            rows={[
              ['Open Chat', divisions.customerSupport?.openChat],
              ['Open Ticket', divisions.customerSupport?.openTicket],
              ['Critical', divisions.customerSupport?.criticalTicket],
              ['Avg Resolve (m)', divisions.customerSupport?.averageResponseTime ?? '—'],
            ]}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alerts */}
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-extrabold flex items-center gap-2">
              <Bell className="w-4 h-4 text-rose-500" /> Executive Alert Center
            </p>
            <Link to="/dashboard/owner/alerts" className="text-xs font-bold text-amber-700">
              Semua →
            </Link>
          </div>
          {alerts.length === 0 && <p className="text-sm text-gray-400">Tidak ada alert terbuka.</p>}
          {alerts.slice(0, 6).map((a: any) => (
            <Link key={a.id} to={a.drillDown || '/dashboard/owner/alerts'} className="block rounded-xl border border-gray-50 px-3 py-2 hover:bg-slate-50">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-gray-900">{a.title}</p>
                <span className="text-[10px] font-bold uppercase text-gray-500">{a.severity}</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {a.sourceDivision} · {a.status} · impact {a.impact}
              </p>
            </Link>
          ))}
        </section>

        {/* Risks */}
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs space-y-3">
          <p className="text-sm font-extrabold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Business Risk
          </p>
          {risks.filter((r: any) => r.priority !== 'info').length === 0 && (
            <p className="text-sm text-gray-400">Tidak ada risiko prioritas tinggi.</p>
          )}
          {risks
            .filter((r: any) => r.priority !== 'info')
            .slice(0, 6)
            .map((r: any) => (
              <Link key={r.code + r.title} to={r.drillDown || '#'} className="block rounded-xl border border-gray-50 px-3 py-2 hover:bg-slate-50">
                <p className="text-sm font-bold text-gray-900">{r.title}</p>
                <p className="text-[11px] text-gray-500">{r.detail}</p>
                <p className="text-[10px] uppercase font-bold text-gray-400 mt-1">
                  {r.priority} · {r.division}
                </p>
              </Link>
            ))}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Treasury */}
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs space-y-2">
          <p className="text-sm font-extrabold flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-600" /> Treasury Snapshot
          </p>
          <Row label="Digiflazz" value={idr(treasury.digiflazzBalance)} />
          <Row label="VIP" value={idr(treasury.vipBalance)} />
          <Row
            label="Midtrans"
            value={treasury.midtransBalanceAvailable ? idr(treasury.midtransBalance) : 'N/A'}
          />
          <Row label="Wallet Liability" value={idr(treasury.walletLiability)} />
          <Row label="Outstanding Settlement" value={idr(treasury.outstandingSettlement)} />
          <Row label="Pending Refund" value={idr(treasury.pendingRefundAmount)} />
          <Row label="Cash Available (proxy)" value={idr(treasury.cashAvailableProxy)} />
          <Row label="Reserve Fund" value={treasury.reserveFundAvailable ? idr(treasury.reserveFund) : 'N/A'} />
          <Link to="/dashboard/finance/treasury" className="text-xs font-bold text-amber-700 inline-flex items-center gap-1 pt-1">
            Finance Treasury <ArrowRight className="w-3 h-3" />
          </Link>
        </section>

        {/* Profit */}
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs space-y-2">
          <p className="text-sm font-extrabold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-600" /> Profit Monitor (MTD)
          </p>
          <Row label="Gross Revenue" value={idr(profit.grossRevenue)} />
          <Row label="Net Revenue" value={idr(profit.netRevenue)} />
          <Row label="Provider Cost" value={idr(profit.providerCost)} />
          <Row label="Gateway Fee" value={idr(profit.gatewayFee)} />
          <Row label="Refund Cost" value={idr(profit.refundCost)} />
          <Row label="OpEx" value={profit.operationalCost == null ? 'N/A' : idr(profit.operationalCost)} />
          <Row label="Gross Profit" value={idr(profit.grossProfit)} />
          <Row label="Net Profit" value={idr(profit.netProfit)} />
          <Row label="Margin" value={profit.profitMargin != null ? `${profit.profitMargin}%` : '—'} />
          <Row label="EBITDA" value={profit.ebitda == null ? 'N/A' : idr(profit.ebitda)} />
        </section>

        {/* Goals */}
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs space-y-3">
          <p className="text-sm font-extrabold flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-600" /> Goal Tracker
          </p>
          {Object.entries(goals).map(([key, g]: [string, any]) => (
            <div key={key}>
              <div className="flex justify-between text-xs font-bold text-gray-600 mb-1">
                <span>{g.label}</span>
                <span>{g.progress != null ? `${g.progress}%` : 'No target'}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${Math.min(100, Number(g.progress || 0))}%` }}
                />
              </div>
              {!g.targetAvailable && (
                <p className="text-[10px] text-gray-400 mt-0.5">{g.message}</p>
              )}
            </div>
          ))}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Workflow monitor */}
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs space-y-3">
          <p className="text-sm font-extrabold flex items-center gap-2">
            <Share2 className="w-4 h-4 text-sky-600" /> Workflow Monitor
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Created', wfMon.createdToday],
              ['In Progress', wfMon.inProgress],
              ['Wait Finance', wfMon.waitingFinance],
              ['Wait Ops', wfMon.waitingOperations],
              ['Wait Mkt', wfMon.waitingMarketing],
              ['Wait CS', wfMon.waitingCs],
              ['Blocked', wfMon.blocked],
              ['Resolved', wfMon.resolvedToday],
              ['Escalated', wfMon.escalatedToday],
            ].map(([label, val]) => (
              <Link
                key={String(label)}
                to="/dashboard/admin/workflows"
                className="rounded-xl border border-gray-50 px-2 py-2 text-center hover:border-amber-200"
              >
                <p className="text-[10px] uppercase text-gray-400 font-bold">{label}</p>
                <p className="text-lg font-black text-gray-900">{val ?? 0}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Insights + Approvals */}
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs space-y-3">
          <p className="text-sm font-extrabold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-violet-600" /> Insights & Approvals
          </p>
          {insights.slice(0, 4).map((ins: any, i: number) => (
            <div key={i} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-gray-700">
              {ins.text}
            </div>
          ))}
          <hr className="border-gray-100" />
          <p className="text-xs font-extrabold uppercase text-gray-400">Pending Executive Approvals</p>
          {approvals.length === 0 && <p className="text-sm text-gray-400">Tidak ada approval strategis.</p>}
          {approvals.slice(0, 4).map((a: any) => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-50 px-3 py-2">
              <div>
                <p className="text-sm font-bold">{a.title}</p>
                <p className="text-[11px] text-gray-400">
                  {a.workflowCode} · {a.division}
                  {a.amount != null ? ` · ${idr(a.amount)}` : ''}
                </p>
              </div>
              <Link to="/dashboard/owner/approvals" className="text-xs font-bold text-amber-700">
                Review
              </Link>
            </div>
          ))}
        </section>
      </div>

      {/* Timeline */}
      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-extrabold flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-600" /> Executive Timeline (Workflow)
          </p>
          <Link to="/dashboard/owner/audit" className="text-xs font-bold text-amber-700">
            Audit Center →
          </Link>
        </div>
        <ol className="space-y-2 max-h-72 overflow-y-auto">
          {timeline.length === 0 && <p className="text-sm text-gray-400">Belum ada event workflow.</p>}
          {timeline.slice(0, 15).map((ev: any) => (
            <li key={ev.id} className="flex gap-3 text-sm border-l-2 border-amber-200 pl-3">
              <div className="min-w-0">
                <p className="font-bold text-gray-900 truncate">
                  {ev.title || ev.workflowCode} · {ev.eventType}
                  {ev.action ? ` / ${ev.action}` : ''}
                </p>
                <p className="text-[11px] text-gray-500">
                  {ev.at} · {ev.actorName || 'system'}
                  {ev.fromDivision ? ` · ${ev.fromDivision}→${ev.toDivision}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Health indicators */}
      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
        <p className="text-sm font-extrabold mb-3">Business Health Indicators</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {Object.entries(health.indicators || {}).map(([key, val]: [string, any]) => (
            <div key={key} className="rounded-xl border border-gray-50 px-3 py-2">
              <p className="text-[10px] uppercase font-bold text-gray-400 truncate">{key}</p>
              {typeof val === 'object' && val?.available === false ? (
                <p className="text-sm font-black text-slate-400 mt-1">N/A</p>
              ) : (
                <p className="text-lg font-black text-gray-900 mt-1">{typeof val === 'number' ? `${val}%` : '—'}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Quick access */}
      <section className="flex flex-wrap gap-2">
        {(cc?.quickAccess || []).map((q: any) => (
          <Link
            key={q.path}
            to={q.path}
            className="px-4 py-2 rounded-2xl border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:border-amber-300"
          >
            {q.label}
          </Link>
        ))}
      </section>
    </div>
  );
};

function DivisionCard({
  title,
  icon: Icon,
  path,
  rows,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path?: string;
  rows: [string, any][];
}) {
  return (
    <Link to={path || '#'} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs hover:border-amber-200 block">
      <p className="text-sm font-extrabold text-gray-900 flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-amber-600" /> {title}
      </p>
      <div className="space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between text-xs gap-2">
            <span className="text-gray-500">{label}</span>
            <span className="font-bold text-gray-900 truncate">{value ?? '—'}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] font-bold text-amber-700 mt-3 inline-flex items-center gap-1">
        Buka dashboard <ArrowRight className="w-3 h-3" />
      </p>
    </Link>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-xs gap-2">
      <span className="text-gray-500">{label}</span>
      <span className="font-bold text-gray-900 text-right">{value}</span>
    </div>
  );
}
