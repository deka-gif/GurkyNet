import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Layers,
  Wifi,
  Wrench,
  Tag,
  Database,
  Sliders,
  WifiOff,
  AlertOctagon,
  Zap,
  CreditCard,
} from 'lucide-react';
import { useOperationsStore } from '../../store/operations.store';
import { StatCard } from '../../components/common';

export const OperationsDashboard: React.FC = () => {
  const {
    dashboardData,
    dashboardLoading,
    dashboardError,
    fetchDashboard,
    syncCatalog,
    syncLoading,
  } = useOperationsStore();

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const stats = dashboardData?.stats || dashboardData?.kpis || dashboardData?.summary || {};
  const sync = dashboardData?.digiflazz_sync || {};
  const digiflazzProvider = dashboardData?.digiflazz_provider || {};

  const handleSyncNow = async () => {
    await syncCatalog();
  };
  
  const serviceStatusList: any[] = 
    dashboardData?.services ||
    dashboardData?.serviceStatusList ||
    dashboardData?.services_list ||
    (Array.isArray(dashboardData?.service_status) ? dashboardData.service_status : []);

  const providerStatusList: any[] = 
    dashboardData?.providers ||
    dashboardData?.providerStatusList ||
    dashboardData?.provider_list ||
    (Array.isArray(dashboardData?.provider_status) ? dashboardData.provider_status : []);

  const recentOperationLogs: any[] = 
    dashboardData?.logs ||
    dashboardData?.recentOperationLogs ||
    dashboardData?.operation_logs ||
    dashboardData?.activity_logs ||
    [];

  const getServiceStatusBadge = (status: string) => {
    const s = String(status).toLowerCase();
    if (s === 'online' || s === 'active') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Online
        </span>
      );
    }
    if (s === 'maintenance') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
          <Wrench className="w-3.5 h-3.5 text-amber-600" />
          Maintenance
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-red-50 text-red-700 border border-red-200">
        <WifiOff className="w-3.5 h-3.5 text-red-600" />
        Offline
      </span>
    );
  };

  const getLogStatusBadge = (status: string) => {
    const s = String(status).toLowerCase();
    if (s === 'success' || s === 'sukses') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Success
        </span>
      );
    }
    if (s === 'warning' || s === 'warn') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          Warning
        </span>
      );
    }
    if (s === 'in progress' || s === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
          <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
          In Progress
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-200">
        <XCircle className="w-3 h-3 text-red-600" />
        Failed
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* TOP BANNER */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 backdrop-blur-xs text-[11px] font-bold text-indigo-200 border border-indigo-400/30">
              <Server className="w-3.5 h-3.5" />
              GurkyNet Operations CMS
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Operations Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed max-w-2xl">
              Pusat pemantauan status layanan operasional produk, uptime biller provider, latency jaringan, dan jurnal aktivitas sistem operasional.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSyncNow}
              disabled={syncLoading || dashboardLoading}
              className="px-4 py-2.5 bg-emerald-500 text-white rounded-2xl font-extrabold text-xs shadow-md hover:bg-emerald-400 transition flex items-center gap-2 disabled:opacity-50"
            >
              <Database className={`w-4 h-4 ${syncLoading ? 'animate-pulse' : ''}`} />
              <span>{syncLoading ? 'Syncing Digiflazz...' : 'Sync Digiflazz Now'}</span>
            </button>
            <button
              onClick={() => fetchDashboard()}
              disabled={dashboardLoading}
              className="px-4 py-2.5 bg-white text-slate-900 rounded-2xl font-extrabold text-xs shadow-md hover:bg-slate-100 transition flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-indigo-600 ${dashboardLoading ? 'animate-spin' : ''}`} />
              <span>{dashboardLoading ? 'Memuat...' : 'Refresh Status'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ERROR MESSAGE DISPLAY */}
      {dashboardError && (
        <div className="p-4 bg-red-50 rounded-2xl border border-red-200 flex items-center gap-3 text-red-900 text-xs">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span className="font-semibold">{dashboardError}</span>
        </div>
      )}

      {/* LOADING STATE */}
      {dashboardLoading && !dashboardData && (
        <div className="py-12 text-center text-gray-500 space-y-2">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <p className="text-xs font-semibold">Memuat data dashboard operasional dari server...</p>
        </div>
      )}

      {/* TOP SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Live Product Count"
          value={
            sync.live_product_count !== undefined
              ? `${sync.live_product_count} SKU`
              : stats.liveProductCount !== undefined
              ? `${stats.liveProductCount} SKU`
              : stats.totalActiveProducts !== undefined
              ? `${stats.totalActiveProducts} Produk`
              : stats.total_products !== undefined
              ? `${stats.total_products} Produk`
              : '-'
          }
          change={
            digiflazzProvider.balance_formatted
              ? `Digiflazz ${digiflazzProvider.status || '-'} · ${digiflazzProvider.balance_formatted}`
              : stats.productsSubtext || 'Master catalog from Digiflazz'
          }
          icon={Layers}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />

        <StatCard
          title="Sync Status"
          value={String(sync.status || stats.syncStatus || 'never').toUpperCase()}
          change={sync.message || stats.providersSubtext || 'Catalog sync pipeline'}
          icon={Server}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />

        <StatCard
          title="Failed Sync"
          value={
            sync.failed_sync_total !== undefined
              ? `${sync.failed_sync_total}`
              : stats.failedSync !== undefined
              ? `${stats.failedSync}`
              : '0'
          }
          change={`Last batch failures: ${sync.failed_count ?? stats.failedSync ?? 0}`}
          icon={AlertOctagon}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />

        <StatCard
          title="Last Sync"
          value={
            sync.last_sync_at || stats.lastSync
              ? new Date(sync.last_sync_at || stats.lastSync).toLocaleString('id-ID')
              : 'Never'
          }
          change={`Synced SKUs: ${sync.synced_count ?? 0}`}
          icon={RefreshCw}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
      </div>

      {/* QUICK ACTIONS BUTTONS SECTION */}
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-extrabold text-gray-900">Operations Quick Actions</h2>
          </div>
          <span className="text-xs text-gray-400 font-mono">Operations Management Controls</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Link
            to="/dashboard/operations/products"
            className="p-4 rounded-2xl bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-100 text-left transition-all group flex flex-col justify-between space-y-2"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="font-extrabold text-indigo-950 text-xs">Product Management</div>
              <p className="text-[10px] text-indigo-700 mt-0.5">Kelola SKU & katalog produk</p>
            </div>
          </Link>

          <Link
            to="/dashboard/operations/product-providers"
            className="p-4 rounded-2xl bg-violet-50 hover:bg-violet-100/80 border border-violet-100 text-left transition-all group flex flex-col justify-between space-y-2"
          >
            <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-md shadow-violet-500/20 group-hover:scale-105 transition-transform">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="font-extrabold text-violet-950 text-xs">Product Provider Control</div>
              <p className="text-[10px] text-violet-700 mt-0.5">ON/OFF, Priority, Sync & Health</p>
            </div>
          </Link>

          <Link
            to="/dashboard/operations/providers"
            className="p-4 rounded-2xl bg-blue-50 hover:bg-blue-100/80 border border-blue-100 text-left transition-all group flex flex-col justify-between space-y-2"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <div className="font-extrabold text-blue-950 text-xs">Provider Management</div>
              <p className="text-[10px] text-blue-700 mt-0.5">Monitoring status provider PPOB</p>
            </div>
          </Link>

          <Link
            to="/dashboard/operations/payment-gateways"
            className="p-4 rounded-2xl bg-sky-50 hover:bg-sky-100/80 border border-sky-100 text-left transition-all group flex flex-col justify-between space-y-2"
          >
            <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <div className="font-extrabold text-sky-950 text-xs">Payment Gateway Control</div>
              <p className="text-[10px] text-sky-700 mt-0.5">Midtrans & top up saldo</p>
            </div>
          </Link>

          <Link
            to="/dashboard/operations/pricing"
            className="p-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-100 text-left transition-all group flex flex-col justify-between space-y-2"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <div className="font-extrabold text-emerald-950 text-xs">Pricing Management</div>
              <p className="text-[10px] text-emerald-700 mt-0.5">Atur margin & skema promo</p>
            </div>
          </Link>

          <Link
            to="/dashboard/operations/monitoring"
            className="p-4 rounded-2xl bg-amber-50 hover:bg-amber-100/80 border border-amber-100 text-left transition-all group flex flex-col justify-between space-y-2"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <div className="font-extrabold text-amber-950 text-xs">Maintenance Center</div>
              <p className="text-[10px] text-amber-700 mt-0.5">Status & pemeliharaan PPOB</p>
            </div>
          </Link>
        </div>
      </div>

      {/* SERVICE STATUS SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
              <Wifi className="w-5 h-5 text-indigo-600" />
              Service Status Center
            </h2>
            <p className="text-xs text-gray-500">Status kesehatan operasional layanan pelanggan GurkyNet</p>
          </div>
          <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 font-extrabold px-3 py-1 rounded-full">
            {serviceStatusList.filter(s => String(s.status).toLowerCase() === 'online').length} Operational
          </span>
        </div>

        {serviceStatusList.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-gray-100 text-center text-gray-400 text-xs">
            Belum ada data status layanan dari server.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {serviceStatusList.map((svc: any, idx: number) => (
              <div
                key={svc.id || idx}
                className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3 hover:shadow-md transition"
              >
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <div>
                    <h3 className="font-black text-gray-900 text-sm">{svc.name || svc.title}</h3>
                    <span className="text-[10px] text-gray-400 font-medium">{svc.category || svc.type || 'Service'}</span>
                  </div>
                  {getServiceStatusBadge(svc.status)}
                </div>

                <div className="space-y-1.5 text-xs text-gray-700 font-medium">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Service Uptime:</span>
                    <span className="font-extrabold text-emerald-700 font-mono">{svc.uptime || svc.uptime_percentage || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Active Provider:</span>
                    <span className="font-bold text-gray-900">{svc.activeProvider || svc.provider || '-'}</span>
                  </div>
                </div>

                {(svc.note || svc.description) && (
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-[11px] text-gray-600 leading-relaxed">
                    {svc.note || svc.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PROVIDER STATUS SECTION */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden space-y-0">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-600" />
              Provider Status & Health
            </h2>
            <p className="text-xs text-gray-500">Pemantauan integrasi biller aggregator dan payment gateway host-to-host</p>
          </div>
          <span className="text-xs text-blue-700 font-mono bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
            Realtime Sync
          </span>
        </div>

        {providerStatusList.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs">
            Belum ada data status provider dari server.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {providerStatusList.map((prv: any, idx: number) => (
              <div
                key={prv.id || idx}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-3 bg-slate-900 text-white rounded-2xl shrink-0 mt-0.5">
                    <Database className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-gray-900 text-sm">{prv.name || prv.code}</h3>
                      {String(prv.status).toLowerCase() === 'online' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Online
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          {prv.status || 'Degraded'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{prv.type || prv.category || 'Biller Provider'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-xs font-mono shrink-0 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block uppercase">Last Sync</span>
                    <span className="font-bold text-gray-800">{prv.lastSync || prv.last_sync || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block uppercase">Response Time</span>
                    <span className="font-extrabold text-blue-700">{prv.responseTime || prv.response_time || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Success Rate</span>
                    <span className="font-extrabold text-emerald-700">{prv.successRate || prv.success_rate || '-'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RECENT OPERATION LOG TABLE */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden space-y-0">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600" />
              Recent Operation Log
            </h2>
            <p className="text-xs text-gray-500">Jurnal peristiwa operasional teknis & otomatisasi failover sistem</p>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            {recentOperationLogs.length} Recent Logs
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Activity</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
              {recentOperationLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    Belum ada riwayat jurnal operasional.
                  </td>
                </tr>
              ) : (
                recentOperationLogs.map((log: any, idx: number) => (
                  <tr key={log.id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                      {log.date || log.created_at || log.timestamp || '-'}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-indigo-700 whitespace-nowrap">
                      {log.provider || log.source || '-'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800 font-bold text-[11px]">
                        {log.service || log.type || '-'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-md truncate font-medium text-gray-800">
                      {log.activity || log.action || log.message || '-'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">{getLogStatusBadge(log.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
